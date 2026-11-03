# Conditions

import ExampleCard from '@site/src/components/ExampleCard';

A `Condition` is the last result of a check, evaluated again only when one of its events fires or
`recheck()` is called, never by polling, so the check may be expensive. It is a
`StateFlow<Boolean>`: `value` is the current result, and three helpers consume it.

| Helper                          | Does                                                                                   |
|---------------------------------|----------------------------------------------------------------------------------------|
| `awaitUntil(condition)`         | suspends until the condition is true; returns at once when it already is              |
| `runOnceWhile(condition) { }`   | runs the block once, cancelling it as soon as the condition turns false; returns whether it completed. A false condition never starts it |
| `whenever(condition) { }`       | starts the block when the condition turns true, cancels it when it turns false, starts it again when it turns true once more; never returns for a `Condition` |

```kotlin
@LocalBean
class Teleports(scope: PluginScope) : Listener {
    private val pending = scope.keyedJobs<UUID>()

    @EventHandler
    fun onInteract(event: PlayerInteractEvent) {
        if (!event.action.isRightClick || event.item?.type != Material.COMPASS) return
        val player = event.player
        val start = player.location
        pending.launch(player.uniqueId) {
            val stays = condition(recheckOn<PlayerMoveEvent>(player), recheckOn<PlayerQuitEvent>(player)) {
                player.isOnline && player.location.isWithin(1.5, start)
            }
            val stayed = runOnceWhile(stays) {
                for (left in 5 downTo 1) {
                    player.sendActionBar(text("Teleporting in $left s, stand still"))
                    delayTicks(20)
                }
            }
            when {
                stayed -> player.teleport(player.world.spawnLocation)
                player.isOnline -> player.sendMessage(text("Teleport cancelled: you moved"))
            }
        }
    }
}
```

<ExampleCard repo="VersatiaExample-Tasks-Conditions" file="src/main/kotlin/dev/versatia/example/conditions/Teleports.kt">
A teleport that waits for the player to stand still, cancelled by moving, and a background task lighting a beacon while anyone is online.
</ExampleCard>

A condition is made in one of two places:

| Made with                                   | Lives                                                                     |
|---------------------------------------------|---------------------------------------------------------------------------|
| `scope.condition(triggers…) { check }`      | as long as the plugin: its listeners go when the plugin stops             |
| `condition(triggers…) { check }` in a coroutine | as long as that coroutine: its listeners go when it completes, so one per request costs nothing once the request ends |

Both evaluate the check at once, on the server thread, which is also where a condition is made:
made on another thread it fails with
`A condition is created on the server thread, where its check runs; create it in a bean, a start function or a coroutine of the plugin`.
A condition is named after the state it describes (`stays`, `anyoneOnline`), without `is` and
without a `Condition` suffix.

`whenever` suits a background task that should run only in some state:

```kotlin
class SpawnBeaconTask(private val logger: Logger) : BackgroundTask {
    override suspend fun run() {
        val anyoneOnline = condition(recheckOn<PlayerJoinEvent>(immediately = true), recheckOn<PlayerQuitEvent>()) {
            VersatiaEngine.onlinePlayers.isNotEmpty()
        }
        whenever(anyoneOnline) {
            logger.info("Beacon on")
            try {
                everyTicks(10, delayTicks = 0) { spawnSparks() }
            } finally {
                logger.info("Beacon off")
            }
        }
    }
}
```

The condition belongs to the call of `run()`, so a reload, which cancels the call, takes its
listeners along and the next call makes a fresh one.

## Rechecks {/* #rechecks */}

A trigger is `recheckOn<E>()`: every event of type `E` that passes the filter makes the condition
check again.

```kotlin
recheckOn<PlayerMoveEvent>()                                          // every move
recheckOn<PlayerMoveEvent> { it.player.uniqueId == id }               // a filter
recheckOn<PlayerJoinEvent>(immediately = true)                        // checked in the handler
recheckOn<BlockBreakEvent>(priority = EventPriority.HIGH, ignoreCancelled = false)
```

| Parameter         | Default     | Means                                                              |
|-------------------|-------------|--------------------------------------------------------------------|
| `priority`        | `MONITOR`   | the priority of the listener behind the trigger                    |
| `ignoreCancelled` | `true`      | a cancelled event does not trigger                                 |
| `immediately`     | `false`     | check inside the handler instead of at the next tick               |
| `filter`          | every event | runs on the event's thread, so it must be cheap and thread-safe    |

By default the check runs **once, at the next tick, on the server thread, however many events
came**: a thousand moves in one tick cost one check. `condition.recheck()` checks by hand, right
after you change what the check reads: called on the server thread it updates `value` before it
returns, called from another thread it checks at the next tick.

## Closing a condition {/* #closing-a-condition */}

A condition made for one request belongs to that request's coroutine. Made with `scope.condition`,
it lives as long as the plugin instead:

```kotlin title="Wrong: a plugin-long condition per /home"
@LocalBean
class Homes(private val scope: PluginScope) {
    fun teleportHome(player: Player, home: Location) {
        val start = player.location.block
        // error-next-line
        val standsStill = scope.condition(recheckOn<PlayerMoveEvent>(player)) {
            player.location.block == start
        }
        scope.launch {
            if (runOnceWhile(standsStill) { delay(5.seconds) }) player.teleport(home)
        }
    }
}
```

```kotlin title="Right: the condition belongs to the coroutine"
@LocalBean
class Homes(private val scope: PluginScope) {
    fun teleportHome(player: Player, home: Location) {
        val start = player.location.block
        scope.launch {
            // fix-next-line
            val standsStill = condition(recheckOn<PlayerMoveEvent>(player)) {
                player.location.block == start
            }
            if (runOnceWhile(standsStill) { delay(5.seconds) }) player.teleport(home)
        }
    }
}
```

The first keeps its `PlayerMoveEvent` listener after the teleport, one more for every `/home` until
the plugin stops; the second loses it when the coroutine ends.

`condition.close()` ends a condition before its owner does: its events stop triggering it, rechecks
do nothing and `value` keeps the last result. A condition that must live outside a coroutine, such
as one per online player, is made with `scope.condition` and closed when its player leaves:

```kotlin title="Right: closed when the player leaves"
@LocalBean
class Grounded(private val scope: PluginScope) : Listener {
    private val conditions = mutableMapOf<UUID, Condition>()

    fun of(player: Player) = conditions.getValue(player.uniqueId)

    @EventHandler
    fun onJoin(event: PlayerJoinEvent) {
        val player = event.player
        conditions[player.uniqueId] = scope.condition(recheckOn<PlayerMoveEvent>(player)) { player.isOnGround }
    }

    @EventHandler
    fun onQuit(event: PlayerQuitEvent) {
        // fix-next-line
        conditions.remove(event.player.uniqueId)?.close()
    }
}
```

A `Condition` is `AutoCloseable`, so `use { }` closes one at the end of a block:

```kotlin
scope.condition(recheckOn<PlayerMoveEvent>(player)) { player.isOnGround }.use { grounded ->
    awaitUntil(grounded)
}
```

## In the handler or at the next tick {/* #in-the-handler-or-at-the-next-tick */}

Most Bukkit events fire **before** their change is applied, so a check run inside the handler
would still see the old state. That is why the default waits for the next tick; `immediately =
true` is for the events that fire after their change.

| Event                     | Fires                                       | Trigger                                        |
|---------------------------|---------------------------------------------|------------------------------------------------|
| `PlayerMoveEvent`         | before the move: the player is still at the old location | `recheckOn<PlayerMoveEvent>(player)`  |
| `PlayerQuitEvent`         | before the player is removed: still online  | `recheckOn<PlayerQuitEvent>()`                 |
| `EntityDamageEvent`       | before the damage: the health is unchanged  | `recheckOn<EntityDamageEvent>(entity)`         |
| `BlockBreakEvent`         | before the block is removed                 | `recheckOn<BlockBreakEvent>(block)`            |
| `PlayerJoinEvent`         | after the player is added: online           | `recheckOn<PlayerJoinEvent>(immediately = true)` |
| `PlayerChangedWorldEvent` | after the player arrived in the new world   | `recheckOn<PlayerChangedWorldEvent>(player, immediately = true)` |
| `AsyncChatEvent` and other asynchronous events | on another thread      | `recheckOn<AsyncChatEvent>()`: checked at the next tick on the server thread |

A check never runs off the server thread. An `immediately` trigger whose event fires on another
thread is checked at the next tick as well, and the first such event logs a warning:
`recheckOn<AsyncChatEvent>(immediately = true) got AsyncChatEvent on the thread ..., not the server thread; conditions are always checked on the server thread, so it is checked at the next tick instead. Remove immediately = true for this event`.

## Subject shorthands {/* #subject-shorthands */}

A trigger limited to one player, entity or block takes it as the first argument; the event type
picks the subject, and the other parameters are those of `recheckOn<E>()`:

| Shorthand                          | For events of type     | Matches                                                  |
|------------------------------------|------------------------|----------------------------------------------------------|
| `recheckOn<E>(player)`             | `PlayerEvent`          | the player's UUID, so a player who rejoined still counts |
| `recheckOn<E>(entity)`             | `EntityEvent`          | the entity's UUID; `recheckOn<EntityDamageEvent>(player)` is the damage of a player |
| `recheckOn<E>(vehicle)`            | `VehicleEvent`         | the vehicle's UUID                                       |
| `recheckOn<E>(hanging)`            | `HangingEvent`         | the item frame's or painting's UUID                      |
| `recheckOn<E>(block)`              | `BlockEvent`           | the same world and position                              |
| `recheckOn<E>(inventory)`          | `InventoryEvent`       | the same inventory, such as clicks in one menu and its closing |
| `recheckOn<E>(world)`              | `WorldEvent`           | the world's UUID                                         |

Weather events are `WeatherEvent`s, not `WorldEvent`s, and a second `World` shorthand for them
would clash with the first; they take the filter form,
`recheckOn<WeatherChangeEvent> { it.world == world }`.

## Corner cases {/* #corner-cases */}

- **A condition is a state, not a stream of events.** Changes that cancel each other out before
  the check runs are not seen: a player who leaves the area and comes back within one tick never
  made `stays` false.
- **The check at the next tick sees the change; the one in the handler does not.** A moving player
  is still at the old location during `PlayerMoveEvent`, a quitting one still online during
  `PlayerQuitEvent`; `recheckOn<PlayerQuitEvent>(immediately = true)` would still count them online.
- **An `immediately` trigger on an asynchronous event** is checked at the next tick, with one
  warning per event type.
- **Weather events take the filter form**, `recheckOn<WeatherChangeEvent> { it.world == world }`.
- **Rechecks come before timers.** Within one tick the rechecks run before the tick waits end, so a
  condition turning false in the tick a countdown ends cuts the countdown short.
- **A failing check** reaches the caller at creation and in `condition.recheck()` called on the
  server thread, while a recheck run by a trigger logs the exception and keeps the condition's last
  value.
- **`scope.condition(...)` lives as long as the plugin**, listeners included, so one made per player
  or per request piles up until the plugin stops. Close it with `condition.close()` when its player
  leaves, or make it with `condition(...)` inside the request's coroutine, which closes it when it
  ends.
- **A closed condition** keeps its last `value`; `recheck()` and its triggers do nothing, a recheck
  already queued for the next tick is dropped, and closing it again does nothing. `close()` may be
  called from any thread.
