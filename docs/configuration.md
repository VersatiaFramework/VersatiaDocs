# Configuration values

import ExampleCard from '@site/src/components/ExampleCard';

A value a plugin reads from its configuration is a property marked `@Value`: the runtime sets it
from a YAML file in the data folder when the plugin starts and again at every
[reload](lifecycle/reload.md). No file handling, no getter, no reload function.

<ExampleCard repo="VersatiaExample-Config-Values" file="src/main/kotlin/com/github/marcoral/versatia/example/values/Shop.kt">
Values on the main class, on an object and on a bean, from two files, re-read with <code>/versatia reload values</code>.
</ExampleCard>

```kotlin
import com.github.marcoral.versatia.config.Value

@LocalBean
class Shop {
    @Value("shop.tax")
    var tax = Percent.of(0.0)

    @Value("shop.hours")
    private var hours: List<Int> = emptyList()

    @Value("max-players", file = "limits.yml")
    var maxPlayers = 0
}
```

`key` is the dotted path inside the file, `file` the path relative to the data folder,
`config.yml` unless given (`Value.DEFAULT_FILE`). The file is one the plugin ships under
[`resources/`](resources.md), so the defaults are the file itself and the administrator edits the
extracted copy.

## Where a property may live

| Owner                   | Set on                                      |
|-------------------------|---------------------------------------------|
| the plugin's main class | the plugin instance                         |
| a Kotlin `object`       | the object                                  |
| a bean                  | the bean instance of that plugin            |

The same places an [auto-invoked function](lifecycle/auto-invoke.md#where-a-function-may-live) may
live, for the same reason: the runtime has an instance there. On an `@ExposePrototype` the
property is set on the owner's own instance only, from the owner's files; see
[`@Value` on a prototype](lifecycle/reload.md#value-on-a-prototype). The property must be a `var`, or a `val` holding a
[`PreviousValueTracking`](#reacting-to-a-change); a `lateinit var` works for a type without a
sensible initial value. Visibility does not matter: a
private property, a `private set` or a private class gets a reflective setter in the descriptor,
a visible one a direct assignment. Anything else is a compile error: a `val` of any other type,
a top-level property, a property of a plain class.

## Supported types

| Type                                             | Read as                                                         |
|--------------------------------------------------|-----------------------------------------------------------------|
| `Boolean`, `Int`, `Long`, `Float`, `Double`, `UInt`, `ULong`, `String`, `Percent` | one value, with the [strict getters](utilities/configuration.md): `3000000000` is not an `Int`, `-1` is not a `UInt`, `12.5%` is a `Percent` |
| any enum                                         | one value, matched by constant name ignoring case; `java.time.DayOfWeek` and `Material` included |
| `Color`, `Location`, `OfflinePlayer`, `Vector`, `ItemStack`, `ConfigurationSection` | one value, with Bukkit's own deserialisation |
| `List<T>`, `Set<T>`                              | a YAML list of `T`, for `T` among the scalars and enums above   |
| `Map<String, T>`                                 | a YAML section whose children are `T`, for the same `T`         |

A nullable type makes the value optional: `var closedOn: DayOfWeek? = null` stays `null` when the
key is absent. Every other type, a `MutableList`, a nullable element, a data class, is rejected
at compile time with the list of what is supported, unless a [mapper](#mappers) reads it.

## Mappers

A type of your own, or a value that is not what the file says, is read by a `ValueMapper` named
in the annotation:

```kotlin
import com.github.marcoral.versatia.config.ValueMapper

object TicksFromSeconds : ValueMapper<Long> {
    override fun map(section: ConfigurationSection, key: String) = section.getLongOrThrow(key) * 20
}

data class PriceRange(val min: Int, val max: Int) {
    object Mapper : ValueMapper<PriceRange> {
        override fun map(section: ConfigurationSection, key: String) = section.getConfigurationSectionOrThrow(key).let {
            PriceRange(it.getIntOrThrow("min"), it.getIntOrThrow("max").validateAtLeast(it.getIntOrThrow("min")))
        }
    }
}

@LocalBean
class Shop {
    @Value("shop.restock-seconds", mapper = TicksFromSeconds::class)
    var restockTicks = 0L

    @Value("shop.price-range", mapper = PriceRange.Mapper::class)
    var priceRange = PriceRange(0, 0)

    @Value("ores", mapper = Ores::class)
    var ores: List<Ore> = emptyList()      // Ores maps the children of the section, with mapChildren
}
```

The mapper receives the section holding the key and the key, so it reads with the
[strict getters](utilities/configuration.md), reports with their messages (the full key path
included) and validates with the [guards](utilities/misc.md#validation); whatever it throws fails
the event like a wrong value would. It is an `object` or a class with a no-argument constructor,
and it is called only when the key is present: a missing key follows the nullability of the
property, as for any value. The compile-time step checks that what the mapper maps to fits the
property (`mapper TicksFromSeconds maps to Long, which Int cannot hold`), so a mismatch never
reaches a server. With a mapper, the property may have any type.

## Reacting to a change

A reload sets the property and the old value is gone. Code that must know what changed, to
reschedule a task only when its interval did, say, declares the property as a
`PreviousValueTracking<T>`, a `val` holding a cell the runtime fills:

```kotlin
import com.github.marcoral.versatia.config.PreviousValueTracking

@LocalBean
class Announcer(private val plugin: JavaPlugin) {
    @Value("announce.interval-seconds")
    val interval = PreviousValueTracking<Int>()

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    fun schedule() {
        if (!interval.changed) return                      // true at start, then only when the file changed it
        plugin.logger.info("Announcing every ${interval.value}s" + (interval.previous?.let { ", was ${it}s" } ?: ""))
        // cancel the old task, start a new one ...
    }
}
```

| Member        | Meaning                                                                          |
|---------------|----------------------------------------------------------------------------------|
| `value`       | the value last set; reading it before the runtime set one throws                 |
| `previous`    | the value the last assignment replaced; `null` until the second assignment       |
| `hasPrevious` | whether there is one, which tells a replaced `null` from none                    |
| `changed`     | whether the last assignment changed the value; `true` after the first one        |

The held type follows the same rules as a plain property: any [supported type](#supported-types),
a [mapper](#mappers), nullable for an optional value (`PreviousValueTracking<DayOfWeek?>`); the
cell itself is never nullable and the property is initialised with an empty one. The runtime
stores into `value`, so the property may stay a `val` and even be private. A reload that fails
assigns nothing, so `previous` and `changed` still describe the last reload that succeeded.

## Missing and invalid values

A non-nullable property whose key is absent is an error, and so is a value of the wrong shape or
a file that does not exist:

```
Plugin Shop: com.example.Shop.tax could not be read from config.yml: No value present at "shop.tax"
Plugin Shop: com.example.Shop.tax could not be read from config.yml: Value at "shop.tax" is not a percent string such as "12.5%" (0-100): "8"
Plugin Shop: limits.yml does not exist in the data folder; ship it under resources/ in the JAR
```

There is no default value in the annotation on purpose: the default is in the shipped file, where
the administrator sees it, and a key that disappears is a mistake worth reporting rather than a
silent fallback. At start such an error keeps the plugin disabled; at a reload it reaches the
sender of `/versatia reload`. Every value of the plugin is read before any property is set, so a
broken file leaves the plugin running with the values it had.

## When the values are set

Values are set at `PLUGIN_RELOAD_OR_START`, first: at start once the files are extracted and
the beans exist, at a reload before anything else. The plugin's
[`Reloadable` beans](lifecycle/reload.md#reloadable-beans) are reloaded afterwards, so a
`reload()` may read a value, and the [auto-invoked functions](lifecycle/auto-invoke.md) of the
event run last, so a function reading a `@Value` property always sees the current file. Why this
order and what follows from it, with examples, is under
[The order within an event](lifecycle/reload.md#the-order-within-an-event):

```kotlin
class ShopPlugin : VersatiaPlugin() {
    @Value("motd")
    lateinit var motd: String

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    fun announce() = logger.info(motd)
}
```

Listeners and tasks read the property when they need it rather than copying it when they are
created, like any other [reloadable state](lifecycle/reload.md#designing-for-reload).

## Common mistakes

- **Implementing `Reloadable` to read the plugin's own files.** `Reloadable` exists for the
  prototypes of [modules](modules/index.md), which read the consuming plugin's files and have no
  other way to follow that plugin's reloads. A plugin's own configuration is `@Value` properties,
  with a [mapper](#mappers) for anything the built-in types do not cover; what derives from them
  is rebuilt in a `PLUGIN_RELOAD_OR_START` function. A bean that loads a file in `reload()` is a
  module's job done by hand.
- **Reading a file in a constructor.** Constructors run once; the value never changes on reload.
- **A default in the code.** The initializer of a `@Value` property is overwritten at start and
  never consulted again; a `lateinit var` says so honestly. The default belongs in the shipped
  file, where the administrator sees it; an optional value is a nullable property.
- **Copying a value into a listener or task.** Read the property when the event or tick
  happens; a reload changes the property, not the copy.

## Under the hood

`@Value` is an [enhancement](internals/enhancements.md) like any other: the descriptor records
each property as a `PropertyTarget` with its type and a setter, and
`ValueEnhancementProcessor` (`ConfigProcessors.VALUE`) in VersatiaCore reads the files and
assigns the values, or lets the `ValueMapper` read them. The supported types are listed in
`ValueTypes`, which the compile-time step checks against, and read with the getters of
`util.config`; see
[The descriptor](internals/descriptor.md#propertytarget) and [The runtime](internals/runtime.md#configuration-values).
