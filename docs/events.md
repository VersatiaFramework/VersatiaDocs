---
description: 'Bukkit listeners registered automatically at start (which instance, when, how to switch it off) and the events the Versatia modules and plugins fire.'
---

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
    fun onJoin(event: PlayerJoinEvent) = event.player.sendMessage(greeter.greeting())
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

## Events Versatia fires {/* #events-versatia-fires */}

VersatiaCore fires no events of its own. Its modules and the plugins the Versatia team builds on it
fire these, each explained in the section it links; the plugins are
[experimental](/experimental/plugins).

| Event                              | Fired by             | When                                           | Explained in |
|------------------------------------|----------------------|------------------------------------------------|--------------|
| `StoreAutosaveStartEvent`          | Database module      | before an autosave with changed entries starts | [Autosave events](modules/database/player-stores.md#autosave-events) |
| `StoreAutosaveEndEvent`            | Database module      | after that autosave ended                      | [Autosave events](modules/database/player-stores.md#autosave-events) |
| `InteractionRequestSendEvent`      | VersatiaInteractions | before a request is sent                       | [Denying a request](/experimental/plugins/interactions#denying-a-request) |
| `InteractionRequestAcceptEvent`    | VersatiaInteractions | before a request is accepted                   | [Denying a request](/experimental/plugins/interactions#denying-a-request) |
| `InteractionRequestAcceptedEvent`  | VersatiaInteractions | after an accepted request's action started     | [How a request ends](/experimental/plugins/interactions#how-a-request-ends) |
| `InteractionRequestDeclinedEvent`  | VersatiaInteractions | after the receiver declined                    | [How a request ends](/experimental/plugins/interactions#how-a-request-ends) |
| `InteractionRequestExpiredEvent`   | VersatiaInteractions | after a request waited its whole time          | [How a request ends](/experimental/plugins/interactions#how-a-request-ends) |
| `InteractionRequestCancelledEvent` | VersatiaInteractions | after a request ended otherwise                | [How a request ends](/experimental/plugins/interactions#how-a-request-ends) |
| `TradeStartEvent`                  | VersatiaTrade        | before a trade opens                           | [Stopping a trade](/experimental/plugins/trade#stopping-a-trade) |
| `TradeItemOfferEvent`              | VersatiaTrade        | a player clicks an item to offer it            | [Keeping items out of trades](/experimental/plugins/trade#keeping-items-out-of-trades) |
| `TradeItemRenderEvent`             | VersatiaTrade        | a window shows an item the partner offers      | [Showing offered items](/experimental/plugins/trade#showing-offered-items) |
| `TradeCompletedEvent`              | VersatiaTrade        | after an exchange                              | [After a trade](/experimental/plugins/trade#after-a-trade) |
| `TradeCancelledEvent`              | VersatiaTrade        | after a trade ended without an exchange        | [After a trade](/experimental/plugins/trade#after-a-trade) |
| `PlayerRegionChangeEvent`          | VersatiaRegions      | before a player moves or teleports into other regions | [Events](/experimental/plugins/regions#events) |
| `PlayerRegionChangedEvent`         | VersatiaRegions      | after a player's regions changed               | [Events](/experimental/plugins/regions#events) |
| `RegionShapesChangedEvent`         | VersatiaRegions      | after a builder filled, cut or deleted regions | [Events](/experimental/plugins/regions#events) |
| `CharacterCreateEvent`              | VersatiaRpg-Characters | before a character is created in a free slot | [Events](/experimental/plugins/rpg/characters#events) |
| `CharacterSelectEvent`              | VersatiaRpg-Characters | before a player starts playing a character | [Events](/experimental/plugins/rpg/characters#events) |
| `CharacterCreatedEvent`             | VersatiaRpg-Characters | after a character was created | [Events](/experimental/plugins/rpg/characters#events) |
| `CharacterSelectedEvent`            | VersatiaRpg-Characters | after a player started playing a character | [Events](/experimental/plugins/rpg/characters#events) |
| `CharacterDeselectedEvent`          | VersatiaRpg-Characters | after a player left a character for another | [Events](/experimental/plugins/rpg/characters#events) |
| `CharacterDeletedEvent`             | VersatiaRpg-Characters | after an admin deleted a character | [Events](/experimental/plugins/rpg/characters#events) |
| `CharacterSkinChangeEvent`          | VersatiaRpg-Characters | before a player takes the skin of their look | [Skins](/experimental/plugins/rpg/characters#skins) |
| `LobbyEnteredEvent`                 | VersatiaRpg-Characters | after a player came to play no character | [Events](/experimental/plugins/rpg/characters#events) |
| `CharacterSlotShowEvent`            | VersatiaRpg-Characters | before a player in the lobby is shown the mannequin of a slot | [Events](/experimental/plugins/rpg/characters#events) |
| `StatsChangedEvent`                 | VersatiaRpg-Stats      | after a part or a reload of stats.yml changed an entity's stats | [Events](/experimental/plugins/rpg/stats#events) |
| `ItemCreateEvent`                   | VersatiaRpg-Items      | while new items of a type are made, before anyone gets them | [Values of your own](/experimental/plugins/rpg/items#values-of-your-own) |
| `ItemStatsEvent`                    | VersatiaRpg-Items      | whenever the stats of an item are read, off the server thread while a lore is rendered for a player | [Values of your own](/experimental/plugins/rpg/items#values-of-your-own) |
| `CombatStartEvent`                  | VersatiaRpg-Combat   | before a player enters combat mode             | [Events](/experimental/plugins/rpg/combat#events) |
| `CombatStartedEvent`                | VersatiaRpg-Combat   | after a player entered combat mode             | [Events](/experimental/plugins/rpg/combat#events) |
| `CombatEndedEvent`                  | VersatiaRpg-Combat   | after a player left combat mode                | [Events](/experimental/plugins/rpg/combat#events) |
| `SkillUseEvent`                     | VersatiaRpg-Skills     | before a player uses a skill that is ready | [Events](/experimental/plugins/rpg/skills#events) |
| `SkillUsedEvent`                    | VersatiaRpg-Skills     | after a player used a skill | [Events](/experimental/plugins/rpg/skills#events) |
| `SkillGrantedEvent`                 | VersatiaRpg-Skills     | after a player learned a skill | [Events](/experimental/plugins/rpg/skills#events) |
| `SkillRevokedEvent`                 | VersatiaRpg-Skills     | after a player forgot a skill | [Events](/experimental/plugins/rpg/skills#events) |
| `SkillIconShowEvent`                | VersatiaRpg-Skills     | before a skill's icon shows on a player's bar | [Events](/experimental/plugins/rpg/skills#events) |

## How it works {/* #how-it-works */}

`VersatiaPlugin` carries `@RegisterListeners`, a
[subclass enhancement](internals/enhancements.md#subclass-enhancements) for `Listener`: the
compile-time step records every matching class of the plugin as an element sent to
`RegisterListenersEnhancementProcessor` (`EventProcessors.REGISTER_LISTENERS`), with
`VersatiaPlugin` as the element's origin. The processor asks the plugin's `BeanResolver` for the
instance first and instantiates only when there is no such bean.
