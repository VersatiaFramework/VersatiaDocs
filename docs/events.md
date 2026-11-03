# Event listeners

import ExampleCard from '@site/src/components/ExampleCard';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

Every class of a Versatia plugin that implements Bukkit's `Listener` is registered when the plugin
starts. There is no `registerEvents` call to write and nothing to annotate:

<CodeCards spares="`registerEvents` for every listener, and creating what each listener needs">
<CodeCard title="WelcomeListener.kt">

```kotlin
class WelcomeListener(private val greeter: Greeter) : Listener {
    @EventHandler
    fun onJoin(event: PlayerJoinEvent) =
        event.player.sendMessage(greeter.greeting())
}
```

</CodeCard>
<CodeCard title="WelcomeListener.java" bukkit>

```java
public final class WelcomeListener implements Listener {
    private final Greeter greeter;

    public WelcomeListener(Greeter greeter) {
        this.greeter = greeter;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        event.getPlayer().sendMessage(greeter.greeting());
    }
}
```

</CodeCard>
<CodeCard title="MyPlugin.java" bukkit>

```java
public final class MyPlugin extends JavaPlugin {
    @Override
    public void onEnable() {
        var welcome = new WelcomeListener(new FriendlyGreeter());
        getServer().getPluginManager().registerEvents(welcome, this);
    }
}
```

</CodeCard>
</CodeCards>

<ExampleCard repo="VersatiaExample-Events-Listeners" file="src/main/kotlin/dev/versatia/example/listeners/Listeners.kt">
A plain listener with an injected bean and a listener that is itself a bean, both registered automatically.
</ExampleCard>

## Which instance is registered {/* #which-instance-is-registered */}

| The listener is…                        | Registered instance                                                       |
|-----------------------------------------|---------------------------------------------------------------------------|
| a bean (`@LocalBean`, `@ExposeSingleton`, …) | the bean itself; nothing is created twice                              |
| a plain class                           | a new instance, created like a bean: one constructor, parameters injected, `@Qualifier` honoured; it is **not** put into the container. Its [`@Value`](configuration/index.md) properties are set before it is registered and again at every reload. A class that is also a [`BackgroundTask`](tasks/index.md#background-tasks) is created once, and that instance both listens and runs |
| an `object`                             | the object                                                                |
| the plugin's main class                 | the plugin instance                                                       |

Abstract classes and interfaces extending `Listener` are skipped. A plain listener class obeys the
[bean declaration rules](reference/compile-time-checks.md#bean-declarations): exactly
one constructor, injectable parameters, no type parameters, no inner classes. Its dependencies are
checked at compile time like a bean's.

## When {/* #when */}

Registration happens at `PLUGIN_START_ONLY`, once the plugin's beans exist and before its
[auto-invoked](lifecycle/auto-invoke.md) start functions run, so a start function may already fire
events the plugin listens to. Bukkit unregisters every listener of a plugin when it is disabled;
the runtime adds nothing to that.

## Switching it off {/* #switching-it-off */}

<ExampleCard repo="VersatiaExample-Enhancements-FeatureSwitches" file="src/main/kotlin/dev/versatia/example/switches/SwitchesPlugin.kt">
A base plugin class switching extraction off and a main class switching listener registration off.
</ExampleCard>

```kotlin
@DisableVersatiaFeatures(registerListeners = true)
class MyPlugin : VersatiaPlugin()
```

The plugin then registers its listeners itself, as any Bukkit plugin does. Every feature a plugin
inherits and its switch are listed under
[Enhancements on a base class](internals/enhancements.md#enhancements-on-a-base-class).

## How it works {/* #how-it-works */}

`VersatiaPlugin` carries `@RegisterListeners`, a
[subclass enhancement](internals/enhancements.md#subclass-enhancements) for `Listener`: the
compile-time step records every matching class of the plugin as an element sent to
`RegisterListenersEnhancementProcessor` (`EventProcessors.REGISTER_LISTENERS`), with
`VersatiaPlugin` as the element's origin. The processor asks the plugin's `BeanResolver` for the
instance first and instantiates only when there is no such bean.
