# Reloading plugins

`/versatia reload` runs the reload phase of every running Versatia plugin, `/versatia reload <name>`
that of one plugin. The command requires the permission `versatia.core.command.reload`, which
operators have by default.

| Command                   | Effect                                                                                  |
|---------------------------|-----------------------------------------------------------------------------------------|
| `/versatia reload`        | reloads every running Versatia plugin, in the order in which they started               |
| `/versatia reload <name>` | reloads the plugin registered under that name; an unknown name lists the registered ones |

Tab completion offers the registered names.

## What a reload does

The runtime walks the plugin's descriptor at the `RELOAD` event: the elements whose phase is
`PLUGIN_RELOAD_ONLY` or `PLUGIN_RELOAD_OR_START` run, nothing else. Beans are not re-created,
listeners stay registered, resources are not extracted again. First the plugin's
[`Reloadable` beans](#reloadable-beans) are reloaded, then the reload-phase functions run. A
reload is for re-reading configuration and rebuilding whatever derives from it, in a `Reloadable`
bean or in functions such as

```kotlin
class ShopPlugin : VersatiaPlugin() {

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    private fun load(prices: PriceList) = prices.reload()
}
```

`prices` is the same bean instance the plugin got at start; see
[Phases and events](phases.md) for which phase runs when. A plugin whose reload throws is reported
to the command sender and in the console, with the function and the exception, and the remaining
plugins are still reloaded.

## Friendly names

A plugin is registered under the `name:` of its `plugin.yml`, which is often long. `@FriendlyName`
on the main class registers it under a shorter one:

```kotlin
import com.github.marcoral.versatia.FriendlyName

@FriendlyName("shop")
class ShopPlugin : VersatiaPlugin()
```

Now `/versatia reload shop` does it. The name is one word; two running plugins cannot share one,
the second to enable fails with
`Plugin OtherShop: the friendly name "shop" is already used by ShopPlugin`. The annotation belongs
on the main class; anywhere else it is a compile error.

## Reloadable beans

A bean whose state comes from files implements `Reloadable` and reads them in `reload()`:

```kotlin
import com.github.marcoral.versatia.di.Reloadable

@LocalBean
class Prices(private val plugin: JavaPlugin) : Reloadable {
    private var prices = emptyMap<String, Int>()

    override fun reload() {
        prices = loadYamlOrThrow(plugin.dataFolder.resolve("prices.yml")).getValues(false).mapValues { it.value as Int }
    }

    operator fun get(item: String) = prices[item]
}
```

The runtime calls `reload()` right after creating the bean, so it is ready as soon as it exists,
and again at every reload of the plugin, in creation order, so a dependency is fresh before its
dependents, and before any `@AutoInvoke` function of the event runs. Nothing else is needed: no
reload function, no call from the main class. The same applies to the instances a
[module](../modules/index.md#one-instance-per-plugin) makes for your plugin, such as a bank of
messages, which is reloaded with your plugin without a line of your code. An exposed singleton is
reloaded with its owner only.

A `reload()` that throws fails the event with `Plugin X: com.example.Prices failed to reload`,
with the original exception as cause: at start the plugin does not enable, at a reload the
message reaches the command sender and the console.

## Designing for reload

A reload is only as useful as the plugin lets it be. Write the plugin so that everything an
administrator may want to change at runtime is re-read at `PLUGIN_RELOAD_OR_START`, and keep the
start-only phase for what is genuinely once per life:

| Belongs at                 | Examples                                                                                     |
|----------------------------|----------------------------------------------------------------------------------------------|
| a bean constructor         | wiring only: taking dependencies, nothing read from disk; constructors run once               |
| `Reloadable.reload()`      | a bean's own state read from files: prices, messages; called after creation and at every reload, dependencies first |
| `PLUGIN_RELOAD_OR_START`   | reading configuration and resource files, (re)building what derives from them: prices, messages, caches, recipes |
| `PLUGIN_RELOAD_ONLY`       | what a reload adds on top of a start: telling online players, logging what changed            |
| `PLUGIN_START_ONLY`        | what the server allows once: registering with other plugins, hooking services, one-off migrations |
| `PLUGIN_STOP`              | flushing and closing                                                                           |

A bean that holds configuration therefore implements `Reloadable`, or has a `load()` called from
a `PLUGIN_RELOAD_OR_START` function, rather than reading the file in its constructor; the
[first plugin](../getting-started/first-plugin.md) is written the second way. Tasks and listeners are not
re-registered by a reload, so anything they use should look at the beans' current state rather than
copy it when they are created. Test it: change a value in the data folder, run
`/versatia reload <name>` and check the plugin picks it up without a restart.

## From code

`VersatiaPlugin.versatiaReload()` runs the plugin's own reload event, the same `/versatia reload`
runs. The plugin instance is a bean, so a service that needs it takes the plugin as a dependency
and calls the method:

```kotlin
@LocalBean
class AdminActions(private val plugin: ShopPlugin) {
    fun reload() = plugin.versatiaReload()
}
```

Reloading other plugins goes through `VersatiaEngine.instance.reload(plugin)`
(`VersatiaEngine.getInstance()` from Java); the engine's `registry` is a `PluginRegistry`: the running
Versatia plugins by friendly name, the names alone, the name of a given plugin and a lookup by
name. VersatiaCore also exposes the registry as a bean, so a bean or an auto-invoked function of
any plugin can simply take it:

```kotlin
@AutoInvoke(EventType.PLUGIN_START_ONLY)
fun greet(registry: PluginRegistry) = logger.info("Running next to ${registry.friendlyNames}")
```
