---
title: Stores and player stores
description: Write-behind caches of rows, the login and quit of a player, what a save writes, and store transactions.
---

# Stores and player stores

import Audience from '@site/src/components/Audience';

<Audience who="developer" below />

A **store** is a write-behind cache of rows: values are immutable instances of a class, read and
replaced in memory on any thread, and written to the database in the background, column by
column, only where they changed. A **player store** is a store keyed by player UUID that follows
the players: loaded before a player joins, saved when they quit.

| Store operation                                     | Touches                                                 |
|-----------------------------------------------------|---------------------------------------------------------|
| `get`, `getValue`, `set`, `update`, `tryUpdate`, `contains`, `keys` | memory only; safe from any thread, the server thread included |
| `load`, `save`, `saveAll`, `evict`, `delete`, `transaction` | the database, on your plugin's database threads; they return a [`DatabaseFuture`](background.md#background-work) |

## Player stores {/* #player-stores */}

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

### The login {/* #the-login */}

A player never plays on default data: the value is loaded while the server is still deciding
whether to let them in, and a login whose data cannot be loaded is refused.

| Event                       | Priority | The store                                                      |
|-----------------------------|----------|----------------------------------------------------------------|
| `AsyncPlayerPreLoginEvent`  | `HIGH`, if still allowed | loads the value (or uses the one still cached from a recent session), waiting at most `stores.login-timeout`; when that fails, refuses the login with `messages.load-failed` and logs `Refused the login of Steve (069a79f4-...): profiles could not be loaded (...)`; while the plugin stops, refuses it with `messages.closing` |
| `AsyncPlayerPreLoginEvent`  | `MONITOR` | when a later handler refused the login, lets go of the value; a value with no unsaved change, or one just created for a new player, is dropped |
| `PlayerLoginEvent`          | `MONITOR` | the same, for a refusal there: a ban, the whitelist, a full server |
| `PlayerJoinEvent`           | `LOWEST` | applies `onJoin`, so your own join handlers see its result       |
| `PlayerQuitEvent`           | `MONITOR` | after your own quit handlers: applies `onLeave`, then saves the value in the background and forgets it, unless the player is back by then |

A player who logs in again before the save of their last session finished gets the cached value
back, and a duplicate login ("logged in from another location") shares the value of the old
session, so no change is lost between two sessions. A connection that drops between the login and
the join is noticed within two minutes, and its value saved and forgotten.

### Players already online {/* #players-already-online */}

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

### Saving {/* #saving */}

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

### When a save fails {/* #when-a-save-fails */}

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

### Unsaved values at a stop {/* #unsaved-values-at-a-stop */}

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

### Autosave events {/* #autosave-events */}

An autosave that has changed entries to write is announced by two Bukkit events of the package
`com.github.marcoral.versatia.database.store`, both called on the server thread:

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

## Keyed stores {/* #keyed-stores */}

`database.store(table, key) { create }` is a store of any key, loaded on demand:

```kotlin
import com.github.marcoral.versatia.database.store

data class Guild(val id: Long, val name: String = "", val bank: Long = 0)

@LocalBean
class Guilds(database: Database) : KeyedStore<Long, Guild> by database.store("guilds", Guild::id) { Guild(it) }
```

| On a store                    | Does                                                              |
|-------------------------------|-------------------------------------------------------------------|
| `load(key)`                   | the cached value, or the row, or `create(key)` when there is none; cached from then on |
| `store[key]`, `getValue(key)` | the cached value; null, or an `EntryNotLoadedException`, when it is not loaded |
| `update(key) { }`, `tryUpdate(key) { }` | replaces a loaded value with its change; `tryUpdate` lets the change refuse by returning null |
| `store[key] = value`          | replaces the value; a key that is not loaded becomes a new value, written as an upsert at the next save |
| `save(key)`, `saveAll()`      | writes the change of one key, or of every key (returning how many were written) |
| `evict(key)`                  | saves the key if it changed, then forgets it, unless it changed again meanwhile |
| `delete(key)`                 | deletes the row and forgets the key, with the rows that [extend it](#stores-that-reference-each-other) |

A value made by `create` is written only once it is changed: looking a guild up never inserts it.
Values nobody touched for `stores.idle-expiry` are saved and forgotten, and loaded again by the
next `load`. `update` and `tryUpdate` of a key that is not loaded fail with
`Plugin Shop: guilds has not loaded 7; load it first with guilds.load(key)`:

```kotlin title="Wrong: the guild may not be cached"
// error-next-line
guilds.update(id) { it.copy(bank = it.bank + amount) }
```

```kotlin title="Right"
// fix-next-line
guilds.load(id).thenSync { guilds.update(id) { it.copy(bank = it.bank + amount) } }
```

## What a save writes {/* #what-a-save-writes */}

A store compares each changed value with the value last written:

| The value                          | Statement                                                    |
|------------------------------------|--------------------------------------------------------------|
| never written (created, or set for a key not loaded) | an upsert of every column                  |
| changed since it was written       | `UPDATE profiles SET coins = ? WHERE uuid = ?`, only the columns that differ; an upsert when the row is gone |
| set to an equal value              | nothing                                                      |

Values whose changed columns are the same go into one JDBC batch, and loading the online players
at start reads them in chunks of 500. Saves write absolute values, so a save retried after a lost
acknowledgement writes the same thing twice and never adds twice.

Since a save is a diff of whole values, values must be **immutable**: change them with `copy`, never
by mutating a property of the cached instance, which the store would neither see nor save.

## Stores that reference each other {/* #stores-that-reference-each-other */}

A table may point to another store's table with a foreign key, as statistics kept apart from the
profile they belong to:

```sql title="V2__create_statistics.sql"
CREATE TABLE {prefix}statistics (
    uuid  {uuid} NOT NULL PRIMARY KEY REFERENCES {prefix}profiles (uuid),
    kills BIGINT NOT NULL DEFAULT 0
) {table_options};
```

The stores read the foreign keys between their tables when the database opens and keep to them,
whatever order your beans make the stores in:

| When                  | What the stores do                                                     |
|-----------------------|------------------------------------------------------------------------|
| every save            | `profiles` rows before `statistics` rows, so a new player's profile exists before the row that points to it |
| a player quits        | both values of the player go in one transaction: both are written, or neither |
| a save fails          | the other keys are still written; the values of the failing key stay changed in both stores, for the next save |
| `statistics.save(key)`, `saveAll()`, `evict(key)`, `statistics.transaction(...)` | write the never-written values of `profiles` first, so new players need no autosave before them |
| `profiles.delete(uuid)` | deletes the `statistics` row of the same `uuid` first, in the same transaction, and forgets both values |
| `statistics.delete(uuid)` | deletes the `statistics` row only                                  |

A delete takes along only the rows that extend a row one to one: those of stores whose key column
references the deleted store's key column, as `statistics.uuid` does. Rows that point to a row
from another column (`members.guild REFERENCES guilds (id)`) are left to the database: without
`ON DELETE` it refuses the delete while they exist ([Corner cases](corner-cases.md#stores)).

A table that extends another store's row this way is a [best practice](best-practices.md#extension-references-key):
the stores then write and delete the two together.

## Store transactions {/* #store-transactions */}

`store.transaction(keys) { }` changes several values and runs SQL in **one database transaction**,
for online and offline players alike; the cached values change only if it commits:

```kotlin
import com.github.marcoral.versatia.database.store.get
import com.github.marcoral.versatia.database.store.update

data class Payment(val id: Long = 0, val payer: UUID, val payee: UUID, val coins: Long, val note: String)

fun payBounty(victim: Player, killer: Player): DatabaseFuture<Payment?> = profiles.transaction(victim, killer, retries = 2) {
    val bounty = this[victim].coins / 10
    if (bounty == 0L) return@transaction null
    update(victim) { it.copy(coins = it.coins - bounty) }
    update(killer) { it.copy(coins = it.coins + bounty) }
    insertReturning("payments", Payment(payer = victim.uniqueId, payee = killer.uniqueId, coins = bounty, note = "bounty"))
}
```

- The transaction **holds** its keys: two transactions on the same key run one after the other,
  and saves skip a held key until it is released.
- `this[key]` is the value as the transaction found it; a key that is not cached is loaded, or
  created, and stays cached afterwards. `this[key] = value` is written at once, in the transaction,
  and `update(key) { ... }` does both in one call, returning the new value. In a player store, a
  `Player` or `OfflinePlayer` stands for its UUID in all three (imports from
  `com.github.marcoral.versatia.database.store`).
- The receiver runs SQL like any [transaction](background.md#transactions) (`sql`, `insert`,
  `afterCommit`, ...), all in the same database transaction.
- **On commit** the written values become the cached ones. Changes made meanwhile on the server
  thread, a kill reward through `update`, are applied again on top of them, so none is lost or
  counted twice; `get` sees such a change at once.
- **On rollback** the cached values keep those changes and nothing of the transaction.
- While a key is held, `tryUpdate` refuses (returns null): a change that may refuse cannot be
  re-applied on top of a result that is not known yet. Retry it a moment later.
- With `retries`, a deadlock reruns the block from the values as they were when the keys were taken.

Every key the block uses must be passed to `transaction(...)`:

```kotlin title="Wrong: fails with this profiles.transaction does not hold ...; pass every key it uses to transaction(...)"
// error-next-line
profiles.transaction(buyer) {
    this[buyer.uniqueId] = this[buyer.uniqueId].let { it.copy(coins = it.coins - price) }
    this[seller.uniqueId] = this[seller.uniqueId].let { it.copy(coins = it.coins + price) }
}
```

```kotlin title="Right"
// fix-next-line
profiles.transaction(buyer, seller) {
    this[buyer.uniqueId] = this[buyer.uniqueId].let { it.copy(coins = it.coins - price) }
    this[seller.uniqueId] = this[seller.uniqueId].let { it.copy(coins = it.coins + price) }
}
```

## Raw SQL and cached rows {/* #raw-sql-and-cached-rows */}

A store owns the rows it has cached: the next save writes its value over whatever SQL changed in
the meantime. Change cached rows through the store (`update`, `set`, `transaction`), never with raw
SQL; raw SQL on rows that are not loaded is fine, and reading is always fine.

```kotlin title="Wrong: the next save of Steve's profile writes the old coins back"
// error-next-line
database.async { sql("UPDATE {prefix}profiles SET coins = coins + 10 WHERE uuid = :uuid", "uuid" to steve.uniqueId).update() }
```

```kotlin title="Right"
// fix-next-line
profiles.update(steve) { it.copy(coins = it.coins + 10) }
```

For the same reason a store operation that reaches the database is refused inside your own
`transaction { }`; a [store transaction](#store-transactions) is the transaction that may hold store
values.

## The table {/* #the-table */}

A store of a class keeps it in the table named by its first argument, under your prefix. The class
needs a primary constructor whose parameters are all properties (`val`), the key among them; each
property is a column, named as in [mapping](statements.md#reading-rows) and stored as its
[type](statements.md#types) says. The store checks this, and the table itself, when the database
opens, so a missing migration fails the start instead of the first save:

| Problem                                    | Message                                                    |
|--------------------------------------------|------------------------------------------------------------|
| no table                                   | `Plugin Shop: table profiles does not exist, but store profiles keeps its Profile rows there; add a migration that creates it` |
| a property without a column                | `Plugin Shop: table profiles has no column for Profile.lastSeen (looked for last_seen); add a migration` |
| the key column not unique                  | `Plugin Shop: column uuid of table profiles is neither its primary key nor a unique key, so store profiles cannot find rows by Profile.uuid; add a migration that makes it the primary key` |
| a constructor parameter that is no property | `Plugin Shop: Profile.rank is a constructor parameter but not a property; make it a val` |
| a `var` property                           | `Plugin Shop: store profiles keeps Profile, whose property coins is a var; make it a val and change values with profiles.update(key) { it.copy(coins = ...) }, since store values must be immutable` |
| a mutable collection type                  | `Plugin Shop: store profiles keeps Profile, whose property homes has the mutable type MutableList; declare it as List and change values with profiles.update(key) { it.copy(homes = ...) }, since store values must be immutable` |

Once checked, the store names the table and its columns as the database stores them, so
`@Column(name = "lastSeen")` reaches a column created as `lastSeen`, which PostgreSQL and H2 keep as
`lastseen`.

Each store has its own table: a second store of the same name fails with
`Plugin Shop: a store named profiles already exists; give each store its own table (or StoreSchema.name)`.

Stores are made in bean constructors, so they exist before the database opens; the database opens
at start whenever a store exists. A store made later, in a `PLUGIN_START_ONLY` function for
example, is checked and starts at once, loading the players already online (without `onJoin`). Its other operations
(`load`, `save`, `transaction`...) need the open database and fail in a constructor with
`Plugin Shop: its stores are used before its database opened; use them from a PLUGIN_RELOAD_OR_START function or later`.

## Your own layout {/* #your-own-layout */}

When one table per class does not fit (a value spread over several tables, a custom format), a
`StoreSchema` says how values are read and written, and `database.store(schema)` or
`database.playerStore(schema, onJoin, onLeave)` makes the store. Its functions run on the database
threads, inside the store's transactions:

```kotlin
import com.github.marcoral.versatia.database.store.StoreSchema

object Wallets : StoreSchema<UUID, Wallet> {
    override val name = "wallets"
    override fun load(sql: SqlScope, key: UUID) =
        sql.sql("SELECT currency, amount FROM {prefix}wallet_entries WHERE owner = :owner", "owner" to key)
            .list { row -> row.string("currency") to row.long("amount") }
            .takeIf { it.isNotEmpty() }?.let { Wallet(key, it.toMap()) }
    override fun create(key: UUID) = Wallet(key, emptyMap())
    override fun save(sql: SqlScope, key: UUID, value: Wallet, previous: Wallet?) {
        sql.sql("DELETE FROM {prefix}wallet_entries WHERE owner = :owner", "owner" to key).update()
        value.amounts.forEach { (currency, amount) -> sql.insert("wallet_entries", mapOf("owner" to key, "currency" to currency, "amount" to amount)) }
    }
}
```

`previous` is the value last written (null when it never was), for partial updates; `loadAll` and
`saveAll` may be overridden to read and write many keys at once, and `delete` to support
`store.delete(key)`, which fails otherwise.

## Lock waits {/* #lock-waits */}

Operations on the same key take turns. A save, a load or a store transaction that waits longer than
`stores.lock-timeout` (30 s) for a key fails with
`Plugin Shop: profiles could not lock 069a79f4-... within 30s; a store transaction or save holds it (stores.lock-timeout in database.yml)`.
A login waits at most `stores.login-timeout` (10 s), since the player is waiting, and is refused
after it. Autosave and the minute's cleanup never wait: they skip a busy key until their next run.
