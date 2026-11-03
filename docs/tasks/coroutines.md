# Your own coroutines

import ExampleCard from '@site/src/components/ExampleCard';

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

<ExampleCard repo="VersatiaExample-Tasks-PluginScope" file="src/main/kotlin/dev/versatia/example/pluginscope/CombatTags.kt">
A combat tag per player as a coroutine of the plugin's own scope, kept in <code>KeyedJobs</code> so that every hit replaces the running timer.
</ExampleCard>

- **Launched on the server thread, a coroutine starts at once**: from an event handler, a command
  or a start function it runs up to its first suspension before `launch` returns; launched from
  another thread, it starts at the next tick. See [Threads](#threads).
- **A reload leaves the scope's coroutines alone**: a tag running with the old `duration` goes on;
  the next hit uses the new one. **The plugin's stop cancels them** before its stop functions run;
  see [Reload and stop](index.md#reload-and-stop).
- **A failing coroutine is logged** through the plugin's logger and the others go on; give a
  coroutine a `CoroutineName` and the log line names it.
- **One scope per plugin.** VersatiaCore exposes `PluginScope` as a
  [prototype](../dependency-injection/scopes.md#exposeprototype): every plugin injecting it gets its
  own, and so does every [module](../modules/index.md) prototype made for that plugin, which then runs
  its coroutines as the consumer's.
- **Cancel the jobs you launch, never the scope.** A cancelled scope runs nothing until the plugin
  restarts, and says so:
  `PluginScope was cancelled by plugin code, so nothing launched from it runs until the plugin restarts; cancel the jobs you launch, not the scope`.
  The pair below the list shows the difference.
- **Repeating work is a `BackgroundTask`**, not a launch from a `PLUGIN_RELOAD_OR_START` function:
  the scope survives the reload, so such a function would start a second copy at every reload.
  Launch from events, commands and `PLUGIN_START_ONLY` functions.

```kotlin title="Wrong: stops every coroutine of the plugin"
@LocalBean
class Countdown(private val scope: PluginScope) {
    fun start() = scope.launch { countDown() }

    // error-next-line
    fun stop() = scope.cancel()
}
```

```kotlin title="Right: cancels the job it launched"
@LocalBean
class Countdown(private val scope: PluginScope) {
    private var job: Job? = null

    fun start() {
        job = scope.launch { countDown() }
    }

    // fix-next-line
    fun stop() = job?.cancel()
}
```

## Keyed jobs {/* #keyed-jobs */}

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

## Per-player state {/* #per-player-state */}

State that lives only while the server runs, a combat tag, an open menu, a pending request, is a
`scope.perPlayer<T>()`: one value per player, thread-safe, that goes by itself when the player
quits.

```kotlin
@LocalBean
class Combat(scope: PluginScope) {
    private val tags = scope.perPlayer<Instant>(keepAfterQuit = 30.seconds)

    fun tag(player: Player) {
        tags[player] = Instant.now().plusSeconds(15)
    }

    fun isTagged(player: Player) = tags[player]?.isAfter(Instant.now()) == true
}
```

| Member                     | Does                                                         |
|----------------------------|--------------------------------------------------------------|
| `tags[player]`             | the player's value, or `null`                                |
| `tags[player] = value`     | sets it                                                      |
| `tags.remove(player)`      | removes it and returns it                                    |
| `player in tags`           | whether there is one                                         |
| `tags.getOrPut(player) { }` | the value, made by the block when there is none             |

A player's value goes when they quit, after the plugin's own quit handlers ran, so they can still
read it. With `keepAfterQuit` it goes that long after the quit instead, unless the player joins
again meanwhile: a combat tag that should punish a log-out survives it. A reload keeps the values;
the plugin's stop clears them and removes the listeners. Nothing is written anywhere: data that
must survive a restart belongs in a database or a file.

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

<ExampleCard repo="VersatiaExample-Tasks-Threads" file="src/main/kotlin/dev/versatia/example/threads/Greetings.kt">
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
| `recheckOn<E>(immediately = true) got ... on the thread ..., not the server thread; ...` | WARNING | once per event type; see [In the handler or at the next tick](conditions.md#in-the-handler-or-at-the-next-tick) |
| `PluginScope was cancelled by plugin code, so nothing launched from it runs until the plugin restarts; cancel the jobs you launch, not the scope` | WARNING | `scope.cancel()` |
| `1 coroutines were still running 5s after the plugin was disabled (stubborn); they are cancelled and finish when they next resume` | WARNING | the stop's wait ran out |
| `Plugin X is being disabled from inside a running coroutine, so its own coroutines finish only after that coroutine suspends, once the plugin is gone; disable plugins from a command or a listener, not from a coroutine` | WARNING | a coroutine disabled its own plugin |
| `A coroutine threw while running on the server thread`                                    | SEVERE  | a block failed outside any coroutine's own handling; the tick goes on |

The task line names the class; a coroutine of your own is named only with a `CoroutineName`, so
give the long-lived ones a name: `scope.launch(CoroutineName("combat-tag")) { }`. More causes and
fixes are in [Troubleshooting](../reference/troubleshooting.md#a-task-logs-a-failure).

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
- **A plugin's own `PluginScope` bean** shadows VersatiaCore's, and the start fails:
  `the PluginScope bean is C, not VersatiaCore's; background tasks and the stop order need VersatiaCore's`.
