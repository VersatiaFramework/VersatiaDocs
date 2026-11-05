---
description: What changes when a Bukkit plugin moves to Versatia, and every example of this documentation next to the same code written with plain Paper.
---

# Coming from Bukkit

import BukkitGallery from '@site/src/components/BukkitGallery';

You know `JavaPlugin`, `onEnable` and `getConfig()`. Nothing of the Paper API goes away: events,
players, items, the scheduler and `plugin.yml` are the ones you know, and Versatia takes over the
wiring around them. Two things change at once: the main class extends `VersatiaPlugin`, which
seals `onEnable` and `onDisable`, and `plugin.yml` lists `VersatiaCore` under `depend:` (see
[Installation](installation.md#pluginyml)).

## Side by side {/* #side-by-side */}

Wherever a page of this documentation replaces Bukkit code, its example carries a switch:
**Versatia** shows the Kotlin the page teaches, **Plain Paper** the same behaviour in Java with the
plain Paper API, error handling and reload included, and what you no longer write. The numbers count the
lines of code without blank lines and imports. Flipping one switch flips every example for the
rest of your visit. Here they all are, in the order of the sidebar, each linking to its page:

<BukkitGallery />

## plugin.yml, not paper-plugin.yml {/* #pluginyml-not-paper-pluginyml */}

A Versatia plugin is a Bukkit plugin described by `plugin.yml`, as in the
[installation](installation.md#pluginyml). A `paper-plugin.yml` turns the JAR into a Paper plugin,
which Paper loads with its own loader: every plugin gets an isolated class
loader, reaches another plugin's classes only through a dependency declared with
`join-classpath`, and has no `depend:`, `softdepend:` or `libraries:` keys. Paper reads
`paper-plugin.yml` in preference to `plugin.yml` when a JAR holds both. Versatia relies on what
`depend: [VersatiaCore]` gives a Bukkit plugin: the Kotlin runtime and VersatiaAPI come from
VersatiaCore, the module APIs from the module plugins, and `softdepend:` orders the plugins that
[`@ConditionalOnPlugin`](../optional-plugins.md#softdepend) checks. A Paper plugin is therefore
not a supported Versatia plugin. The `checkPluginYml` task of the
[template](https://github.com/VersatiaFramework/VersatiaExample-Template) fails the build when
`src/main/resources/paper-plugin.yml` exists, with
`Versatia plugins use plugin.yml; remove paper-plugin.yml (...)`.

```yaml title="Wrong: src/main/resources/paper-plugin.yml"
name: MyPlugin
version: '1.0.0'
main: com.example.myplugin.MyPlugin
api-version: '26.3'
# error-start
dependencies:
  server:
    VersatiaCore:
      load: BEFORE
      join-classpath: true
# error-end
```

```yaml title="Right: src/main/resources/plugin.yml"
name: MyPlugin
version: '1.0.0'
main: com.example.myplugin.MyPlugin
api-version: '26.3'
# fix-start
depend:
  - VersatiaCore
# fix-end
```

## Bukkit concept → Versatia {/* #bukkit-concept-versatia */}

| Bukkit                                                           | Versatia                                                                                         |
|------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `onEnable()`                                                     | [`@AutoInvoke(Phase.PLUGIN_START_ONLY)`](../lifecycle/auto-invoke.md), or `PLUGIN_RELOAD_OR_START` for what a reload repeats |
| `onDisable()`                                                    | `@AutoInvoke(Phase.PLUGIN_STOP)`                                                                 |
| `saveDefaultConfig()`, `saveResource(...)`                       | files under `src/main/resources/resources/`, [extracted](../resources.md) at start and reload    |
| `getConfig().getInt("key", 10)`                                  | [`@Value("key") var key = 0`](../configuration/index.md), the default in the shipped file              |
| a type check with a fallback                                     | the [supported types](../configuration/types.md#supported-types) and [mappers](../configuration/types.md#mappers); a wrong value is an error naming the key |
| `reloadConfig()` and a reload command                            | [`/versatia reload <name>`](../lifecycle/reload.md), `versatiaReload()`, `VersatiaEngine.reload(name)` |
| `registerEvents(new MyListener(...), this)`                      | any class implementing `Listener`, [registered](../events.md) at start                           |
| `getCommand("shop").setExecutor(...)`                            | the [CommandAPI Kotlin DSL](../commands.md) in an `object`                                       |
| a static `getInstance()`, services built in `onEnable`           | [beans](../dependency-injection/index.md) with constructor injection; the main class is the bean `plugin` |
| `isPluginEnabled("Vault")` with class-loading guards             | [`@ConditionalOnPlugin("Vault")`](../optional-plugins.md) and `softdepend:`                      |
| `getServicesManager().getRegistration(Economy.class)`            | [`VersatiaEngine.loadService<Economy>()`](../utilities/index.md#start-with-versatiaengine)        |
| a service shared with other plugins through the `ServicesManager` | [`@ExposeSingleton`, `@ExposePrototype`](../dependency-injection/cross-plugin.md)               |
| `getScheduler().runTaskTimer(plugin, task, delay, period)`       | a [`BackgroundTask`](../tasks/index.md#background-tasks) with `everyTicks` or `every`, restarted by every reload; [`plugin.runTaskTimer(periodTicks, delayTicks)`](../utilities/misc.md#scheduler) for a plain Bukkit task |
| `runTaskLater`, `runTaskAsynchronously` and back with `runTask`  | a coroutine of the injected [`PluginScope`](../tasks/coroutines.md): `delayTicks(20)`, `withContext(Dispatchers.IO) { }` |
| `Bukkit.broadcast(...)`, `Bukkit.getPlayerExact(name)`           | [`VersatiaEngine.broadcast(...)`, `VersatiaEngine.playerOrNull(name)`](../utilities/index.md#start-with-versatiaengine) |
| `messages.yml`, `%player%` replacements, `TagResolver`s          | the [Messages](../messages/index.md): `messages["key"].send(player, arg("player", player))` |
| `getLogger().info(...)`                                          | `logger.info(...)` in the main class, an [injected `Logger`](../dependency-injection/index.md#beans-every-plugin-has) in a bean |
| `paper-plugin.yml`                                               | not supported; [`plugin.yml`](installation.md#pluginyml) with `depend: [VersatiaCore]`           |

Next: [Your first plugin](first-plugin.md) builds a plugin step by step, and the
[example plugins](../examples/index.md) show one feature each.
