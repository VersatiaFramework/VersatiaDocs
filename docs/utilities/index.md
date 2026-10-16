# Utilities

Besides the framework itself, VersatiaAPI ships a set of independent helpers over the Paper API.
Server-wide calls start at one class, `VersatiaEngine`; everything else is an extension on the
object you already hold, grouped under `com.github.marcoral.versatia.util` by the domain it
touches.

## Start with `VersatiaEngine.`

Work that needs no object at hand, such as finding a player, broadcasting or looking up a service,
is a static call on `VersatiaEngine`: one class to remember. Type `VersatiaEngine.` and pick from
completion; IntelliJ adds the import (`import com.github.marcoral.versatia.broadcast`).

```kotlin
VersatiaEngine.broadcast(text("The shop is open"))
VersatiaEngine.playerOrNull("Notch")?.sendMessage(text("Welcome back"))
val economy = VersatiaEngine.loadService<Economy>()
VersatiaEngine.reload("shop")
```

| Member                                         | Does                                                                 | Instead of                                    |
|------------------------------------------------|----------------------------------------------------------------------|-----------------------------------------------|
| `registry`                                     | the running Versatia plugins by friendly name, a [`PluginRegistry`](../lifecycle/reload.md#from-code) | `VersatiaEngine.instance.registry` |
| `reload(name)`                                 | reloads the plugin registered as `name`, as `/versatia reload <name>` does; an unknown name fails and lists the running ones | a registry lookup and `instance.reload(plugin)` |
| `onlinePlayers`                                | the online players                                                   | `Bukkit.getOnlinePlayers()`                   |
| `playerOrNull(name)`                           | the online player with exactly this name, ignoring case; never the prefix match of `Bukkit.getPlayer(String)` | `Bukkit.getPlayerExact(name)` |
| `playerOrNull(id)`                             | the online player with this UUID                                     | `Bukkit.getPlayer(id)`                        |
| `offlinePlayer(id)`                            | the player behind a UUID, online or not; never null, never a web lookup | `Bukkit.getOfflinePlayer(id)`              |
| `worldOrNull(name)`                            | the world with this name                                             | `Bukkit.getWorld(name)`                       |
| `broadcast(message)`, `broadcast(message, permission)` | sends a `Component` to every player and the console, or to everyone holding `permission`; returns the number of recipients | `Bukkit.broadcast(...)` |
| `dispatchConsoleCommand(line)`                 | runs a command, without the slash, as the console; main thread only  | `Bukkit.dispatchCommand(Bukkit.getConsoleSender(), line)` |
| `loadService<T>()`, `loadServiceOrNull<T>()`   | the provider registered for `T` in the `ServicesManager`; `ServiceNotRegisteredException` names the service when there is none | `Bukkit.getServicesManager().load(...)` |
| `isPrimaryThread()`, `checkPrimaryThread()`, `checkNotPrimaryThread()` | where the code runs; the checks throw when it is the wrong thread | `Bukkit.isPrimaryThread()` |

Work on something you already hold is a call on that object, not on `VersatiaEngine`:

| Task                                | Where                                                                  |
|-------------------------------------|------------------------------------------------------------------------|
| schedule a task                     | `plugin.runTaskLater(20) { }`, see [Scheduler](misc.md#scheduler)      |
| log                                 | `logger` or `componentLogger` in the plugin, [`plugin.log`](misc.md#logging) elsewhere |
| reload your own plugin              | `versatiaReload()`, see [Reloading plugins](../lifecycle/reload.md#from-code) |
| message one player                  | `player.sendMessage(...)`                                              |
| run a command as a player           | `player.performCommand(...)`                                           |
| fire an event                       | `event.callEvent()`                                                    |
| read configuration                  | [`@Value`](../configuration.md) and the [strict getters](configuration.md) |
| provide a service                   | `server.servicesManager.register(...)` in the providing plugin          |
| check for an optional plugin        | [`@ConditionalOnPlugin`](../optional-plugins.md)                        |
| inventories, boss bars, block data  | the `Bukkit` factories                                                 |

Members that call Bukkit work in any plugin; `registry` and `reload` need VersatiaCore enabled. In a
bean, take the plugin or the `PluginRegistry` as a constructor parameter instead of reaching for
`VersatiaEngine.registry`: it keeps the bean testable. The shortcuts are Kotlin extensions on the
companion of `VersatiaEngine`; from Java, use `VersatiaEngine.getInstance()` and Bukkit.

## Helpers by package

| Package        | Contents                                                                                 | Page |
|----------------|------------------------------------------------------------------------------------------|------|
| `config`       | strict typed getters for `ConfigurationSection`, YAML file traversal                     | [Configuration](configuration.md) |
| `collection`   | `addOrThrow`/`putAllOrThrow`-style helpers, `DeepMergeMap`                                | [Collections](collections.md) |
| `plugin`       | `Plugin.log`, `logWarning`, `logSevere`                                                   | [Scheduler, logging and more](misc.md#logging) |
| `scheduler`    | `Plugin.runTask*` wrappers over `BukkitScheduler`                                         | [Scheduler, logging and more](misc.md#scheduler) |
| `validation`   | `validateAtLeast`-style guards that return the receiver                                   | [Scheduler, logging and more](misc.md#validation) |
| `reflect`      | access to private members through `kotlin-reflect`                                        | [Scheduler, logging and more](misc.md#reflection) |
| `inventory`    | `ItemStack` and `Inventory` helpers, raw player-inventory slot indices                    | [Scheduler, logging and more](misc.md#inventory) |
| `world`        | `Location` helpers                                                                        | [Scheduler, logging and more](misc.md#world) |
| `lang`         | enum lookups ignoring case                                                                | [Scheduler, logging and more](misc.md#enums) |
| `text`         | subscript and superscript digits                                                          | [Scheduler, logging and more](misc.md#text) |
| `type`         | small value types: `Percent`, `LevelWithExp`                                              | [Scheduler, logging and more](misc.md#value-types) |

None of the helpers needs VersatiaCore's runtime; they are plain Kotlin extension functions and
small types. Everything in VersatiaAPI without a visibility modifier is part of the contract;
return types are written out only where the compiler could not infer a precise one, such as
helpers over Bukkit getters.
