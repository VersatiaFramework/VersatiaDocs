# Player stores

import Audience from '@site/src/components/Audience';

<Audience who="developer" below />

A player store is a [store](stores.md) keyed by player UUID that follows the players: loaded before
a player joins, saved when they quit.

Declare the store as a bean that delegates to it, so your own helpers sit next to the store's
operations:

```kotlin
@LocalBean
class Profiles(database: Database) : PlayerStore<Profile> by database.playerStore(
    "profiles", Profile::uuid,
    onJoin = { player, profile -> profile.copy(name = player.name) },
    onLeave = { _, profile -> profile.copy(lastSeen = Instant.now()) },
    create = { Profile(it) },
) {
    fun give(player: Player, coins: Long) = update(player) { it.copy(coins = it.coins + coins) }

    /** False, and nothing changes, when the player has fewer coins. */
    fun trySpend(player: Player, coins: Long) = tryUpdate(player) { if (it.coins < coins) null else it.copy(coins = it.coins - coins) } != null
}
```

| Argument        | What it is                                                              |
|-----------------|-------------------------------------------------------------------------|
| `"profiles"`    | the table, without the prefix: the store reads and writes `{prefix}profiles` (`profiles` with no prefix, `shop_profiles` with `shop_`); also the store's name in logs |
| `Profile::uuid` | the key: a constructor property holding the player's UUID, the table's primary key |
| `onJoin`        | applied to the player's value when they join, with the `Player` at hand; it only brings the value up to date (see [Players already online](#players-already-online)) |
| `onLeave`       | applied when they quit, and to everyone online when the plugin stops, with the `Player` at hand too |
| `create`        | the value of a player with no row yet                                   |

`profiles[player]` is the value of an online player, never null. A player the store did not see
log in, an NPC for one, has none:
`Plugin Shop: profiles has no entry for Steve (069a79f4-...); a player store loads players when they log in, so an NPC or a player who logged in before the store existed has none`.

## The login {/* #the-login */}

A player never plays on default data: the value is loaded while the server is still deciding
whether to let them in, and a login whose data cannot be loaded is refused.

| Event                                | Priority | The store                                                      |
|--------------------------------------|----------|----------------------------------------------------------------|
| `AsyncPlayerPreLoginEvent`           | `HIGH`, if still allowed | loads the value (or uses the one still cached from a recent session), waiting at most `stores.login-timeout`; when that fails, refuses the login with `messages.load-failed` and logs `Refused the login of Steve (069a79f4-...): profiles could not be loaded (...)`; while the plugin stops, refuses it with `messages.closing` |
| `AsyncPlayerPreLoginEvent`           | `MONITOR` | when a later handler refused the login, lets go of the value; a value with no unsaved change, or one just created for a new player, is dropped |
| `PlayerConnectionValidateLoginEvent` | `MONITOR` | the same, for a refusal there: a ban, the whitelist, a full server (a player already online is being reconfigured and keeps it) |
| `PlayerJoinEvent`                    | `LOWEST` | applies `onJoin`, so your own join handlers see its result       |
| `PlayerQuitEvent`                    | `MONITOR` | after your own quit handlers: applies `onLeave`, then saves the value in the background and forgets it, unless the player is back by then |

A player who logs in again before the save of their last session finished gets the cached value
back, and a duplicate login ("logged in from another location") shares the value of the old
session, so no change is lost between two sessions. A connection that drops between the login and
the join is noticed within two minutes, and its value saved and forgotten.

## Players already online {/* #players-already-online */}

A plugin enabled on a running server (a plugin manager, say) finds players who are already in.
Their values are loaded and claimed when the store starts, so `profiles[player]` works for them
at once, but `onJoin` is **not** applied: they did not join now. Keep `onJoin` to bringing the
value up to date, never rewards or messages, which would otherwise come twice or never:

```kotlin title="Wrong: onJoin with a side effect"
// error-next-line
onJoin = { player, profile -> player.sendMessage(text("Welcome back!")); profile.copy(coins = profile.coins + 10) },
```

```kotlin title="Right: onJoin updates the value; rewards and greetings go to your own join handler"
// fix-next-line
onJoin = { player, profile -> profile.copy(name = player.name) },
```

What `onJoin` would have done for the players already online belongs in a `PLUGIN_START_ONLY`
function, which runs once the store has loaded them:

```kotlin
@AutoInvoke(Phase.PLUGIN_START_ONLY)
fun catchUp(profiles: Profiles) = VersatiaEngine.onlinePlayers.forEach { player -> profiles.update(player) { it.copy(name = player.name) } }
```

## Saving {/* #saving */}

| When                    | What is written                                                       |
|-------------------------|-----------------------------------------------------------------------|
| a player quits          | their values in every player store, in one transaction, then they are forgotten |
| every `stores.autosave` (5 minutes) | every changed value of every store, in one transaction; `0` turns it off |
| every minute            | values nobody holds any more (players gone, and values of keyed stores or offline players untouched for `stores.idle-expiry`, 10 minutes) are saved and forgotten |
| the plugin stops        | `onLeave` is applied to everyone online, then every changed value is written, in one transaction |

:::admin

The server admin sets these timings, for one plugin or all of them; see
[Player data](/admin/database/operations#player-data) in the server admin guide.


:::

A new player's value is written at the next save, so a leaderboard query sees new players too.
To have the database up to date right now, before a query that reads it, call `saveAll()` and
continue in `then`:

```kotlin
profiles.saveAll().then { named("top-coins", "limit" to 10).list<TopEntry>() }.thenSync { top -> show(sender, top) }
```

## When a save fails {/* #when-a-save-fails */}

A value the database refuses to save stays changed in memory, so nothing is lost, and is written
again every 15 seconds until it is saved. The failure is logged at most once a minute per store:
`Saving profiles failed; 3 entries stay changed and are retried every 15 s; a player whose data stays unsaved for 1m is kicked: Connection refused`.

Once a value has failed for `stores.save-failure.after` (1 minute), `stores.save-failure.action` decides:

| `stores.save-failure.action` | What happens                                                                 |
|--------------------------|------------------------------------------------------------------------------|
| `kick` (default)         | the player whose value it is gets kicked with `messages.save-failed`, and a login of theirs is refused with it until the value is saved; the server keeps running and retrying, and once the database answers again the players come back to their data. A value of a keyed store is logged only |
| `warn`                   | logged only, as for data whose loss does not hurt                            |
| `shutdown`               | the server is stopped; what the final save cannot write is [kept in a file](#unsaved-values-at-a-stop) |

Nobody keeps playing on progress the database does not have, and nothing that is in memory is
thrown away: during an outage of the whole database every player with changes is kicked after the
after `stores.save-failure.after`, while their values wait in memory. A value that only one player's data breaks (a row the
database refuses) kicks that player alone.

```
[Shop] Kicked Steve (069a79f4-...): their profiles could not be saved for 1m; they may log in again once it is (stores.save-failure.action: kick)
```

:::admin

Which action suits a server is explained to the server admin in
[Player data](/admin/database/operations#player-data).


:::

## Unsaved values at a stop {/* #unsaved-values-at-a-stop */}

When the server stops while the database does not take a value, `/stop` during an outage or a
`shutdown` above, the final save fails too. The values it could not write are then kept in a file
of the plugin's folder, `plugins/Shop/unsaved/2026-10-30_12-01-00.yml`, and written to the database
at the next start, before any player can join:

```yaml title="plugins/Shop/unsaved/2026-10-30_12-01-00.yml"
plugin: Shop
database: MYSQL db.example.net:3306/survival, table prefix shop_
stopped: '2026-10-30T12:01:00Z'
stores:
  profiles:
  - value:
      uuid: 069a79f4-44e9-4726-a5be-fca90e38aaf5
      coins: '150'
    previous:              # the row as this server last read or wrote it; null for a new player
      uuid: 069a79f4-44e9-4726-a5be-fca90e38aaf5
      coins: '100'
```

A value is written back only where the database still has, in each column the value changes, what
`previous` says. Where another server or a tool changed one of those columns meanwhile (Steve played
on another server of the network, which saved `coins: 120`), the newer data stays and the value goes
to `unsaved/conflicts/` with the reason, for you to settle by hand:

```
[Shop] profiles {uuid=069a79f4-..., coins=150}: not written, the database changed coins since the stop; kept in plugins/Shop/unsaved/conflicts/2026-10-30_12-01-00.yml
```

A file is written back only to the database it was kept for (the `database` line: engine, location
and table prefix), so changing `database.yml` meanwhile leaves it waiting; remove a file to drop
its values.

| `stores.save-failure.keep-in-file` | Use it when                                                         |
|-------------------------------------|----------------------------------------------------------------------|
| `true` (default)                    | one server owns a player's data at a time: a single server, or a network where each server has its own database or a player's data never changes on two servers at once |
| `false`                             | several servers or tools change the same rows while this one is stopped, and an old value must never land in a row the database has not marked as changed: a value kept here is written over a row another server still holds unsaved in its memory, and that server's next save then overwrites only the columns it changed |

Only stores of a table keep their values this way; a store over your own `StoreSchema` logs them
at SEVERE, as before.

## Autosave events {/* #autosave-events */}

An autosave that has changed entries to write is announced by two Bukkit events of the package
`dev.versatia.database.store`, both called on the server thread:

| Event                     | When                         | Properties |
|---------------------------|------------------------------|------------|
| `StoreAutosaveStartEvent` | before the run starts        | `plugin` whose stores save, `stores` (the names of those with changes), `dirty` (changed entries) |
| `StoreAutosaveEndEvent`   | after it ended               | `plugin`, `saved` (entries written), `failed` (entries kept changed for the next one), `duration`, `failure` (the first error, or null) |

An autosave with nothing to write fires neither, and none fires once the plugin is disabled (the
final save at stop is no autosave). Every plugin's stores fire them, so a listener checks `plugin`:

```kotlin
class AutosaveNotices(private val plugin: MarketPlugin) : Listener {
    @EventHandler
    fun onStart(event: StoreAutosaveStartEvent) {
        if (event.plugin == plugin) VersatiaEngine.broadcast(text("Saving coins...", NamedTextColor.GRAY))
    }

    @EventHandler
    fun onEnd(event: StoreAutosaveEndEvent) {
        if (event.plugin == plugin) VersatiaEngine.broadcast(text("Saved ${event.saved} profiles in ${event.duration.inWholeMilliseconds} ms", NamedTextColor.GRAY))
    }
}
```

## Corner cases {/* #corner-cases */}

- **Before `HIGH`, a player's value is not loaded.** An `AsyncPlayerPreLoginEvent` handler at
  `LOWEST`, `LOW` or `NORMAL` runs before the store; read the value from `PlayerJoinEvent` on.
- **Your quit handlers see the value before `onLeave`**, which the store applies at `MONITOR`.
- **A reconfiguration keeps the value**: a `PlayerConnectionValidateLoginEvent` refused for a player
  who is already online lets go of nothing; the quit that follows applies `onLeave` and saves.
- **A plugin enabled on a running server** (a plugin manager) loads and claims the players already
  online, but does not apply `onJoin` to them: they did not join now. See
  [Players already online](#players-already-online).
- **The autosave events fire only for changed entries**: an autosave with nothing to write fires
  neither; the counts of the start event are those of the moment it fires, and a change made in
  between is written but not counted. The end event of a run never comes once the plugin is
  disabled, and an autosave the queue refuses ends at once with `saved` 0 and the refusal as `failure`.
- **An NPC has no value**: `profiles[npc]` fails; `profiles[npc.uniqueId]` is null.
- **A failed quit save keeps the values** of the player in every player store cached and changed;
  the autosave writes them later and then forgets them.
- **`stores.save-failure.after` counts from the first failure since the last successful write** of a value; a
  change made meanwhile does not restart it, and a successful write of the value ends it. A value
  that saves again lets its player log in at once, even after a kick.
- **`kick` concerns player stores only**: a failing value of a keyed store (a guild, say) is logged
  and retried, but kicks nobody, since no player owns it. `shutdown` counts values of every store.
- **A player kicked under `kick` keeps their data in memory**: the quit that follows does not
  forget the unsaved values, which are written once the database takes them and then forgotten.
- **`shutdown` stops the server once**, however many values keep failing, and only after
  `stores.save-failure.after`: a database restart shorter than `stores.save-failure.after` stops nothing.
- **A kept value is checked row by row**: when the database changed any column the value changes,
  the whole value goes to `unsaved/conflicts/`, also the columns that did not clash, so a row never
  mixes the two servers' changes. A value the database refuses at the start (a constraint) goes
  there too, with the database's message; the others are written.
- **A kept file waits for its database**: a file kept for another engine, location or table prefix
  stays untouched, with a warning at every start, until the plugin uses that database again.
- **A value of a store not made yet at the start** (a store made later than in a bean constructor)
  stays in the file for the next start.
