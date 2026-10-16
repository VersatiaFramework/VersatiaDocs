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
    var tax = Percent.ZERO

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

## Where a property may live {/* #where-a-property-may-live */}

| Owner                   | Set on                                      |
|-------------------------|---------------------------------------------|
| the plugin's main class | the plugin instance                         |
| a Kotlin `object`       | the object                                  |
| a bean                  | the bean instance of that plugin            |

The same places an [auto-invoked function](lifecycle/auto-invoke.md#where-a-function-may-live) may
live, for the same reason: the runtime has an instance there. On an `@ExposePrototype` the
property is set on every instance, the owner's own and each one made for another plugin, from the
owner's files, and a reload of the owner updates them all and then reloads the plugins holding
them; see [`@Value` on a prototype](lifecycle/reload.md#value-on-a-prototype). In a bean the property may
also be declared [in the primary constructor](#in-a-constructor). The property must be a `var`,
or a `val` holding a [`PreviousValueTracking`](#reacting-to-a-change). Visibility does not
matter: a private property, a `private set` or a private class gets a reflective setter in the
descriptor, a visible one a direct assignment. Anything else is a compile error: a `val` of any
other type, a plain constructor parameter, a parameter of a function, a top-level property, a
property of a plain class.

The initializer is only a placeholder until the runtime sets the value, so pick what reads best:
`lateinit var motd: String` for a reference type, `var maxPlayers = 0` or
`var tax = Percent.ZERO` for a primitive or a value class such as `Int`, `UInt` or `Percent`,
which Kotlin does not allow as `lateinit`.

## Supported types {/* #supported-types */}

| Type                                             | Read as                                                         |
|--------------------------------------------------|-----------------------------------------------------------------|
| `Boolean`, `Int`, `Long`, `Float`, `Double`, `UInt`, `ULong`, `String`, `Percent` | one value, with the [strict getters](utilities/configuration.md): `3000000000` is not an `Int`, `-1` is not a `UInt`, `12.5%` is a `Percent` |
| any enum                                         | one value, matched by constant name ignoring case; `java.time.DayOfWeek` and `Material` included |
| `Color`, `Location`, `OfflinePlayer`, `Vector`, `ItemStack`, `ConfigurationSection` | one value, with Bukkit's own deserialisation |
| `List<T>`, `Set<T>`                              | a YAML list of `T`, for `T` among the scalars and enums above, every element checked like a single value; a single value where the list belongs is an error, not a list of one |
| `Map<String, T>`                                 | a YAML section whose children are `T`, for the same `T`         |

A nullable type makes the value optional: `var closedOn: DayOfWeek? = null` stays `null` when the
key is absent. Every other type, a `MutableList`, a nullable element, a data class, is rejected
at compile time with the list of what is supported, unless a [mapper](#mappers) reads it.

## Mappers {/* #mappers */}

A type of your own, or a value that is not what the file says, is read by a `ValueMapper` named
in the annotation:

```kotlin
import com.github.marcoral.versatia.config.SectionMapper
import com.github.marcoral.versatia.config.ValueMapper

object TicksFromSeconds : ValueMapper<Long> {
    override fun map(section: ConfigurationSection, key: String) = section.getLongOrThrow(key) * 20
}

data class PriceRange(val min: Int, val max: Int) {
    object Mapper : SectionMapper<PriceRange>() {
        override fun map(section: ConfigurationSection): PriceRange {
            val min = section.getIntOrThrow("min")
            return PriceRange(min, section.getIntOrThrow("max").validateAtLeast(min))
        }
    }
}

data class Ore(val name: String, val veins: Int)

object Ores : SectionMapper<List<Ore>>() {
    override fun map(section: ConfigurationSection) = section.mapChildren { name, ore -> Ore(name, ore.getIntOrThrow("veins")) }
}

@LocalBean
class Shop {
    @Value("shop.restock-seconds", mapper = TicksFromSeconds::class)
    var restockTicks = 0L

    @Value("shop.price-range", mapper = PriceRange.Mapper::class)
    var priceRange = PriceRange(0, 0)

    @Value("ores", mapper = Ores::class)
    var ores: List<Ore> = emptyList()
}
```

```yaml
# config.yml
shop:
  restock-seconds: 30
  price-range:
    min: 5
    max: 50
ores:
  iron:
    veins: 8
  gold:
    veins: 3
```

The mapper receives the section holding the key and the key, so it reads with the
[strict getters](utilities/configuration.md), reports with their messages (the full key path
included) and validates with the [guards](utilities/misc.md#validation); whatever it throws fails
the event like a wrong value would. It is an `object` or a class with a no-argument constructor,
and it is called only when the key is present: a missing key follows the nullability of the
property, as for any value. The compile-time step checks that what the mapper maps to fits the
property (`mapper TicksFromSeconds maps to Long, which Int cannot hold`), so a mismatch never
reaches a server. With a mapper, the property may have any type.

A value written as a section of its own, the usual shape of a data class, takes a `SectionMapper`,
as `PriceRange.Mapper` above: its `map(section)` receives that section, and a key holding
anything else fails with `Value at "shop.price-range" is not a section: "5"`.

## Reacting to a change {/* #reacting-to-a-change */}

A reload sets the property and the old value is gone. Code that must know what changed, to
reschedule a task only when its interval did, say, declares the property as a
`PreviousValueTracking<T>`, a `val` holding a cell the runtime fills:

```kotlin
import com.github.marcoral.versatia.config.PreviousValueTracking

@LocalBean
class Announcer(private val plugin: JavaPlugin) {
    @Value("announce.interval-seconds")
    val interval = PreviousValueTracking<Int>()

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
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

## Missing and invalid values {/* #missing-and-invalid-values */}

A non-nullable property whose key is absent is an error, and so is a value of the wrong shape or
a file that does not exist:

```
Plugin Shop: com.example.Shop.tax could not be read from config.yml: No value present at "shop.tax"
Plugin Shop: com.example.Shop.tax could not be read from config.yml: Value at "shop.tax" is not a percent string such as "12.5%" (0-100): "8"
Plugin Shop: config.yml could not be read
Plugin Shop: limits.yml is missing from the data folder; put it back, or reload the plugin to restore the default copy from the plugin JAR
```

The third line comes with the YAML parser's message as its cause, pointing at the line. When the
JAR has no `resources/limits.yml` either, the last message says so and tells the developer to
ship one. There is no default value in the annotation on purpose: the default is in the shipped
file, where the administrator sees it, and a key that disappears is a mistake worth reporting
rather than a silent fallback. At start such an error keeps the plugin disabled; at a reload it
reaches the sender of `/versatia reload` and is logged as one warning, without a stack trace.
Every value of the plugin is read before any property is set, so a broken file leaves the plugin
running with the values it had.

## In a constructor {/* #in-a-constructor */}

A bean may declare a value as a property of its primary constructor:

```kotlin
@LocalBean
class Shop(
    private val plugin: JavaPlugin,
    @Value("shop.tax") var tax: Percent,
    @Value("announce.interval-seconds") val interval: PreviousValueTracking<Int>,
)
```

The value is read before the bean is created and passed to the constructor, so the constructor
already sees it, and it needs no placeholder initializer. At every reload the property is set
again like any other. The parameter must be a property: `var`, or a `val` holding a
`PreviousValueTracking`, which receives a cell already holding the value. A `val` of another type
or a plain parameter is a compile error,
`Shop.tax must be a var to be enhanced; declare the constructor parameter as a property`.

## Values that derive from others {/* #values-that-derive-from-others */}

A reload sets the `@Value` properties and nothing else. A value computed from them is kept
current in one of three ways, from the simplest:

1. **Compute it where it is used.** A getter costs nothing and is never stale:

    ```kotlin
    @LocalBean
    class Shop {
        @Value("shop.price")
        var price = 0

        @Value("shop.tax")
        var tax = Percent.ZERO

        val priceWithTax get() = price * (1 + tax.normalizedValue)
    }
    ```

2. **Recompute it in a `PLUGIN_RELOAD_OR_START` function**, when it is expensive or built once
   per configuration. The function runs after the values are set, at start and at every reload:

    ```kotlin
    @LocalBean
    class Shop {
        @Value("shop.name")
        lateinit var name: String

        var label = text("")
            private set

        @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
        fun recompute() {
            label = MiniMessage.miniMessage().deserialize("<gold>$name")
        }
    }
    ```

3. **React to a change** with a [`PreviousValueTracking`](#reacting-to-a-change), when the work
   should happen only if the value changed, such as rescheduling a task: the `Announcer` above
   checks `interval.changed`.

## When the values are set {/* #when-the-values-are-set */}

Values are set at `PLUGIN_RELOAD_OR_START`. At start the files are extracted first; a value
declared in a bean's constructor is read before that bean is created, and a value of a bean's
body is set once the bean exists. At a reload the values are set before anything else. The
plugin's [`Reloadable` beans](lifecycle/reload.md#reloadable-beans) are reloaded afterwards, so a
`reload()` may read a value, and the [auto-invoked functions](lifecycle/auto-invoke.md) of the
event run last, so a function reading a `@Value` property always sees the current file. Why this
order and what follows from it, with examples, is under
[The order within an event](lifecycle/reload.md#the-order-within-an-event):

```kotlin
class ShopPlugin : VersatiaPlugin() {
    @Value("motd")
    lateinit var motd: String

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    fun announce() = logger.info(motd)
}
```

Listeners and tasks read the property when they need it rather than copying it when they are
created, like any other [reloadable state](lifecycle/reload.md#designing-for-reload).

## Common mistakes {/* #common-mistakes */}

- **Implementing `Reloadable` to read the plugin's own files.** `Reloadable` exists for the
  prototypes of [modules](modules/index.md), which read the consuming plugin's files and have no
  other way to follow that plugin's reloads. A plugin's own configuration is `@Value` properties,
  with a [mapper](#mappers) for anything the built-in types do not cover; what derives from them
  is rebuilt in a `PLUGIN_RELOAD_OR_START` function. A bean that loads a file in `reload()` is a
  module's job done by hand.
- **Reading a file in a constructor.** Constructors run once; the value never changes on reload.
- **A default in the code.** The initializer of a `@Value` property is overwritten at start and
  never consulted again, so it is a placeholder, not a default: `lateinit` where Kotlin allows it,
  `0` or `Percent.ZERO` where it does not. The default belongs in the shipped file, where the
  administrator sees it; an optional value is a nullable property.
- **Copying a value into a listener or task.** Read the property when the event or tick
  happens; a reload changes the property, not the copy.

## Corner cases {/* #corner-cases */}

- **A copy made in a constructor is not updated.** With `class Shop(@Value("shop.tax") var tax:
  Percent) { val rate = tax.normalizedValue }` a reload sets `tax`, but `rate` keeps the value of
  the start. Derive it with one of the [three patterns](#values-that-derive-from-others).
- **A constructor sees the values of the main class and of `object`s.** At start they are set
  before any bean is created, so `class Shop(plugin: ShopPlugin) { val title = plugin.title }`
  reads the configured `title`, never the placeholder. A property declared in the body of a bean
  is set right after that bean's constructor, before the bean is injected anywhere, so
  `class Shop(prices: PriceList)` sees every value of `prices`, but the placeholders of its own
  body; a bean that needs its own value at construction declares it [in its constructor](#in-a-constructor).
- **A prototype's values follow the owner.** An `@ExposePrototype` instance made for another
  plugin takes its values from the owner's files: its constructor receives the values the owner
  read last (an instance made after a reload gets that reload's), its body values are set right
  after, and every reload of the owner sets them again and then reloads the consumer. A tracked
  constructor value is a cell of each instance's own.

- **The file stays inside the data folder.** `file` is a relative path to a `.yml` or `.yaml`
  file; an absolute path or a `..` segment is a compile error, and the runtime refuses any path
  that leaves the data folder once normalised.
- **Values come before functions.** At start and at every reload all values are set before any
  `@AutoInvoke` function of the event runs, and a failed read leaves every value as it was and runs
  no function.
- **A single value where a list belongs** (`hours: 9` for a `List<Int>`) is an error, not a list
  of one. An absent key is never an empty list: it is a missing value, `null` for a nullable
  `List<Int>?` and an error otherwise; write `hours: []` for an empty one.
- **An override is annotated once.** When a base class declares `@Value("limit") open var
  limit`, a subclass overrides it without `@Value`: the value set through the base property
  already reaches the override, and annotating both is a compile error.
- **Both annotation targets work on a constructor property.** `@Value("k") var x: Int` and
  `@property:Value("k") var x: Int` in a primary constructor are the same: the value is passed to
  the constructor and updated at every reload.

## Under the hood {/* #under-the-hood */}

`@Value` is an [enhancement](internals/enhancements.md) like any other: the descriptor records
each property as a `PropertyTarget` with its type and a setter, and
`ValueEnhancementProcessor` (`ConfigProcessors.VALUE`) in VersatiaCore reads the files and
assigns the values, or lets the `ValueMapper` read them. The supported types are listed in
`ValueTypes`, which the compile-time step checks against, and read with the getters of
`util.config`; see
[The descriptor](internals/descriptor.md#propertytarget) and [The runtime](internals/runtime.md#configuration-values).
