# Background tasks

import ExampleCard from '@site/src/components/ExampleCard';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

Work that goes on over time, such as a broadcast every few minutes, a countdown or a combat tag, is
a Kotlin coroutine of the plugin. A class implementing `BackgroundTask` runs by itself as long as
the plugin does, and is restarted with the new values by every reload; nothing is scheduled,
remembered or cancelled by hand:

<CodeCards spares="the task handle, cancelling and rescheduling it at every reload, the period converted to ticks, the calls from `onEnable` and from the reload command">
<CodeCard title="AutoBroadcastTask.kt">

```kotlin
class AutoBroadcastTask(private val logger: Logger) : BackgroundTask {
    @Value("auto-broadcast.period")
    var period = 30.seconds

    @Value("auto-broadcast.lines")
    var lines = emptyList<String>()

    override suspend fun run() {
        if (lines.isEmpty()) {
            logger.info("No lines to broadcast; add some to config.yml and reload")
            return
        }
        logger.info("Broadcasting ${lines.size} lines every $period")
        val rotation = lines.cycle()
        every(period) { VersatiaEngine.broadcast(text(rotation.next())) }
    }
}
```

</CodeCard>
<CodeCard title="config.yml">

```yaml
auto-broadcast:
  period: 30s
  lines:
    - "Tip: edit config.yml and run /versatia reload broadcast"
    - "Background tasks start by themselves, one tick after the plugin"
```

</CodeCard>
<CodeCard title="Console" output>

```text
[Broadcast] Broadcasting 2 lines every 30s
Tip: edit config.yml and run /versatia reload broadcast
Background tasks start by themselves, one tick after the plugin
```

</CodeCard>
<CodeCard title="AutoBroadcast.java" bukkit>

```java
public final class AutoBroadcast {
    private final JavaPlugin plugin;
    private BukkitTask task;

    public AutoBroadcast(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    // called from onEnable and, after reloadConfig(), from the reload command
    public void start() {
        if (task != null) task.cancel();
        task = null;
        FileConfiguration config = plugin.getConfig();
        long seconds = config.getLong("auto-broadcast.period-seconds");
        if (seconds <= 0)
            throw new IllegalStateException("period-seconds is not positive");
        List<String> lines = config.getStringList("auto-broadcast.lines");
        if (lines.isEmpty()) {
            plugin.getLogger().info("No lines to broadcast; add some to config.yml and reload");
            return;
        }
        plugin.getLogger().info("Broadcasting " + lines.size()
                + " lines every " + seconds + "s");
        Iterator<String> rotation = Iterators.cycle(lines);
        long ticks = seconds * 20;
        task = plugin.getServer().getScheduler().runTaskTimer(plugin,
                () -> Bukkit.broadcast(text(rotation.next())), ticks, ticks);
    }
}
```

</CodeCard>
<CodeCard title="config.yml" bukkit>

```yaml
auto-broadcast:
  period-seconds: 30
  lines:
    - "Tip: edit config.yml and run /broadcastreload"
    - "Visit the shop with /shop"
```

</CodeCard>
<CodeCard title="Console" output bukkit>

```text
[Broadcast] Broadcasting 2 lines every 30s
Tip: edit config.yml and run /broadcastreload
Visit the shop with /shop
```

</CodeCard>
</CodeCards>

No bean scope is needed: the runtime creates the task with its constructor injected, here with the
plugin's [`Logger`](../dependency-injection/index.md#beans-every-plugin-has), and sets its `@Value`
properties.

<ExampleCard repo="VersatiaExample-Tasks-Background" file="src/main/kotlin/dev/versatia/example/background/AutoBroadcastTask.kt">
A <code>BackgroundTask</code> broadcasting the lines of <code>config.yml</code> at a period written as a duration, restarted with the new values by every reload.
</ExampleCard>

Everything here lives in `dev.versatia.task`, and the coroutines run on the
server thread, so Bukkit calls are safe in them. VersatiaAPI brings `kotlinx.coroutines`; see
[Installation](../getting-started/installation.md#pluginyml) for why your plugin must not add it.

| You want                                                        | Use                                                        |
|-----------------------------------------------------------------|------------------------------------------------------------|
| work that runs as long as the plugin: a broadcast, particles, an autosave | a [`BackgroundTask`](#background-tasks)          |
| work something starts: an event, a command                      | `scope.launch { }` on an [injected `PluginScope`](coroutines.md) |
| one job per player or arena, replaced by the next one           | [`scope.keyedJobs<K>()`](coroutines.md#keyed-jobs)                       |
| to wait for a state, or to run only while it holds              | a [`Condition`](conditions.md) with `awaitUntil`, `runOnceWhile` or `whenever` |
| to wait or repeat                                               | [`delayTicks`, `delay`, `everyTicks`, `every`](#ticks-and-time) |
| blocking I/O                                                    | [`withContext(Dispatchers.IO)`](coroutines.md#threads)                   |
| a plain Bukkit task                                             | the [scheduler helpers](../utilities/misc.md#scheduler)        |

Coroutines your code launches itself are on [Your own coroutines](coroutines.md), waiting for a
state or running only while it holds on [Conditions](conditions.md).

## Writing a task {/* #background-tasks */}

Every class of the plugin implementing `BackgroundTask` runs; there is nothing to register or to
annotate. Its `run()` is a `suspend` function called in the plugin's [`PluginScope`](coroutines.md):

```kotlin
interface BackgroundTask {
    suspend fun run()
}
```

| The task is…                                 | `run()` is called on                                                       |
|----------------------------------------------|-----------------------------------------------------------------------------|
| a bean (`@LocalBean`, `@ExposeSingleton`, …) | the bean itself                                                             |
| a plain class                                | an instance created once per plugin like a bean: one constructor, parameters injected, `@Qualifier` honoured, `@Value` properties set; it is not put into the container |
| an `object`                                  | the object                                                                  |
| the plugin's main class                      | the plugin instance                                                         |

A plain class that is also a [`Listener`](../events.md) is created once: the same instance is
registered and runs. A plain task may hold [`@Value`](../configuration/index.md) properties, in its body or
as constructor `var`s, without becoming a bean: they are set right after its constructor, before
its first run, and again at every reload before it restarts, as on a bean. Its other members take
no enhancements: an `@AutoInvoke` function needs a bean, an `object` or the main class.

| Event    | The task                                                                                   |
|----------|--------------------------------------------------------------------------------------------|
| `START`  | `run()` begins at the tick after the plugin started, so after its start functions          |
| `RELOAD` | the running call is cancelled once the new values are set and the `Reloadable` beans reloaded, before the reload functions run; a new call begins at the next tick, once the cancelled one has finished |
| `STOP`   | cancelled with every other coroutine of the plugin, before the stop functions run          |

`run()` may return: the task then rests until the next reload, as the empty list above does. One
that throws is logged with its class name and rests the same way; see [Failures](coroutines.md#failures). Each
call is a coroutine named after the class (`CoroutineName`), a child of the plugin's scope, so the
coroutines it launches are cancelled with it.

A task is therefore written for the values it sees when it begins and never watches for a reload:
reading `period` at the top of `run()` is enough, the next reload calls `run()` again. The
conventions: the class name ends in `Task` and the class lives in the package of the feature it
serves; see [Best practices](../reference/best-practices.md#naming).

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

A period in configuration is best a [`Duration`](../configuration/types.md#supported-types):
`@Value("period") var period = 30.seconds` reads `period: 30s`, `5m`, `1h 30m`, `500ms` or `PT5M`.
These helpers need the clock of a Versatia coroutine; called elsewhere, in a `runBlocking` or
`GlobalScope` coroutine, they fail with
`No server clock in this coroutine: launch it from an injected PluginScope or run it in a BackgroundTask; runBlocking and GlobalScope coroutines have none`.

## Reload and stop {/* #reload-and-stop */}

| What                                        | At a reload                                                    | At the stop                                   |
|---------------------------------------------|----------------------------------------------------------------|-----------------------------------------------|
| a `BackgroundTask`'s call                   | cancelled after the values are set and the `Reloadable` beans reloaded, before the reload functions; called again at the next tick | cancelled before the stop functions |
| coroutines launched from a `PluginScope`    | left alone                                                     | cancelled before the stop functions          |
| a condition made with `scope.condition`     | kept                                                           | its listeners go                             |
| the values of `scope.perPlayer`             | kept                                                           | cleared, its listeners go                    |
| a condition made in a coroutine             | goes with its coroutine                                        | goes with its coroutine                      |

A reload cancels a task's call, so its `finally` blocks run inside the reload, before the reload
functions; the new call waits until the cancelled one has finished. The stop goes in three steps:

1. Every coroutine of the plugin is cancelled. The runtime runs them on the server thread until
   all have finished or five seconds have passed, so their `finally` blocks run before anything
   else of the stop; ticks no longer pass for the plugin, and a `delayTicks` in a `finally` fails
   at once with `Plugin X is being disabled; no tick passes for it any more`.
2. The [`PLUGIN_STOP` functions](../lifecycle/phases.md#what-happens-at-stop) run.
3. The beans are closed.

Cleanup in a `finally` is therefore synchronous, or done in `withContext(NonCancellable +
Dispatchers.IO) { }` within those five seconds. What is still running after them is reported
(`2 coroutines were still running 5s after the plugin was disabled (...)`) and finishes when it
next resumes, after the plugin is gone.

## Switching it off {/* #switching-it-off */}

```kotlin
@DisableVersatiaFeatures(runBackgroundTasks = true)
class MyPlugin : VersatiaPlugin()
```

The plugin's `BackgroundTask`s are then never called; a task that is a bean is still created and
its values are still set. An injected `PluginScope` still works, but it is cancelled only when the
plugin's beans are closed, after the stop functions, so a stop function may meet coroutines that
are still running. Every feature a plugin inherits and its switch are listed under
[Enhancements on a base class](../internals/enhancements.md#enhancements-on-a-base-class).

## Migrating from Bukkit tasks {/* #migrating-from-bukkit-tasks */}

| Bukkit                                                              | Versatia                                                             |
|---------------------------------------------------------------------|----------------------------------------------------------------------|
| `runTaskTimer` in `onEnable`, cancelled and rescheduled by a reload command | a `BackgroundTask` with `everyTicks` or `every`; the reload restarts it |
| a `BukkitRunnable` subclass with `runTaskTimer(plugin, delay, period)` | `class XTask : BackgroundTask` whose `run()` calls `everyTicks(periodTicks, delayTicks) { }` |
| `runTaskAsynchronously` and a `runTask` back to the main thread      | `withContext(Dispatchers.IO) { }` around the blocking part only; the code after it is back on the server thread |
| a repeating task that checks a state on every tick                  | a `Condition` with `recheckOn` triggers, consumed by `whenever(condition) { }` |
| code at the start and end of that state, kept in flags              | the start of the `whenever` block and its `finally`                  |
| a countdown: a counter field decremented by a repeating task        | a `for` loop with `delayTicks` in `runOnceWhile`, launched in `KeyedJobs`; the code after the loop is the completion |
| a `Map<UUID, BukkitTask>` of per-player tasks                       | `scope.keyedJobs<UUID>()`: launching for a key replaces its job      |
| `task.cancel()`, `isCancelled()`, `Bukkit.getScheduler().isCurrentlyRunning(id)` | `job.cancel()` and `job.isActive`, or `jobs.cancel(key)` and `key in jobs` |

A timer kept from Bukkit habits survives the reload, so a reload function scheduling it adds one
more each time:

```kotlin title="Wrong: one more autosave timer at every reload"
object Autosave {
    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    // error-next-line
    fun start(plugin: JavaPlugin) = plugin.runTaskTimer(periodTicks = 6000) { save() }
}
```

```kotlin title="Right: a background task, restarted by the reload"
// fix-next-line
object AutosaveTask : BackgroundTask {
    override suspend fun run() {
        // fix-next-line
        every(5.minutes) { save() }
    }
}
```

The [scheduler helpers](../utilities/misc.md#scheduler) stay for plain Bukkit tasks: a one-off
`plugin.runTaskLater`, or an API that wants a `BukkitTask`. Bukkit cancels those when the plugin
is disabled, and a reload leaves them alone.

## Corner cases {/* #corner-cases */}

- **Disabling a plugin from one of its coroutines skips the wait.** Its coroutines finish only
  after that coroutine suspends, once the plugin is gone, and a warning says so; disable plugins
  from a command or a listener.
- **`@Value` in a plain task** is set before its first run and at every reload before it restarts,
  on the one instance the plugin creates; a broken file leaves the running values as they were.
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

## How it works {/* #how-it-works */}

`VersatiaPlugin` carries `@RunBackgroundTasks`, a
[subclass enhancement](../internals/enhancements.md#subclass-enhancements) for `BackgroundTask` that
also binds the plugin's `PluginScope` to its lifecycle. One Bukkit timer owned by VersatiaCore
drives every plugin's coroutines once per tick; the order within a tick, the dispatcher, the
conditions and the stop are described in [The runtime](../internals/runtime.md#tasks).
