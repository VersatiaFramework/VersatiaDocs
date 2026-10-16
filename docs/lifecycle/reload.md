# Reloading plugins

`/versatia reload` runs the reload phase of every running Versatia plugin, `/versatia reload <name>`
that of one plugin. The command requires the permission `versatia.core.command.reload`, which
operators have by default.

| Command                   | Effect                                                                                  |
|---------------------------|-----------------------------------------------------------------------------------------|
| `/versatia reload`        | reloads every running Versatia plugin, in the order in which they started               |
| `/versatia reload <name>` | reloads the plugin registered under that name; an unknown name lists the registered ones |

Tab completion offers the registered names. The command exists only while the
[CommandAPI](https://commandapi.dev/) plugin, release 12.x, is installed; without it a plugin
still reloads [from code](#from-code) with `versatiaReload()`.

## What a reload does

The runtime walks the plugin's descriptor at the `RELOAD` event: the elements whose phase is
`PLUGIN_RELOAD_ONLY` or `PLUGIN_RELOAD_OR_START` run, nothing else. Beans are not re-created and
listeners stay registered. The [resources](../resources.md) are extracted again, which restores a
file deleted from the data folder and leaves every other file alone. Then the plugin's
[`@Value` properties](../configuration.md) are set again from the files, then its
[`Reloadable` beans](#reloadable-beans) are reloaded, then the reload-phase functions run; the
[order within an event](#the-order-within-an-event) explains why. A
reload is for re-reading configuration and rebuilding whatever derives from it: the values are
re-read for you, and the rest is rebuilt in functions such as

```kotlin
class ShopPlugin : VersatiaPlugin() {

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    private fun load(prices: PriceList) = prices.rebuild()
}
```

`prices` is the same bean instance the plugin got at start; see
[Phases and events](phases.md) for which phase runs when. A plugin whose reload fails is reported
to the command sender and in the console, and the remaining plugins are still reloaded. The reply
names the plugin and the chain of causes, each said once:

```
shop failed to reload: com.example.Shop.tax could not be read from config.yml: Value at "shop.tax" is not a percent string such as "12.5%" (0-100): "8"
```

A configuration mistake (a wrong value, invalid YAML, a file that is not UTF-8) is logged as one
warning without a stack trace, since the message says everything; any other failure is logged as
an error with the stack trace.

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
| 1    | the files under `resources/` are extracted                     | the same, for files missing from the data folder |
| 2    | the beans are created in dependency order; constructors run, receiving their [constructor values](../configuration.md#in-a-constructor) |                |
| 3    | the [`@Value` properties](../configuration.md) are set from the files | the `@Value` properties are set again |
| 4    | the [`Reloadable` beans](#reloadable-beans) are reloaded, in creation order | the same                      |
| 5    | the [listeners](../events.md) are registered                   |                                           |
| 6    | the [`@AutoInvoke` functions](auto-invoke.md) of the event run, in descriptor order | the same             |

Steps 2 and 3 may interleave at start: a value of the main class or of an `object` can be set
before the beans exist. A constructor therefore reads no `@Value` property but its own
constructor values.

### Why the values come before the reloads

A `reload()` may depend on a value; a value never depends on a `reload()`, because it comes from a
file and nothing else. Were the reloads to run first, a `reload()` reading a value would see what
the property held *before* the event: at start the placeholder, at a reload the previous
configuration. The administrator edits the file, runs `/versatia reload`, and the change would
show only at the next reload. With the values set first, `reload()` sees the current file at both
events. Setting a property is the smaller operation of the two, so it goes first and the bigger
one builds on it.

### What follows at start

The first `reload()` of a bean therefore does **not** run inside the bean's creation, as it
would have to for the constructors of its dependents to see a loaded bean: it runs in step 4, once
every bean exists and every value is set. A constructor that reads from a `Reloadable` dependency,
such as the `Messages` instance the [Messages module](../modules/messages.md) makes for your
plugin, sees it empty:

```kotlin
@LocalBean
class Shop(messages: Messages) {
    val greeting = messages["shop.open"].get()   // throws: the messages have not been read yet
}
```

This is the rule that constructors only wire dependencies, applied to one more case. Read the
dependency when it is needed, or in a function of the event, which runs after the reloads:

```kotlin
@LocalBean
class Shop(private val messages: Messages) {
    val greeting get() = messages["shop.open"].get()   // read on use

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    fun announce() = messages["shop.open"].broadcast()   // step 6, after the reload
}
```

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
which is what the prototype receives the consuming plugin for. A value declared in the
prototype's constructor reaches the consumers' instances as the owner read it at start; see the
[corner cases of dependency injection](../dependency-injection/index.md#corner-cases).

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

Another plugin reloads with `VersatiaEngine.reload("shop")`, by its friendly name; an unknown name
fails and lists the running ones (from Java, `VersatiaEngine.getInstance().reload(plugin)`). The
running Versatia plugins are a `PluginRegistry`: by friendly name, the names alone, the name of a
given plugin, and a lookup by name, `get(name)` or `getOrThrow(name)`. VersatiaCore exposes the
registry as a bean, so a bean or an auto-invoked function of any plugin simply takes it; code the
runtime does not construct reaches it as `VersatiaEngine.registry`:

```kotlin
@AutoInvoke(EventType.PLUGIN_START_ONLY)
fun greet(registry: PluginRegistry) = logger.info("Running next to ${registry.friendlyNames}")
```

A reload the plugin cannot take fails with a message saying why:

| Message                                                                            | When                                                   |
|------------------------------------------------------------------------------------|--------------------------------------------------------|
| `Plugin Shop is not running`                                                       | the plugin is disabled, or its start failed            |
| `Plugin Shop is still starting; it can be reloaded once its start has completed`   | a start-phase function asked for the reload            |
| `Plugin Shop is already reloading; a reload cannot start another one`              | a reload-phase function asked for the reload           |

## Corner cases

- **A failed start.** A plugin whose start fails is never registered: it is not running, so a
  reload is refused, and when Bukkit disables it, its `PLUGIN_STOP` functions do not run; only the
  state built so far is dropped. A plugin that disables itself during its start ends the same way.
- **Stop is best-effort.** Every `PLUGIN_STOP` element runs even when an earlier one fails; the
  first failure is reported and the plugin's state is dropped all the same.
- **One start per plugin.** Enhancing a plugin that is already running, or still starting, fails
  with `Plugin Shop is already running`.
- **Conditions stay as decided at start.** A reload never adds or removes elements because a
  [plugin they depend on](../optional-plugins.md#corner-cases) appeared or went away.
- **A resource deleted on the server** comes back at the next reload; one that still exists is
  never touched, whatever the JAR holds.
