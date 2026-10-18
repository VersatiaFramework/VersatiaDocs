# Commands

Versatia has no command annotation: a plugin declares its commands with the
[CommandAPI](https://commandapi.dev/) Kotlin DSL, inside an `object` whose auto-invoked functions
register the command at start and remove it at stop. CommandAPI stays a soft dependency, so the
plugin runs without it and only the command is missing.

```kotlin
package com.example.shop.command

import com.example.shop.PriceList
import com.example.shop.ShopPlugin
import com.github.marcoral.versatia.ConditionalOnPlugin
import com.github.marcoral.versatia.Phase
import com.github.marcoral.versatia.lifecycle.AutoInvoke
import dev.jorel.commandapi.CommandAPI
import dev.jorel.commandapi.kotlindsl.commandAPICommand
import dev.jorel.commandapi.kotlindsl.playerExecutor
import dev.jorel.commandapi.kotlindsl.stringArgument
import dev.jorel.commandapi.kotlindsl.subcommand

@ConditionalOnPlugin("CommandAPI")
object ShopCommand {
    const val NAME = "shop"
    const val PRICE_PERMISSION = "versatia.shop.command.price"

    @AutoInvoke(Phase.PLUGIN_START_ONLY)
    fun register(plugin: ShopPlugin, prices: PriceList) = commandAPICommand(NAME, plugin) {
        subcommand("price") {
            withPermission(PRICE_PERMISSION)
            stringArgument("item")
            playerExecutor { player, args -> player.sendMessage(prices.describe(args["item"] as String)) }
        }
    }

    @AutoInvoke(Phase.PLUGIN_STOP)
    fun unregister() = CommandAPI.unregister(NAME, true)
}
```

## Where a command lives {/* #where-a-command-lives */}

- **A `command` subpackage** of the feature or plugin the command belongs to, one `object` per
  command: `com.example.shop.command.ShopCommand`, VersatiaCore's
  `com.github.marcoral.versatia.engine.command.VersatiaCommand`.
- **An `object`, not a bean.** An object's [auto-invoked functions](lifecycle/auto-invoke.md)
  receive any bean as a parameter, so the command needs no instance of its own and nothing
  injects it.
- **The CommandAPI types stay inside it.** Only this object refers to `dev.jorel.commandapi`; a
  bean or the main class that did would fail to load on a server without CommandAPI.

## The build and plugin.yml {/* #the-build-and-plugin-yml */}

CommandAPI itself is a plugin on the server; its Kotlin DSL is a library the plugin ships:

```kotlin
// build.gradle.kts
val commandApiVersion = "12.1.0"

dependencies {
    compileOnly("dev.jorel:commandapi-paper-core:$commandApiVersion")
    implementation("dev.jorel:commandapi-kotlin-paper:$commandApiVersion")
}

// The CommandAPI Kotlin DSL ships inside the plugin JAR
val archives = serviceOf<ArchiveOperations>()
tasks.jar {
    from(configurations.runtimeClasspath.map { classpath ->
        classpath.filter { it.name.startsWith("commandapi-kotlin-") }.map { archives.zipTree(it) }
    })
}
```

```yaml
# plugin.yml
depend:
  - VersatiaCore
softdepend:
  - CommandAPI
permissions:
  versatia.shop.command.price:
    description: Shows the price of an item with /shop price.
    default: true
```

`softdepend:` makes CommandAPI start first when it is installed. Every permission is declared with
a description and a `default` (`op`, `true`, `false` or `not op`), so permission plugins list it
and the default is a decision rather than Bukkit's fallback.

## Permissions {/* #permissions */}

A permission is named `versatia.<plugin>.command.<command>`, where `<plugin>` is the plugin's
[friendly name](lifecycle/reload.md#friendly-names) (or a short lower-case form of its name when
it has none) and `<command>` the subcommand it guards:

| Plugin                       | `<plugin>` | Command              | Permission                     |
|------------------------------|------------|----------------------|--------------------------------|
| VersatiaCore                 | `core`     | `/versatia reload`   | `versatia.core.command.reload` |
| ShopPlugin, `@FriendlyName("shop")` | `shop` | `/shop price <item>` | `versatia.shop.command.price` |

Keep the names in `const val`s of the command object, next to the code that checks them.

## Registration and reload {/* #registration-and-reload */}

| Phase               | What happens                                                           |
|---------------------|------------------------------------------------------------------------|
| `PLUGIN_START_ONLY` | the command is registered, once, after every bean of the plugin exists |
| a reload            | nothing: the command stays registered as it is                        |
| `PLUGIN_STOP`       | the command and its namespaced form (`/shop:shop`) are unregistered    |

Registering is what the server allows once, so it belongs at
[`PLUGIN_START_ONLY`](lifecycle/reload.md#designing-for-reload); a `PLUGIN_RELOAD_OR_START`
registration would declare the command a second time. The command's shape (its name,
subcommands, arguments and permissions) is therefore fixed for the plugin's life. What it shows
is not: the executor and the suggestions run at each use and read the beans then, so after
`/versatia reload shop` the same `/shop price` answers with the new prices. Read the beans'
current state in the lambdas; never copy a value into the command when it is built.

Unregistering at stop keeps a disabled plugin from leaving behind a command that would call into
it.

## VersatiaCore's `/versatia` {/* #versatiacores-versatia */}

VersatiaCore declares [`/versatia reload [plugin]`](lifecycle/reload.md) and
`/versatia info [plugin]` the same way, in `com.github.marcoral.versatia.engine.command.VersatiaCommand`:

```kotlin
@ConditionalOnPlugin("CommandAPI")
object VersatiaCommand {
    const val NAME = "versatia"
    const val RELOAD_PERMISSION = "versatia.core.command.reload"
    const val INFO_PERMISSION = "versatia.core.command.info"

    private var registered = false

    @AutoInvoke(Phase.PLUGIN_START_ONLY)
    fun register(core: VersatiaCore) = failSoft(core, "registered") {
        commandAPICommand(NAME, core) {
            subcommand("reload") {
                withPermission(RELOAD_PERMISSION)
                stringArgument("plugin", optional = true) {
                    replaceSuggestions(ArgumentSuggestions.stringCollection { core.runtime.registry.friendlyNames })
                }
                anyExecutor { sender, args -> reload(core, sender, args["plugin"] as? String) }
            }
            subcommand("info") {
                withPermission(INFO_PERMISSION)
                stringArgument("plugin", optional = true) {
                    replaceSuggestions(ArgumentSuggestions.stringCollection { core.runtime.registry.friendlyNames })
                }
                anyExecutor { sender, args -> info(core, sender, args["plugin"] as? String) }
            }
        }
        registered = true
    }

    @AutoInvoke(Phase.PLUGIN_STOP)
    fun unregister(core: VersatiaCore) {
        if (!registered) return
        registered = false
        failSoft(core, "unregistered") { CommandAPI.unregister(NAME, true) }
    }

    // failSoft, reload and info are private helpers of the object
}
```

- The suggestions read the registry at each tab press, so a plugin that started after VersatiaCore
  is offered without re-registering anything.
- `failSoft` catches an `Exception` or a `LinkageError` and logs one warning naming the installed
  CommandAPI release, so a release VersatiaCore is not compatible with costs only the command.
- `registered` keeps `unregister` from touching CommandAPI when the registration failed.
- `plugin.yml` lists `CommandAPI` under `softdepend:` and declares
  `versatia.core.command.reload` and `versatia.core.command.info`, both with `default: op`.

### `/versatia info` {/* #versatia-info */}

`/versatia info` changes nothing; it shows what the runtime keeps. Without an argument it lists
the running Versatia plugins with their friendly name, plugin name, version and descriptor format:

```text
VersatiaCore (VersatiaCore 0.0.1), descriptor format 1.4
economy (Economy 1.2.0), descriptor format 1.4
shop (Shop 0.4.0), descriptor format 1.4
```

With a friendly name it adds the plugin's beans with their class and scope, the exposed beans
other plugins use, the plugins [its reloads cascade to](lifecycle/reload.md#plugins-that-use-the-reloaded-ones-values)
and the files its `@Value` properties read:

```text
economy (Economy 1.2.0), descriptor format 1.4
Beans (3):
  "plugin" com.example.economy.EconomyPlugin, local
  "clock" com.example.economy.Clock, exposed singleton
  "priceList" com.example.economy.PriceList, exposed prototype
Exposed beans used by others: "priceList" by shop
Reloads cascade to: shop
@Value files: config.yml
```

It needs `versatia.core.command.info`, given to operators by default.

## Corner cases {/* #corner-cases */}

- **Without CommandAPI** the object is never loaded: `@ConditionalOnPlugin` drops its functions,
  so the DSL classes are never touched and the rest of the plugin starts. See
  [Optional plugins](optional-plugins.md).
- **CommandAPI installed later** does not add the command: the condition is decided at start and a
  reload [never changes it](lifecycle/reload.md#corner-cases). Restart the server.
- **A failed registration fails the start.** An exception from the `PLUGIN_START_ONLY` function
  fails the plugin's start like any other
  [auto-invoked function](reference/troubleshooting.md#plugin-x-yf-failed-at-start); wrap the
  registration, as VersatiaCore's `failSoft` does, when the plugin should start without its
  command.
- **A reload does not re-register.** A changed command name, alias or permission takes effect
  after a restart; a changed value the executor reads takes effect at its next use.
- **The permission check is CommandAPI's.** A sender without the permission does not see the
  subcommand in tab completion and gets CommandAPI's own message when typing it.
