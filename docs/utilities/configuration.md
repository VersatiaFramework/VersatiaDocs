# Configuration

Package `com.github.marcoral.versatia.util.config`. A value a plugin only has to hold needs none
of this: mark the property [`@Value`](../configuration.md) and the runtime reads it with these
getters.

## Strict getters {/* #strict-getters */}

Bukkit's own getters are lenient: `getInt` returns `0` for a missing key *and* for a value that is
not a number, so a typo in a config file turns into a silent default. The extension functions on
`ConfigurationSection` separate the two cases:

| Family                    | Key absent        | Value present but invalid              |
|---------------------------|-------------------|----------------------------------------|
| `getXOrNull(key)`         | `null`            | throws `ConfigurationValueException`    |
| `getXOrThrow(key, msg?)`  | throws            | throws                                 |
| `ifXPresent(key) { }`     | action not run    | throws                                 |
| `getX(key, default)`      | `default`         | throws                                 |
| `isX(key)`                | `false`           | `false`                                |
| `getXListOrNull(key)`     | `null`            | throws for a single value or an invalid element, naming its index |
| `getXListOrThrow(key, msg?)` | throws         | the same                               |
| `getXList(key)`           | empty list        | the same                               |

```kotlin
val size = config.getIntOrThrow("chest.size")
val limit = config.getIntOrNull("chest.limit") ?: 54
val chance = config.getPercent("drop.chance", Percent.of(50.0))
config.ifStringPresent("motd") { VersatiaEngine.broadcast(Component.text(it)) }
val hours = config.getIntListOrThrow("shop.hours")
val slots = config.getUIntList("slots")
```

Which families exist for which `X`:

| `X`                                                         | Families                                                    |
|-------------------------------------------------------------|-------------------------------------------------------------|
| `Boolean`, `Int`, `Long`, `Float`, `Double`, `String`        | `getXOrNull`, `getXOrThrow`, `ifXPresent`, `getXListOrNull`, `getXListOrThrow` |
| `UInt`, `ULong`, `Percent`, `Duration`, any enum             | all single-value families, and `getXList`                   |
| `UByte`, `UShort`                                            | `getXList`                                                  |
| `Color`, `ItemStack`, `Location`, `Vector`, `OfflinePlayer`, `ConfigurationSection` | `getXOrThrow`, `ifXPresent`            |

Enums are read with `getEnumElementOrThrow<Material>("block")`, or
`getEnumElementOrThrow("block", enumClass)` for an enum class known only at runtime.

:::warning[Bukkit's members win]

For the types Bukkit reads itself, the lenient Bukkit member of the same name is what Kotlin calls:
`config.getInt("size", 5)` is Bukkit's `getInt(String, int)`, which returns `5` for a value that
is not a number, and `config.getIntegerList("hours")` skips elements it cannot read. Members
always win over extensions, so no strict `getX(key, default)`, `isX` or `getXList` exists for
those types. Write `getIntOrNull("size") ?: 5` and `getIntListOrThrow("hours")` instead.

:::

"Invalid" is type-specific and strict:

- `getIntOrNull` accepts only an `Int`. A YAML value such as `3000000000` loads as `Long` and is
  rejected; use `getLongOrNull`.
- Unsigned getters reject negative numbers instead of wrapping them.
- `getPercent*` requires a trailing `%` (`"12.5%"`).
- `getDuration*` reads a `kotlin.time.Duration` written in Kotlin's notation, `30s`, `5m`,
  `1h 30m`, `500ms`, `2d`, or in ISO-8601, `PT5M`. A bare number such as `300` is rejected, since
  it names no unit: `Value at "period" is not a duration such as "30s", "5m" or "1h 30m" (units d, h, m, s, ms; must not be negative): "300"`.
  Negative and infinite durations (`-5s`, `Infinity`) are rejected with the same message.
- Enum getters match the constant name ignoring case and list the allowed names in the error.

Every `ConfigurationValueException` message contains the full dotted path of the key
(`section.pathOf(key)`), so the user can find the line in the file. The optional `exceptionMessage`
parameter of the `OrThrow` family replaces the default message for both failure modes.

### Adding your own type {/* #adding-your-own-type */}

Build on the generic entry point:

```kotlin
fun ConfigurationSection.getMaterialOrThrow(key: String) =
    getOrThrow(key, "a Material") { Material.matchMaterial(getString(it)!!) }
```

### Other helpers {/* #other-helpers */}

- `mapChildren { key, section -> }` maps every child section.
- `asStringsMap()` maps the direct children of a section into `Map<String, String>`; a child that
  is a section or a list throws.

## YAML files {/* #yaml-files */}

- `loadYamlOrThrow(file)` propagates parse errors. Bukkit's `YamlConfiguration.loadConfiguration`
  logs them and returns an empty configuration, which hides broken files.
- `Plugin.forEachYamlFile(relativePath) { path, config -> }` and `Plugin.mapYamlFiles` walk a
  directory under the plugin's data folder recursively, in path order, and visit only files with a
  `.yml` or `.yaml` extension (`YAML_EXTENSIONS`).
