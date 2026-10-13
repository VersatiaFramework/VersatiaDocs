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
[`@Value` properties](../configuration.md) are set again from the files, then its
[`Reloadable` beans](#reloadable-beans) are reloaded, then the reload-phase functions run; the
[order within an event](#the-order-within-an-event) explains why. A
reload is for re-reading configuration and rebuilding whatever derives from it: the values are
re-read for you, and the rest is rebuilt in functions such as

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

A [module](../modules/index.md) exposes a prototype that reads the consuming plugin's files, such
as the `Messages` instance made for your plugin. The module cannot know when your plugin reloads,
so the prototype implements `Reloadable` and reads the files in `reload()`:

```kotlin
import com.github.marcoral.versatia.di.Reloadable

@ExposePrototype
internal class MessagesImpl(private val plugin: Plugin) : Messages, Reloadable {
    private var bank = emptyMap<String, Message>()

    override fun reload() {
        bank = MessageLoader.load(plugin)
    }
}
```

The runtime calls `reload()` once your plugin's beans exist and its [`@Value` properties](../configuration.md)
are set, and again at every reload of your plugin, in creation order, so a dependency is fresh
before its dependents, and before any `@AutoInvoke` function of the event runs. An instance
obtained later, by a reload-phase function say, is reloaded as soon as it is obtained. Nothing is
needed in your plugin: the instance made for it is reloaded with it without a line of your code.
A local bean implementing `Reloadable` is treated the same way, and an exposed singleton is
reloaded with its owner only, but neither is the hook's purpose: a plugin's own configuration is
`@Value` properties, as explained under [Common mistakes](../configuration.md#common-mistakes).

A `reload()` that throws fails the event with `Plugin X: com.example.MessagesImpl failed to reload`,
with the original exception as cause: at start the plugin does not enable, at a reload the
message reaches the command sender and the console.

## The order within an event

At `START` and at `RELOAD` the runtime works through a plugin in a fixed order, and the order
decides what each piece of code can see:

| Step | At `START`                                                     | At `RELOAD`                               |
|------|----------------------------------------------------------------|-------------------------------------------|
| 1    | the files under `resources/` are extracted                     |                                           |
| 2    | the beans are created in dependency order; constructors run    |                                           |
| 3    | the [`@Value` properties](../configuration.md) are set from the files | the `@Value` properties are set again |
| 4    | the [`Reloadable` beans](#reloadable-beans) are reloaded, in creation order | the same                      |
| 5    | the [`@AutoInvoke` functions](auto-invoke.md) of the event run, in descriptor order | the same             |

### Why the values come before the reloads

A `reload()` may depend on a value; a value never depends on a `reload()`, because it comes from a
file and nothing else. Take a bean that rebuilds something from a value:

```kotlin
@LocalBean
class Recipes(private val plugin: JavaPlugin) : Reloadable {
    @Value("recipes.directory")
    lateinit var directory: String

    private var recipes = emptyList<Recipe>()

    override fun reload() {
        recipes = plugin.mapYamlFiles(directory) { _, file -> Recipe.from(file) }.values.toList()
    }
}
```

Were the reloads to run first, `reload()` would read the directory the property held *before*
the event: at start the initializer (here none, so a `lateinit` failure), at a reload the
directory of the previous configuration. The administrator changes `recipes.directory`, runs
`/versatia reload`, and the plugin reloads the old directory; only the next reload would use the
new one. With the values set first, `reload()` sees the current file at both events. Setting a
property is the smaller operation of the two, so it goes first and the bigger one builds on it.

### What follows at start

The first `reload()` of a bean therefore does **not** run inside the bean's creation, as it
would have to for the constructors of its dependents to see a loaded bean: it runs in step 4, once
every bean exists and every value is set. A constructor that reads from a `Reloadable` dependency
sees it empty:

```kotlin
@LocalBean
class Shop(prices: Prices) {
    val diamond = prices["diamond"]          // null: Prices has not been reloaded yet
}
```

This is the rule that constructors only wire dependencies, applied to one more case. Read the
dependency when it is needed, or in a function of the event, which runs after the reloads:

```kotlin
@LocalBean
class Shop(private val prices: Prices) {
    val diamond get() = prices["diamond"]     // read on use

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    fun refresh() = logger.info("Diamond costs ${prices["diamond"]}")   // step 5, after the reload
}
```

The same holds for the instances a [module](../modules/index.md) makes for your plugin: a
`Messages` injected into a bean's constructor is empty while the constructor runs and filled by
the time any function of your plugin runs.

### What follows later

An instance obtained after step 4 is reloaded as soon as it is obtained, so nothing is ever
handed out unloaded. A reload-phase function that is the first to ask for a module's prototype
receives a loaded instance:

```kotlin
@AutoInvoke(EventType.PLUGIN_RELOAD_ONLY)
fun announce(messages: Messages) = messages["reloaded"].broadcast()   // created now, reloaded now, then called
```

### `@Value` on a prototype

A `@Value` property belongs to the plugin that declares the class, and its file is that plugin's.
On an `@ExposePrototype` it is set on the owner's own instance only; the instances made for
consumers keep their initializers, because the owner's files say nothing about the consumer. A
module that needs a setting per consumer reads it in `reload()` from the consumer's data folder,
which is what the prototype receives the consuming plugin for.

## Designing for reload

A reload is only as useful as the plugin lets it be. Write the plugin so that everything an
administrator may want to change at runtime is re-read at `PLUGIN_RELOAD_OR_START`, and keep the
start-only phase for what is genuinely once per life:

| Belongs at                 | Examples                                                                                     |
|----------------------------|----------------------------------------------------------------------------------------------|
| a bean constructor         | wiring only: taking dependencies, nothing read from disk; constructors run once               |
| a `@Value` property        | the plugin's own configuration: a limit, a message of the day, a list of blocked materials, a type of your own through a mapper; set first, before the reloadable beans and the functions |
| `Reloadable.reload()`      | a module prototype's state read from the consuming plugin's files, such as its messages; called once the consumer's values are set and at every reload, dependencies first |
| `PLUGIN_RELOAD_OR_START`   | reading configuration and resource files, (re)building what derives from them: prices, messages, caches, recipes |
| `PLUGIN_RELOAD_ONLY`       | what a reload adds on top of a start: telling online players, logging what changed; a [`PreviousValueTracking`](../configuration.md#reacting-to-a-change) says what did |
| `PLUGIN_START_ONLY`        | what the server allows once: registering with other plugins, hooking services, one-off migrations |
| `PLUGIN_STOP`              | flushing and closing                                                                           |

A plugin's configuration is therefore [`@Value` properties](../configuration.md), with a mapper
for anything structured, never a file read in a constructor; what derives from them is rebuilt
in a `PLUGIN_RELOAD_OR_START` function, the way the
[first plugin](../getting-started/first-plugin.md) does. `Reloadable` is for the prototypes of
modules, not for a plugin's own beans; see [Common mistakes](../configuration.md#common-mistakes). Tasks and listeners are not
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
