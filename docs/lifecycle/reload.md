# Reloading plugins

import ExampleCard from '@site/src/components/ExampleCard';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

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

:::admin

What a reload changes on the server, and what needs a restart, is explained to the server admin in
[`/versatia reload`](/admin/commands#versatia-reload).

:::

<ExampleCard repo="VersatiaExample-Lifecycle-Reload" file="src/main/kotlin/dev/versatia/example/reload/Announcer.kt">
Values re-read by <code>/versatia reload announcer</code>, a derived value rebuilt in a <code>PLUGIN_RELOAD_OR_START</code> function, a task rescheduled only when <code>PreviousValueTracking</code> says its interval changed, and a reload from code.
</ExampleCard>

The exact order of the steps within a start or a reload is on [The order within an
event](event-order.md).

## What a reload does {/* #what-a-reload-does */}

The runtime walks the plugin's descriptor at the `RELOAD` event: the elements whose phase is
`PLUGIN_RELOAD_ONLY` or `PLUGIN_RELOAD_OR_START` run, nothing else. Beans are not re-created,
listeners stay registered and the coroutines launched from a [`PluginScope`](../tasks/coroutines.md)
go on; every [`BackgroundTask`](../tasks/index.md#background-tasks) is restarted with the new values. The [resources](../resources.md) are extracted again, which restores a
file deleted from the data folder and leaves every other file alone. Then the plugin's
[`@Value` properties](../configuration/index.md) are set again from the files, then its
[`Reloadable` beans](#reloadable-beans) are reloaded, then the reload-phase functions run; the
[order within an event](event-order.md) explains why. A
reload is for re-reading configuration and rebuilding whatever derives from it: the values are
re-read for you, and the rest is rebuilt in functions such as

<CodeCards spares="the reload command and its `plugin.yml` entry, re-reading the files, reporting a failure to the sender and the console">
<CodeCard title="ShopPlugin.kt">

```kotlin
class ShopPlugin : VersatiaPlugin() {
    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    private fun load(prices: PriceList) = prices.rebuild()
}
```

</CodeCard>
<CodeCard title="ShopPlugin.java" bukkit>

```java
public final class ShopPlugin extends JavaPlugin {
    private PriceList prices;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        prices = new PriceList(this);
        prices.rebuild();
    }

    // /shopreload, declared in plugin.yml
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        try {
            saveDefaultConfig();
            reloadConfig();
            prices.rebuild();
            sender.sendMessage(text("Shop reloaded", GREEN));
        } catch (RuntimeException e) {
            sender.sendMessage(text("Reload failed: " + e.getMessage(), RED));
            getLogger().log(Level.SEVERE, "Shop failed to reload", e);
        }
        return true;
    }
}
```

</CodeCard>
<CodeCard title="plugin.yml" bukkit>

```yaml
commands:
  shopreload:
    permission: shop.reload
permissions:
  shop.reload:
    default: op
```

</CodeCard>
</CodeCards>

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

### Plugins that use the reloaded one's values {/* #plugins-that-use-the-reloaded-ones-values */}

A plugin holding a bean another plugin exposes, a [prototype](../dependency-injection/scopes.md#exposeprototype)
instance made for it or an injected singleton, whose class has [`@Value` properties](../configuration/index.md)
or takes, through its constructor, another bean of that plugin that has them (a `Ledger(val prices:
PriceList)` counts), depends on that plugin's configuration. After a successful reload the runtime therefore reloads
every such plugin too, right after, without anything to declare; a plugin holding only beans
without values is left alone: Economy exposes `PriceList`, Shop and Auction inject it, and `/versatia reload economy`
answers

```
Reloaded economy; then shop, auction, which use beans of economy.
```

Each of them runs its reload event, so its `PLUGIN_RELOAD_OR_START` functions see the
[values Economy just read](event-order.md#value-on-a-prototype) and rebuild what derives from them. The cascade
goes on transitively (a plugin using Shop's beans follows Shop), in start order, so an owner always
reloads before the plugins using it, and each plugin reloads once per reload, cycles included; a
full `/versatia reload` reloads every plugin once. A consumer whose reload fails is reported on its
own and undoes nothing:

```
shop failed to reload after economy, whose beans it uses: ... economy stays reloaded; fix shop and reload it
```

A reload that fails cascades nothing, so a broken file in Economy leaves Shop and Auction as they
were.

## Friendly names {/* #friendly-names */}

A plugin is registered under the `name:` of its `plugin.yml`, which is often long. `@FriendlyName`
on the main class registers it under a shorter one:

```kotlin
@FriendlyName("shop")
class ShopPlugin : VersatiaPlugin()
```

Now `/versatia reload shop` does it. The name is one word; two running plugins cannot share one,
the second to enable fails with
`Plugin OtherShop: the friendly name "shop" is already used by ShopPlugin`. The annotation belongs
on the main class; anywhere else it is a compile error.

## Reloadable beans {/* #reloadable-beans */}

A [module](../modules/index.md) exposes a prototype that reads the consuming plugin's files, such
as the `Messages` instance made for your plugin. The module cannot know when your plugin reloads,
so the prototype implements `Reloadable` and reads the files in `reload()`:

```kotlin
@ExposePrototype
internal class MessagesImpl(private val plugin: Plugin, private val text: Text) : Messages, Reloadable {
    private var bank = emptyMap<String, Message>()

    override fun reload() {
        bank = MessageLoader(plugin.name, plugin.dataFolder, text).load()
    }
}
```

The runtime calls `reload()` once your plugin's beans exist and its [`@Value` properties](../configuration/index.md)
are set, and again at every reload of your plugin, in creation order, so a dependency is fresh
before its dependents, and before any `@AutoInvoke` function of the event runs. An instance
obtained later, by a reload-phase function say, is reloaded as soon as it is obtained. Nothing is
needed in your plugin: the instance made for it is reloaded with it without a line of your code.
A local bean implementing `Reloadable` is treated the same way, and an exposed singleton is
reloaded with its owner only, but neither is the hook's purpose: a plugin's own configuration is
`@Value` properties, as explained under [Common mistakes](../configuration/index.md#common-mistakes).

A `reload()` that throws fails the event with `Plugin X: com.example.MessagesImpl failed to reload`,
with the original exception as cause: at start the plugin does not enable, at a reload the
message reaches the command sender and the console.

## Designing for reload {/* #designing-for-reload */}

A reload is only as useful as the plugin lets it be. Write the plugin so that everything an
administrator may want to change at runtime is re-read at `PLUGIN_RELOAD_OR_START`, and keep the
start-only phase for what is genuinely once per life:

| Belongs at                 | Examples                                                                                     |
|----------------------------|----------------------------------------------------------------------------------------------|
| a bean constructor         | wiring only: taking dependencies, nothing read from disk; constructors run once               |
| a `@Value` property        | the plugin's own configuration: a limit, a message of the day, a list of blocked materials, a type of your own through a mapper; set first, before the reloadable beans and the functions |
| `Reloadable.reload()`      | a module prototype's state read from the consuming plugin's files, such as its messages; called once the consumer's values are set and at every reload, dependencies first |
| a consumer's `PLUGIN_RELOAD_OR_START` | what derives from another plugin's beans, such as prices built from Economy's `PriceList`; the consumer reloads [right after that plugin](#plugins-that-use-the-reloaded-ones-values), so nothing has to watch for the change |
| `PLUGIN_RELOAD_OR_START`   | reading configuration and resource files, (re)building what derives from them: prices, messages, caches, recipes |
| `PLUGIN_RELOAD_ONLY`       | what a reload adds on top of a start: telling online players, logging what changed; a [`PreviousValueTracking`](../configuration/changes.md#reacting-to-a-change) says what did |
| `PLUGIN_START_ONLY`        | what the server allows once: registering with other plugins, [registering commands](../commands.md), hooking services, one-off migrations |
| a `BackgroundTask`         | work that runs as long as the plugin, a broadcast, particles, an autosave: its `run()` is cancelled and called again by every reload, after the values are set, so it reads them when it begins; see [Background tasks](../tasks/index.md#background-tasks) |
| a `PluginScope` coroutine  | work an event or a command starts, a countdown, a combat tag: a reload leaves it alone, so it keeps the values it began with; never launch repeating work from `PLUGIN_RELOAD_OR_START`, which would start a copy at every reload |
| `PLUGIN_STOP`              | flushing and closing; the plugin's coroutines are cancelled before, see [What happens at stop](phases.md#what-happens-at-stop) |

What derives from the values is built at `PLUGIN_RELOAD_OR_START`; built at `PLUGIN_START_ONLY`, it
keeps the values of the start while the property follows every reload:

```kotlin title="Wrong: the label never sees a reloaded value"
@LocalBean
class Rewards {
    @Value("rewards.daily")
    var daily = 0

    var label = text("")
        private set

    // error-next-line
    @AutoInvoke(Phase.PLUGIN_START_ONLY)
    fun build() {
        label = text("Daily reward: $daily coins")
    }
}
```

```kotlin title="Right"
@LocalBean
class Rewards {
    @Value("rewards.daily")
    var daily = 0

    var label = text("")
        private set

    // fix-next-line
    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    fun build() {
        label = text("Daily reward: $daily coins")
    }
}
```

A plugin's configuration is therefore [`@Value` properties](../configuration/index.md), with a mapper
for anything structured, never a file read in a constructor; what derives from them is rebuilt
in a `PLUGIN_RELOAD_OR_START` function, the way the
[first plugin](../getting-started/first-plugin.md) does. `Reloadable` is for the prototypes of
modules, not for a plugin's own beans; see [Common mistakes](../configuration/index.md#common-mistakes). Listeners, [commands](../commands.md#registration-and-reload), Bukkit
tasks and the coroutines of a `PluginScope` are not re-registered or restarted by a reload, so
anything they use should look at the beans' current state rather than copy it when they are
created; a `BackgroundTask` is restarted, so it may read its values once, when `run()` begins. Test it: change a value in the data folder, run
`/versatia reload <name>` and check the plugin picks it up without a restart.

## From code {/* #from-code */}

`VersatiaPlugin.versatiaReload()` runs the plugin's own reload event, and then those of the
[plugins holding its beans with values](#plugins-that-use-the-reloaded-ones-values), the same `/versatia reload`
runs; a failure of the plugin itself is thrown, one of a consumer logged with the summary of what
was reloaded. The plugin instance is a bean, so a service that needs it takes the plugin as a dependency
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
@AutoInvoke(Phase.PLUGIN_START_ONLY)
fun greet(registry: PluginRegistry) = logger.info("Running next to ${registry.friendlyNames}")
```

A reload the plugin cannot take fails with a message saying why:

| Message                                                                            | When                                                   |
|------------------------------------------------------------------------------------|--------------------------------------------------------|
| `Plugin Shop is not running`                                                       | the plugin is disabled, or its start failed            |
| `Plugin Shop is still starting; it can be reloaded once its start has completed`   | a start-phase function asked for the reload            |
| `Plugin Shop is already reloading; a reload cannot start another one`              | a reload-phase function asked for the reload           |
| `Plugin Shop has already been reloaded by the reload under way; a plugin reloads at most once per reload` | a reload-phase function asked for a plugin the running reload, cascade included, already went through |
| `Plugin Shop: reload must run on the server's main thread; schedule it with plugin.runTask { ... }` | the reload was asked for from an asynchronous task or another thread |

### On the main thread {/* #on-the-main-thread */}

A reload touches Bukkit state, so it runs on the server's main thread only; called from anywhere
else it throws before anything is reloaded. Code on another thread, such as an asynchronous task
that has just downloaded a new configuration, hands the reload over to the main thread:

```kotlin
plugin.runTaskAsynchronously {
    download(plugin.dataFolder.resolve("prices.yml"))
    plugin.runTask { plugin.versatiaReload() }
}
```

The start and the stop of a plugin are checked the same way (`start must run ...`, `stop must
run ...`); Bukkit calls `onEnable` and `onDisable` on the main thread, so only a hand-made call
can meet them.

## Corner cases {/* #corner-cases */}

- **A failed start.** A plugin whose start fails is never registered: it is not running, so a
  reload is refused, and when Bukkit disables it, its `PLUGIN_STOP` functions do not run; only the
  state built so far is dropped. A plugin that disables itself during its start ends the same way.
- **Off the main thread** a reload, a start or a stop throws before anything runs, whatever the
  plugin's state; see [On the main thread](#on-the-main-thread).
- **Stop is best-effort.** Every `PLUGIN_STOP` element runs even when an earlier one fails; the
  first failure is reported and the plugin's state is dropped all the same.
- **One start per plugin.** Enhancing a plugin that is already running, or still starting, fails
  with `Plugin Shop is already running`.
- **Conditions stay as decided at start.** A reload never adds or removes elements because a
  [plugin they depend on](../optional-plugins.md#corner-cases) appeared or went away.
- **A resource deleted on the server** comes back at the next reload; one that still exists is
  never touched, whatever the JAR holds.
- **A reload cascades only through beans with values.** A plugin is reloaded with another only
  when it holds one of that plugin's beans whose class has a `@Value` property, in the body or the
  constructor, or takes such a bean of that plugin in its constructor, directly or through other
  beans of the plugin. Injecting VersatiaCore's `PluginRegistry`, or a module prototype without values,
  ties nothing: reloading VersatiaCore or that module reloads no one else.
- **Each plugin reloads once per reload.** The cascade follows start order and skips a plugin
  already reloaded, so a cycle (Shop using Economy's beans while Economy uses Shop's) ends there;
  a reload asked for from a reload function joins the running one.
- **A consumer's failure undoes nothing.** The owner stays reloaded, the other consumers still
  reload, and the failing one keeps its previous state, as after any failed reload.
- **A reload restarts background tasks, never the scope's coroutines.** A task's cancelled call
  finishes, `finally` blocks included, before the reload functions run, and the new call begins at
  a later tick; a coroutine launched from a `PluginScope` runs on with what it had. See
  [Reload and stop](../tasks/index.md#reload-and-stop).
- **A disabled consumer is forgotten.** Its instances no longer receive the owner's values and it
  is no longer reloaded with the owner.
