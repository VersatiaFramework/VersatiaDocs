# Optional plugins

`@ConditionalOnPlugin("Vault")` keeps an element out of the runtime's work unless every named
plugin is enabled on the server. It is how a Versatia plugin integrates with a plugin that may or
may not be installed, without `Class.forName` checks and without a `NoClassDefFoundError` when the
other plugin is missing.

```kotlin
import com.github.marcoral.versatia.ConditionalOnPlugin
import com.github.marcoral.versatia.util.server.loadService

@ConditionalOnPlugin("Vault")
@LocalBean
class VaultBridge(plugin: ShopPlugin) : Listener {
    private val economy = loadService<Economy>()

    @AutoInvoke(EventType.PLUGIN_START_ONLY)
    fun announce() = plugin.logger.info("Vault found, prices are charged")

    @EventHandler
    fun onBuy(event: BuyEvent) = economy.withdrawPlayer(event.player, event.price)
}
```

With Vault installed, `VaultBridge` is created, its listener registered and `announce` called.
Without it, none of that happens and the class is never loaded, so its references to Vault's
classes never have to resolve.

## Where it goes

| On                                        | Effect when a named plugin is missing                                                                |
|-------------------------------------------|------------------------------------------------------------------------------------------------------|
| a bean or a listener class                | the bean is not created, the listener is not registered, the `@AutoInvoke` functions of the class are not called, the class is not loaded |
| an `object`                               | none of its `@AutoInvoke` functions is called and the object is not loaded                           |
| an `@AutoInvoke` function                 | the function is not called                                                                           |

A function may add plugins of its own to those its class names; all of them have to be enabled.
VersatiaCore's own command is an `object` written this way:

```kotlin
@ConditionalOnPlugin("CommandAPI")
object VersatiaCommand {
    @AutoInvoke(EventType.PLUGIN_START_ONLY)
    fun register(core: VersatiaCore) = commandAPICommand("versatia", core) { /* ... */ }
}
```

## `softdepend:`

List the plugins under `softdepend:` in `plugin.yml`:

```yaml
softdepend:
  - Vault
```

Bukkit then enables them before your plugin when they are present, which is what the runtime
checks. Without the entry the other plugin may enable later, and the element is left out although
the plugin is on the server.

## Compile-time checks

The annotation is rejected where it would have no effect: on a class that is neither enhanced nor
declares an enhanced function (`@ConditionalOnPlugin on Tools has no effect: Tools is not enhanced
and declares no enhanced function`), on a function without an enhancement, on the plugin's main
class, and when it names no plugin.

## How it works

The compile-time step records the annotation as an attribute of the element; a function element
also records the attributes of its declaring class. At every lifecycle event the runtime keeps the
elements whose phase applies and whose plugins are enabled, and dispatches only those; a skipped
element is logged at `INFO` when the plugin starts: `Skipped VersatiaCommand: CommandAPI is not installed`. The check is
`PluginManager.isPluginEnabled(name)`, nothing is loaded to find out. VersatiaCore's own
`/versatia reload` is declared this way, conditional on the CommandAPI plugin; see
[Reloading plugins](lifecycle/reload.md).
