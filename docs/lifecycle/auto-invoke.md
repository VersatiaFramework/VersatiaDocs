# Auto-invoked functions

`@AutoInvoke(phase)` marks a function the runtime calls at the given phase, with its parameters
injected from the beans. It is Versatia's replacement for `onEnable` and `onDisable`.

```kotlin
import com.github.marcoral.versatia.EventType
import com.github.marcoral.versatia.lifecycle.AutoInvoke

class MyPlugin : VersatiaPlugin() {

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    private fun start(clock: Clock) { /* ... */ }

    @AutoInvoke(EventType.PLUGIN_STOP)
    fun stop() { /* ... */ }
}
```

## Where a function may live

| Owner                   | Called on                                   |
|-------------------------|---------------------------------------------|
| the plugin's main class | the plugin instance                         |
| a Kotlin `object`       | the object                                  |
| a bean                  | the bean instance of that plugin            |

Anything else is a compile error: the runtime would have no instance to call the function on.

```kotlin
object Statistics {
    private var starts = 0

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    fun countStart() { starts++ }
}

@LocalBean
class StartupBanner(private val greeter: Greeter) {

    @AutoInvoke(EventType.PLUGIN_START_ONLY)
    fun show(clock: Clock) { /* uses greeter and clock */ }
}
```

## Parameters

Parameters are injected exactly like constructor dependencies of a bean: non-nullable, non-generic
class types; local beans first, then exposed ones; `@Qualifier` and `@Primary` apply. Ambiguity is a
compile error; a type no local bean provides is left to the runtime, which resolves it from the
beans other plugins exposed.

```kotlin
@AutoInvoke(EventType.PLUGIN_START_ONLY)
fun open(@Qualifier("grumpy") clerk: Greeter) { /* ... */ }
```

The plugin instance is a local bean as well, so a function in an `object` or a bean can receive
it without reaching for `JavaPlugin.getProvidingPlugin`:

```kotlin
object Metrics {
    @AutoInvoke(EventType.PLUGIN_START_ONLY)
    fun start(plugin: JavaPlugin) { plugin.logger.info("metrics on") }
}
```

## Rules

- Extension, `suspend`, abstract and generic functions are rejected. Return values are ignored.
- Visibility does not matter. A private function or class gets a reflective invoker in the
  descriptor, a visible one a direct call.
- Functions run **after every other processor of the event**, so at start all beans of the plugin
  already exist. Within one event they run in descriptor order: by class name, then by function
  name.
- A plugin's beans stay available for its whole lifetime, so functions at reload and stop receive
  the same instances that were created at start.

## Phases

| `EventType`              | The function runs at                 |
|--------------------------|--------------------------------------|
| `PLUGIN_START_ONLY`      | plugin enable                        |
| `PLUGIN_RELOAD_ONLY`     | a Versatia reload                    |
| `PLUGIN_RELOAD_OR_START` | both of the above                    |
| `PLUGIN_STOP`            | plugin disable                       |

The phase is per occurrence: `@AutoInvoke` declares `enhancementPhaseParamRefName = "phase"`, so
the processor reads it from each annotation. See [Phases and events](phases.md).

## Failures

An exception thrown by the function is wrapped in an `EnhancementException` naming the function and
the event, with the original as cause:

```
Plugin MyPlugin: com.example.MyPlugin.start() failed at START
```

At start this disables the plugin, like any failure in `onEnable`.
