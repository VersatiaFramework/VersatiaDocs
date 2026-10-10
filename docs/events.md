# Event listeners

Every class of a Versatia plugin that implements Bukkit's `Listener` is registered when the plugin
starts. There is no `registerEvents` call to write and nothing to annotate:

```kotlin
class WelcomeListener(private val greeter: Greeter) : Listener {
    @EventHandler
    fun onJoin(event: PlayerJoinEvent) = event.player.sendMessage(greeter.greeting())
}
```

## Which instance is registered

| The listener is…                        | Registered instance                                                       |
|-----------------------------------------|---------------------------------------------------------------------------|
| a bean (`@LocalBean`, `@ExposeSingleton`, …) | the bean itself; nothing is created twice                              |
| a plain class                           | a new instance, created like a bean: one constructor, parameters injected, `@Qualifier` honoured; it is **not** put into the container |
| an `object`                             | the object                                                                |
| the plugin's main class                 | the plugin instance                                                       |

Abstract classes and interfaces extending `Listener` are skipped. A plain listener class obeys the
[bean declaration rules](dependency-injection/compile-time-checks.md#bean-declarations): exactly
one constructor, injectable parameters, no type parameters, no inner classes. Its dependencies are
checked at compile time like a bean's.

## When

Registration happens at `PLUGIN_START_ONLY`, once the plugin's beans exist and before its
[auto-invoked](lifecycle/auto-invoke.md) start functions run, so a start function may already fire
events the plugin listens to. Bukkit unregisters every listener of a plugin when it is disabled;
the runtime adds nothing to that.

## Switching it off

```kotlin
@DisableVersatiaFeatures(registerListeners = true)
class MyPlugin : VersatiaPlugin()
```

The plugin then registers its listeners itself, as any Bukkit plugin does.

## How it works

`VersatiaPlugin` carries `@RegisterListeners`, a
[subclass enhancement](internals/enhancements.md#subclass-enhancements) for `Listener`: the
compile-time step records every matching class of the plugin as an element sent to
`RegisterListenersEnhancementProcessor` (`EventProcessors.REGISTER_LISTENERS`), with
`VersatiaPlugin` as the element's origin. The processor asks the plugin's `BeanResolver` for the
instance first and instantiates only when there is no such bean.
