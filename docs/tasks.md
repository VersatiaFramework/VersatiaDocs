# Tasks and coroutines

import ExampleCard from '@site/src/components/ExampleCard';

Work that goes on over time, such as a broadcast every few minutes, a countdown or a combat tag, is
a Kotlin coroutine of the plugin. A class implementing `BackgroundTask` runs by itself as long as
the plugin does, and is restarted with the new values by every reload; nothing is scheduled,
remembered or cancelled by hand:

```kotlin
@LocalBean
class AutoBroadcastTask(private val plugin: BackgroundPlugin) : BackgroundTask {
    @Value("auto-broadcast.period")
    var period = 30.seconds

    @Value("auto-broadcast.lines")
    var lines = emptyList<String>()

    override suspend fun run() {
        if (lines.isEmpty()) {
            plugin.logger.info("No lines to broadcast; add some to config.yml and reload")
            return
        }
        plugin.logger.info("Broadcasting ${lines.size} lines every $period")
        val rotation = lines.cycle()
        every(period) { VersatiaEngine.broadcast(text(rotation.next())) }
    }
}
```

```yaml
# config.yml
auto-broadcast:
  period: 30s
  lines:
    - "Tip: edit config.yml and run /versatia reload broadcast"
    - "Background tasks start by themselves, one tick after the plugin"
```

<ExampleCard repo="VersatiaExample-Tasks-Background" file="src/main/kotlin/com/github/marcoral/versatia/example/background/AutoBroadcastTask.kt">
A <code>BackgroundTask</code> broadcasting the lines of <code>config.yml</code> at a period written as a duration, restarted with the new values by every reload.
</ExampleCard>

Everything here lives in `com.github.marcoral.versatia.task`, and the coroutines run on the
server thread, so Bukkit calls are safe in them. VersatiaAPI brings `kotlinx.coroutines`; see
[Installation](getting-started/installation.md#pluginyml) for why your plugin must not add it.

| You want                                                        | Use                                                        |
|-----------------------------------------------------------------|------------------------------------------------------------|
| work that runs as long as the plugin: a broadcast, particles, an autosave | a [`BackgroundTask`](#background-tasks)          |
| work something starts: an event, a command                      | `scope.launch { }` on an [injected `PluginScope`](#your-own-coroutines) |
| one job per player or arena, replaced by the next one           | [`scope.keyedJobs<K>()`](#keyed-jobs)                       |
| to wait for a state, or to run only while it holds              | a [`Condition`](#conditions) with `awaitUntil`, `runOnceWhile` or `whenever` |
| to wait or repeat                                               | [`delayTicks`, `delay`, `everyTicks`, `every`](#ticks-and-time) |
| blocking I/O                                                    | [`withContext(Dispatchers.IO)`](#threads)                   |
| a plain Bukkit task                                             | the [scheduler helpers](utilities/misc.md#scheduler)        |

## Background tasks {/* #background-tasks */}

Every class of the plugin implementing `BackgroundTask` runs; there is nothing to register or to
annotate. Its `run()` is a `suspend` function called in the plugin's [`PluginScope`](#your-own-coroutines):

```kotlin
interface BackgroundTask {
    suspend fun run()
}
```

| The task is…                                 | `run()` is called on                                                       |
|----------------------------------------------|-----------------------------------------------------------------------------|
| a bean (`@LocalBean`, `@ExposeSingleton`, …) | the bean itself                                                             |
| a plain class                                | an instance created once per plugin like a bean: one constructor, parameters injected, `@Qualifier` honoured; it is not put into the container |
| an `object`                                  | the object                                                                  |
| the plugin's main class                      | the plugin instance                                                         |

A plain class that is also a [`Listener`](events.md) is created once: the same instance is
registered and runs. `@Value` properties need a bean, an `object` or the main class, so a plain
task class holding one is a compile error
(`Broadcasts.period cannot be enhanced: Broadcasts is neither the plugin's main class, an object nor a bean`);
make it a `@LocalBean`, as `AutoBroadcastTask` above is.

| Event    | The task                                                                                   |
|----------|--------------------------------------------------------------------------------------------|
| `START`  | `run()` begins at the tick after the plugin started, so after its start functions          |
| `RELOAD` | the running call is cancelled once the new values are set and the `Reloadable` beans reloaded, before the reload functions run; a new call begins at the next tick, once the cancelled one has finished |
| `STOP`   | cancelled with every other coroutine of the plugin, before the stop functions run          |

`run()` may return: the task then rests until the next reload, as the empty list above does. One
that throws is logged with its class name and rests the same way; see [Failures](#failures). Each
call is a coroutine named after the class (`CoroutineName`), a child of the plugin's scope, so the
coroutines it launches are cancelled with it.

A task is therefore written for the values it sees when it begins and never watches for a reload:
reading `period` at the top of `run()` is enough, the next reload calls `run()` again. The
conventions: the class name ends in `Task` and the class lives in the package of the feature it
serves; see [Best practices](reference/best-practices.md#naming).

## Your own coroutines {/* #your-own-coroutines */}

A bean, a listener or an auto-invoked function takes a `PluginScope` and launches from it. The
scope is a `CoroutineScope`, so `launch`, `async` and the rest of `kotlinx.coroutines` work as
usual:

```kotlin
@LocalBean
class CombatTags(scope: PluginScope) : Listener {
    @Value("combat-tag.duration")
    var duration = 10.seconds

    private val tags = scope.keyedJobs<UUID>()

    @EventHandler(ignoreCancelled = true)
    fun onDamage(event: EntityDamageByEntityEvent) {
        val player = event.entity as? Player ?: return
        if (event.damager !is LivingEntity) return
        tags.launch(player.uniqueId) {
            delay(duration)
            player.sendMessage(text("You are out of combat"))
        }
    }

    @EventHandler
    fun onQuit(event: PlayerQuitEvent) {
        if (tags.cancel(event.player.uniqueId)) event.player.health = 0.0
    }
}
```

<ExampleCard repo="VersatiaExample-Tasks-PluginScope" file="src/main/kotlin/com/github/marcoral/versatia/example/pluginscope/CombatTags.kt">
A combat tag per player as a coroutine of the plugin's own scope, kept in <code>KeyedJobs</code> so that every hit replaces the running timer.
</ExampleCard>

- **Launched on the server thread, a coroutine starts at once**: from an event handler, a command
  or a start function it runs up to its first suspension before `launch` returns; launched from
  another thread, it starts at the next tick. See [Threads](#threads).
- **A reload leaves the scope's coroutines alone**: a tag running with the old `duration` goes on;
  the next hit uses the new one. **The plugin's stop cancels them** before its stop functions run;
  see [Reload and stop](#reload-and-stop).
- **A failing coroutine is logged** through the plugin's logger and the others go on; give a
  coroutine a `CoroutineName` and the log line names it.
- **One scope per plugin.** VersatiaCore exposes `PluginScope` as a
  [prototype](dependency-injection/scopes.md#exposeprototype): every plugin injecting it gets its
  own, and so does every [module](modules/index.md) prototype made for that plugin, which then runs
  its coroutines as the consumer's.
- **Cancel the jobs you launch, never the scope.** A cancelled scope runs nothing until the plugin
  restarts, and says so:
  `PluginScope was cancelled by plugin code, so nothing launched from it runs until the plugin restarts; cancel the jobs you launch, not the scope`.
- **Repeating work is a `BackgroundTask`**, not a launch from a `PLUGIN_RELOAD_OR_START` function:
  the scope survives the reload, so such a function would start a second copy at every reload.
  Launch from events, commands and `PLUGIN_START_ONLY` functions.

### Keyed jobs {/* #keyed-jobs */}

`scope.keyedJobs<K>()` keeps at most one job per key, for state that belongs to a player, an
arena or a block. It is thread-safe.

| Member              | Does                                                                              |
|---------------------|-----------------------------------------------------------------------------------|
| `launch(key) { }`   | cancels the job of `key`, if any, then launches the block as its new job; returns the `Job` |
| `cancel(key)`       | cancels the job of `key`; `true` when one was running                             |
| `key in jobs`       | whether the job of `key` is still active                                          |
| `keys`              | the keys whose job has not completed yet                                          |
| `cancelAll()`       | cancels every job                                                                 |

An entry goes by itself when its job completes, so the map never holds finished jobs. The jobs are
children of the scope, so the plugin's stop cancels them too.

## Ticks and time {/* #ticks-and-time */}

| Call                                             | Waits                                                                      |
|--------------------------------------------------|----------------------------------------------------------------------------|
| `delayTicks(n)`, `delayTick()`                   | `n` server ticks, game time: a lagging server stretches it. `0` waits for the next tick, like `runTask`; a negative value is an error |
| `delay(duration)` (kotlinx)                      | wall-clock time; the coroutine resumes at the first tick after the deadline |
| `yield()`                                        | on the server thread, the next tick                                        |
| `everyTicks(periodTicks, delayTicks = periodTicks) { }` | runs the block at a fixed rate in ticks, the first time after `delayTicks` |
| `every(period, delay = period) { }`              | the same in wall-clock time                                                |

```kotlin
everyTicks(20) { spawnParticles() }                 // every second of game time, from one second on
everyTicks(10, delayTicks = 0) { spawnParticles() } // from now
every(5.minutes) { autosave() }                    // every five minutes of real time
```

The repeating helpers follow the same rules:

- **Fixed rate.** A slot missed while the block suspended, or during a lag spike, is skipped,
  never caught up; a slot due the moment the block returns runs at once.
- **A failing run does not end the loop.** It is logged and the next run follows on schedule; the
  same failure, the same exception class and message, is logged once until a run succeeds.
- **They never return** (their type is `Nothing`); the loop ends when the coroutine is cancelled, so
  code after them never runs. Put cleanup in a `finally`.
- **Arguments are checked**: `The period must be at least one tick, got 0`,
  `The delay must not be negative, got -1 ticks`, `The period must be positive, got 0s`. The
  tick helpers take an `Int` too, for a value read from configuration.

A period in configuration is best a [`Duration`](configuration.md#supported-types):
`@Value("period") var period = 30.seconds` reads `period: 30s`, `5m`, `1h 30m`, `500ms` or `PT5M`.
These helpers need the clock of a Versatia coroutine; called elsewhere, in a `runBlocking` or
`GlobalScope` coroutine, they fail with
`No server clock in this coroutine: launch it from an injected PluginScope or run it in a BackgroundTask; runBlocking and GlobalScope coroutines have none`.

## Conditions {/* #conditions */}

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

<ExampleCard repo="VersatiaExample-Tasks-Conditions" file="src/main/kotlin/com/github/marcoral/versatia/example/conditions/Teleports.kt">
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
class SpawnBeaconTask(private val plugin: ConditionsPlugin) : BackgroundTask {
    override suspend fun run() {
        val anyoneOnline = condition(recheckOn<PlayerJoinEvent>(immediately = true), recheckOn<PlayerQuitEvent>()) {
            VersatiaEngine.onlinePlayers.isNotEmpty()
        }
        whenever(anyoneOnline) {
            plugin.logger.info("Beacon on")
            try {
                everyTicks(10, delayTicks = 0) { spawnSparks() }
            } finally {
                plugin.logger.info("Beacon off")
            }
        }
    }
}
```

The condition belongs to the call of `run()`, so a reload, which cancels the call, takes its
listeners along and the next call makes a fresh one.

### Rechecks {/* #rechecks */}

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

### In the handler or at the next tick {/* #in-the-handler-or-at-the-next-tick */}

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

### Subject shorthands {/* #subject-shorthands */}

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

## Threads {/* #threads */}

The coroutines of a `PluginScope`, background tasks included, run on the server thread unless they
switch with `withContext`. Blocking work moves to a worker thread and comes back for the Bukkit
calls:

```kotlin
@LocalBean
class Greetings(private val plugin: ThreadsPlugin, private val scope: PluginScope) : Listener {
    @EventHandler
    fun onJoin(event: PlayerJoinEvent) {
        val player = event.player
        scope.launch {
            val motd = withContext(Dispatchers.IO) { plugin.dataFolder.resolve("motd.txt").readText().trim() }
            player.sendMessage(text(motd))   // back on the server thread
        }
    }
}
```

<ExampleCard repo="VersatiaExample-Tasks-Threads" file="src/main/kotlin/com/github/marcoral/versatia/example/threads/Greetings.kt">
A file read on a worker thread at every join with <code>withContext(Dispatchers.IO)</code>, and the message sent back on the server thread.
</ExampleCard>

| From                                         | To the server thread                                                   |
|----------------------------------------------|------------------------------------------------------------------------|
| a coroutine of the scope, after `withContext(Dispatchers.IO) { }` | by itself, at the next tick                       |
| plain code on another thread (an async event, a callback) | `scope.launch { }`: starts at the next tick              |
| a coroutine of another scope                 | `withContext(scope.serverThread) { }`                                   |
| a Java-style future                          | `future.thenAcceptAsync({ use(it) }, scope.serverThread.asExecutor())` |

`scope.serverThread` is the scope's dispatcher: in place when already on the server thread,
otherwise at the next tick. A server has no `Dispatchers.Main`; using it fails with
`Module with the Main dispatcher is missing`, so use the scope instead. Never block the server
thread: `Thread.sleep`, `runBlocking` or `future.get()` in a coroutine of the scope stop the whole
server, not only the coroutine.

## Reload and stop {/* #reload-and-stop */}

| What                                        | At a reload                                                    | At the stop                                   |
|---------------------------------------------|----------------------------------------------------------------|-----------------------------------------------|
| a `BackgroundTask`'s call                   | cancelled after the values are set and the `Reloadable` beans reloaded, before the reload functions; called again at the next tick | cancelled before the stop functions |
| coroutines launched from a `PluginScope`    | left alone                                                     | cancelled before the stop functions          |
| a condition made with `scope.condition`     | kept                                                           | its listeners go                             |
| a condition made in a coroutine             | goes with its coroutine                                        | goes with its coroutine                      |

A reload cancels a task's call, so its `finally` blocks run inside the reload, before the reload
functions; the new call waits until the cancelled one has finished. The stop goes in three steps:

1. Every coroutine of the plugin is cancelled. The runtime runs them on the server thread until
   all have finished or five seconds have passed, so their `finally` blocks run before anything
   else of the stop; ticks no longer pass for the plugin, and a `delayTicks` in a `finally` fails
   at once with `Plugin X is being disabled; no tick passes for it any more`.
2. The [`PLUGIN_STOP` functions](lifecycle/phases.md#what-happens-at-stop) run.
3. The beans are closed.

Cleanup in a `finally` is therefore synchronous, or done in `withContext(NonCancellable +
Dispatchers.IO) { }` within those five seconds. What is still running after them is reported
(`2 coroutines were still running 5s after the plugin was disabled (...)`) and finishes when it
next resumes, after the plugin is gone.

## Failures {/* #failures */}

Nothing a coroutine throws reaches Bukkit; the runtime logs it on the plugin's logger:

| Log line                                                                                  | Level   | When                                                     |
|-------------------------------------------------------------------------------------------|---------|----------------------------------------------------------|
| `Background task com.example.AutoBroadcastTask failed; it starts again at the next reload` | SEVERE  | `run()` threw; the stack trace follows                   |
| `Background task ... ended with TimeoutCancellationException although nobody cancelled it; it starts again at the next reload` | WARNING | a `CancellationException` left `run()` while nothing cancelled it, typically from `withTimeout`; use `withTimeoutOrNull` |
| `Background task ... is still finishing its previous run 5s after the reload cancelled it; the new run starts when it has` | WARNING | the cancelled call's `finally` takes long |
| `Coroutine combat-tag failed`, `A coroutine failed`                                       | SEVERE  | a coroutine launched from the scope threw; the name is its `CoroutineName`. ` after the plugin was disabled` is added when it ran after the stop |
| `Coroutine ...: a repeated run failed; it runs again on schedule, and the same failure is not logged again until a run succeeds` | SEVERE | a run of `everyTicks` or `every` threw |
| `A condition check failed; the condition keeps its last value, true`                      | SEVERE  | a check run for a trigger threw                          |
| `recheckOn<E>(immediately = true) got ... on the thread ..., not the server thread; ...` | WARNING | once per event type; see [In the handler or at the next tick](#in-the-handler-or-at-the-next-tick) |
| `PluginScope was cancelled by plugin code, so nothing launched from it runs until the plugin restarts; cancel the jobs you launch, not the scope` | WARNING | `scope.cancel()` |
| `1 coroutines were still running 5s after the plugin was disabled (stubborn); they are cancelled and finish when they next resume` | WARNING | the stop's wait ran out |
| `Plugin X is being disabled from inside a running coroutine, so its own coroutines finish only after that coroutine suspends, once the plugin is gone; disable plugins from a command or a listener, not from a coroutine` | WARNING | a coroutine disabled its own plugin |
| `A coroutine threw while running on the server thread`                                    | SEVERE  | a block failed outside any coroutine's own handling; the tick goes on |

The task line names the class; a coroutine of your own is named only with a `CoroutineName`, so
give the long-lived ones a name: `scope.launch(CoroutineName("combat-tag")) { }`. More causes and
fixes are in [Troubleshooting](reference/troubleshooting.md#a-task-logs-a-failure).

## Switching it off {/* #switching-it-off */}

```kotlin
@DisableVersatiaFeatures(runBackgroundTasks = true)
class MyPlugin : VersatiaPlugin()
```

The plugin's `BackgroundTask`s are then never called; a task that is a bean is still created and
its values are still set. An injected `PluginScope` still works, but it is cancelled only when the
plugin's beans are closed, after the stop functions, so a stop function may meet coroutines that
are still running. Every feature a plugin inherits and its switch are listed under
[Enhancements on a base class](internals/enhancements.md#enhancements-on-a-base-class).

## Migrating from Bukkit tasks {/* #migrating-from-bukkit-tasks */}

| Before                                                              | Now                                                                  |
|---------------------------------------------------------------------|----------------------------------------------------------------------|
| `runTaskTimer` in `onEnable`, cancelled and rescheduled by a reload command | a `BackgroundTask` with `everyTicks` or `every`; the reload restarts it |
| `object X : VersatiaBackgroundTask()` with `periodTicks()`, `delayTicks()` and `run()` | `class XTask : BackgroundTask` whose `run()` calls `everyTicks(periodTicks, delayTicks) { }` |
| `redeployOnReload()`                                                | always: every reload calls `run()` again                             |
| `asynchronous() = true`                                             | `withContext(Dispatchers.IO) { }` around the blocking part only      |
| `shouldBeRunning()` and `notifyConditionShouldBeChecked()` from listeners | a `Condition` with `recheckOn` triggers, consumed by `whenever(condition) { }` |
| `onConditionTurnedTrue()`, `onConditionTurnedFalse()`, `onStop()`   | the start of the `whenever` block and its `finally`                  |
| `VersatiaFiniteTask` with `totalStepsCount()`, `ticksBetweenSteps()`, `runStep()` and `onComplete()` | a `for` loop with `delayTicks` in `runOnceWhile`, launched in `KeyedJobs`; the code after the loop is the completion |
| a `VersatiaTask` created per request, its values in a static object | `scope.launch` from a bean holding the `@Value` properties          |
| `stop()`, `isRunning()`                                             | `job.cancel()` and `job.isActive`, or `jobs.cancel(key)` and `key in jobs` |

The [scheduler helpers](utilities/misc.md#scheduler) stay for plain Bukkit tasks: a one-off
`plugin.runTaskLater`, or an API that wants a `BukkitTask`. Bukkit cancels those when the plugin
is disabled, and a reload leaves them alone.

## Corner cases {/* #corner-cases */}

- **A launch from inside another coroutine may wait for it.** On the server thread a launch runs
  in place, but one made from inside a coroutine running there in place, started from a handler or
  resumed by a tick wait, is queued until that coroutine suspends: `scope.launch { }` then starts
  after the code that follows it. Start it with `CoroutineStart.UNDISPATCHED` when it must run at
  once.
- **What must affect an event happens before the first suspension.** A coroutine launched from a
  handler runs in place up to its first suspension, while the event is still being handled;
  `event.isCancelled = true` or a changed event field after a `delay` comes too late.
- **Blocking the server thread blocks the server.** `Thread.sleep`, `runBlocking` and
  `future.get()` in a coroutine of the scope freeze every plugin and the game; `runBlocking` waiting
  for the server thread deadlocks it.
- **A `withContext` in a `finally` of a cancelled coroutine throws when it returns.**
  `withContext(NonCancellable + Dispatchers.IO) { save() }` runs its block, but the cancelled caller
  then gets a `CancellationException` instead of the result, so code after it in the same `finally`
  does not run; wrap what must follow in a `try`/`finally` of its own.
- **Disabling a plugin from one of its coroutines skips the wait.** Its coroutines finish only
  after that coroutine suspends, once the plugin is gone, and a warning says so; disable plugins
  from a command or a listener.
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
- **A failing check** keeps the condition's last value and is logged when a trigger ran it; at
  creation and in `recheck()` on the server thread the exception reaches the caller.
- **A plain class that is a `Listener` and a `BackgroundTask` is one instance**, registered and run.
- **`delayTicks(0)` waits for the next tick**, never resumes in place, so a loop around it cannot
  freeze the server; a negative delay is an error.
- **Ticks are the server's, not the game's.** `delayTicks` counts the ticks that drive Bukkit's
  scheduler: `/tick rate` changes how long one lasts, and `/tick freeze`, which stops the game but not
  the server loop, does not stop them. `delay` and `every` count wall-clock time either way.
- **A task that returned or failed rests until the next reload**; nothing restarts it before.
- **A task's coroutines go with its call.** A reload cancels what `run()` launched as its children,
  while coroutines launched from the injected scope belong to the plugin and survive.
- **Ticks stop for a stopping plugin.** During the stop a `delayTicks` fails at once and a
  coroutine launched afterwards never runs.
- **A plugin's own `PluginScope` bean** shadows VersatiaCore's, and the start fails:
  `the PluginScope bean is C, not VersatiaCore's; background tasks and the stop order need VersatiaCore's`.

## How it works {/* #how-it-works */}

`VersatiaPlugin` carries `@RunBackgroundTasks`, a
[subclass enhancement](internals/enhancements.md#subclass-enhancements) for `BackgroundTask` that
also binds the plugin's `PluginScope` to its lifecycle. One Bukkit timer owned by VersatiaCore
drives every plugin's coroutines once per tick; the order within a tick, the dispatcher, the
conditions and the stop are described in [The runtime](internals/runtime.md#tasks).
