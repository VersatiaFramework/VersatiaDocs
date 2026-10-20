# Modules

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

VersatiaCore is a runtime, not a toolkit: it reads descriptors and runs processors, and the only
features it knows are beans, lifecycle phases, configuration values, resources, listeners and tasks. Everything else a plugin
uses day to day comes as a **module**: a plugin of its own, written against VersatiaAPI like any
other, that exposes a bean. A server installs the modules it needs next to VersatiaCore; a plugin
lists the ones it uses.

| Module   | Repository                                                                                  | What it gives you                                                 |
|----------|---------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| Messages | [VersatiaModule-Messages](https://github.com/VersatiaFramework/VersatiaModule-Messages)     | [a bank of messages per plugin](messages.md), read from its `messages/` directory and reloaded with it, in MiniMessage with runtime arguments: `{player.name}` |

## Using a module {/* #using-a-module */}

Every module follows the same three steps, shown here for Messages. With
[VersatiaStarter](../getting-started/installation.md#in-your-build) the first one is already done:
the starter exports the API of every module.

<Tabs>
<TabItem value="build-gradle-kts" label="build.gradle.kts">

```kotlin
dependencies {
    implementation("com.github.marcoral.versatia:VersatiaStarter:$versatiaVersion")
    ksp("com.github.marcoral.versatia:VersatiaAPI-ksp:$versatiaVersion")
}
```

The starter brings the module's API. A build that depends on `VersatiaAPI` alone adds the module
as `compileOnly("com.github.marcoral.versatia:VersatiaModule-Messages:0.0.1")`. Either way the API
is on the compile classpath only: on the server the classes come from the module's plugin, and
nothing the server provides goes into your JAR; see
[In your build](../getting-started/installation.md#in-your-build). The artifact holds the module's
API only; the implementation lives in the plugin JAR.

</TabItem>
<TabItem value="plugin-yml" label="plugin.yml">

```yaml
depend:
  - VersatiaCore
  - VersatiaModule-Messages
```

The module's plugin name is the repository name. Listing it guarantees the module is up before
your plugin and lets your class loader see its classes.

</TabItem>
<TabItem value="kotlin" label="Kotlin">

```kotlin
@LocalBean
class Shop(private val messages: Messages) {
    fun offer(player: Player, item: ItemStack) =
        messages["shop.offer"].send(player, arg("item", item), arg("price", 5))
}
```

Nothing marks the type as foreign: it is a dependency like any other.

</TabItem>
</Tabs>

On the server, drop the module's JAR (`VersatiaModule-Messages-0.0.1.jar`) into `plugins/` next to
VersatiaCore. Like VersatiaCore, modules are not on a Maven repository yet: build the module and
run `./gradlew publishToMavenLocal` in its checkout to get the artifact.

## One instance per plugin {/* #one-instance-per-plugin */}

A module exposes its entry point as an [`@ExposePrototype`](../dependency-injection/scopes.md#exposeprototype),
so every plugin that injects it gets an **instance of its own**: what your plugin registers on its
`Text` is invisible to other plugins, the instance disappears with your plugin, and a module that
keeps state for you, such as a bank of messages read from your data folder, is reloaded by
`/versatia reload <your plugin>` like your own beans, because it belongs to your plugin's bean
session. A prototype built on another one, from the same module or another (`Messages` takes
`Text`), receives, inside your instance, the instances made for your plugin as well.

## Writing a module {/* #writing-a-module */}

A module is an ordinary Versatia plugin. What makes it a module is a handful of rules; follow them
and the module fits the ecosystem.

- **The entry point is an `@ExposePrototype`** implementing an interface the consumer injects.
  Per-plugin state and registrations live in that instance.
- **Keep nothing in the module's own plugin.** No data folder, no logger, no reference to the
  main class: everything belongs to the consumer, reached through a parameter typed `JavaPlugin`
  (or `Plugin`), which a prototype receives as the consuming plugin. A prototype that only logs
  takes a `Logger` or `ComponentLogger` instead, and gets the consumer's; see
  [Beans every plugin has](../dependency-injection/index.md#beans-every-plugin-has).
- **Implement `Reloadable`** on the prototype when it reads anything from the consumer's data
  folder, and read it in `reload()`; see [Reloadable beans](../lifecycle/reload.md#reloadable-beans).
  This is what the hook exists for: a plugin's own files are `@Value` properties, a module's
  prototype has no other way to follow the consumer's reloads.
- **Two repositories, like VersatiaAPI and VersatiaCore.** `VersatiaModule-<Name>` is the public
  API, published as `com.github.marcoral.versatia:VersatiaModule-<Name>`: the interfaces, value
  types and exceptions a consumer sees. `VersatiaModule-<Name>Impl` is the implementation, private,
  all `internal`; it builds the plugin `VersatiaModule-<Name>-<version>.jar`, which carries the API
  classes as VersatiaCore carries VersatiaAPI. Consumers compile against the API alone, so the
  implementation can change without touching them.
- **Run coroutines in the consumer's scope.** A prototype that launches coroutines takes a
  `PluginScope` in its constructor and receives the consuming plugin's, so the consumer's stop
  cancels them and its logger reports their failures; see [Your own coroutines](../tasks.md#your-own-coroutines).
- **Report misuse with exceptions declared in `api`**, named after what went wrong and saying what
  was available, as the framework's own errors do.

The conventions are collected in [Best practices](../reference/best-practices.md#modules).
