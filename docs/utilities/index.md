# Utilities

Besides the framework itself, VersatiaAPI ships a set of independent helpers over the Paper API.
They live under `com.github.marcoral.versatia.util`, grouped into sub-packages by the domain they
touch. None of them needs VersatiaCore's runtime; they are plain Kotlin extension functions and
small types.

| Package        | Contents                                                                                 | Page |
|----------------|------------------------------------------------------------------------------------------|------|
| `config`       | strict typed getters for `ConfigurationSection`, YAML file traversal                     | [Configuration](configuration.md) |
| `collection`   | `addOrThrow`/`putAllOrThrow`-style helpers, `DeepMergeMap`                                | [Collections](collections.md) |
| `plugin`       | `Plugin.log`, `logWarning`, `logSevere`                                                   | [Server, scheduler and more](misc.md#logging) |
| `scheduler`    | `Plugin.runTask*` wrappers over `BukkitScheduler`                                         | [Server, scheduler and more](misc.md#scheduler) |
| `server`       | primary-thread checks, console and broadcast shorthands, `loadService<T>()`              | [Server, scheduler and more](misc.md#server) |
| `validation`   | `validateAtLeast`-style guards that return the receiver                                   | [Server, scheduler and more](misc.md#validation) |
| `reflect`      | access to private members through `kotlin-reflect`                                        | [Server, scheduler and more](misc.md#reflection) |
| `inventory`    | `ItemStack` and `Inventory` helpers, raw player-inventory slot indices                    | [Server, scheduler and more](misc.md#inventory) |
| `world`        | `Location` helpers                                                                        | [Server, scheduler and more](misc.md#world) |
| `lang`         | enum lookups ignoring case                                                                | [Server, scheduler and more](misc.md#enums) |
| `text`         | subscript and superscript digits                                                          | [Server, scheduler and more](misc.md#text) |
| `type`         | small value types: `Percent`, `LevelWithExp`                                              | [Server, scheduler and more](misc.md#value-types) |

Everything in VersatiaAPI without a visibility modifier is part of the contract; return types are
written out only where the compiler could not infer a precise one, such as helpers over Bukkit
getters.
