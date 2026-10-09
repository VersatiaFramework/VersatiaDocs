# Configuration

Package `com.github.marcoral.versatia.util.config`.

## Strict getters

Bukkit's own getters are lenient: `getInt` returns `0` for a missing key *and* for a value that is
not a number, so a typo in a config file turns into a silent default. The extension functions on
`ConfigurationSection` separate the two cases:

| Family                    | Key absent        | Value present but invalid              |
|---------------------------|-------------------|----------------------------------------|
| `getXOrNull(key)`         | `null`            | throws `ConfigurationValueException`    |
| `getX(key, default)`      | `default`         | throws                                 |
| `getXOrThrow(key, msg?)`  | throws            | throws                                 |
| `isX(key)`                | `false`           | `false`                                |
| `ifXPresent(key) { }`     | action not run    | throws                                 |
| `getXList(key)`           | empty list        | throws, naming the element index       |

```kotlin
val size = config.getIntOrThrow("chest.size")
val chance = config.getPercent("drop.chance", Percent.of(50.0))
config.ifStringPresent("motd") { server.motd(Component.text(it)) }
val slots = config.getUIntList("slots")
```

Supported `X`: `Boolean`, `Int`, `Long`, `Double`, `UInt`, `ULong`, `String`, `Percent`,
`Color`, `ItemStack`, `Location`, `Vector`, `OfflinePlayer`, `ConfigurationSection` and any enum
(`getEnumElementOrThrow<Material>("block")`). Not every family exists for every type; the IDE
completion shows what is there.

"Invalid" is type-specific and strict:

- `getIntOrNull` accepts only an `Int`. A YAML value such as `3000000000` loads as `Long` and is
  rejected; use `getLongOrNull`.
- Unsigned getters reject negative numbers instead of wrapping them.
- `getPercent*` requires a trailing `%` (`"12.5%"`).
- Enum getters match the constant name ignoring case and list the allowed names in the error.

Every `ConfigurationValueException` message contains the full dotted path of the key
(`section.pathOf(key)`), so the user can find the line in the file. The optional `exceptionMessage`
parameter of the `OrThrow` family replaces the default message for both failure modes.

### Adding your own type

Build on the generic entry point:

```kotlin
fun ConfigurationSection.getMaterialOrThrow(key: String) =
    getOrThrow(key, "a Material") { Material.matchMaterial(getString(it)!!) }
```

### Other helpers

- `mapChildren { key, section -> }` maps every child section.
- `asStringsMap()` flattens a section into `Map<String, String>`.

## YAML files

- `loadYamlOrThrow(file)` propagates parse errors. Bukkit's `YamlConfiguration.loadConfiguration`
  logs them and returns an empty configuration, which hides broken files.
- `Plugin.forEachYamlFile(relativePath) { path, config -> }` and `Plugin.mapYamlFiles` walk a
  directory under the plugin's data folder recursively, in path order, and visit only files with a
  `.yml` or `.yaml` extension (`YAML_EXTENSIONS`).
- `joinPath(vararg elements)` joins path elements with the platform separator.
