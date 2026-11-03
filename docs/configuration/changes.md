# Changes and derived values

A [`@Value` property](index.md) is set again at every [reload](../lifecycle/reload.md). Code that
acts on a new value, or keeps a value computed from others current, uses one of the patterns below.

## Reacting to a change {/* #reacting-to-a-change */}

A reload sets the property and the old value is gone. Code that must know what changed, to
reschedule a task only when its interval did, say, declares the property as a
`PreviousValueTracking<T>`, a `val` holding a cell the runtime fills:

```kotlin
import dev.versatia.config.PreviousValueTracking

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

The held type follows the same rules as a plain property: any [supported type](types.md#supported-types),
a [mapper](types.md#mappers), nullable for an optional value (`PreviousValueTracking<DayOfWeek?>`); the
cell itself is never nullable and the property is initialised with an empty one. The runtime
stores into `value`, so the property may stay a `val` and even be private. A reload that fails
assigns nothing, so `previous` and `changed` still describe the last reload that succeeded.

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

## Corner cases {/* #corner-cases */}

- **A copy made in a constructor is not updated.** With `class Shop(@Value("shop.tax") var tax:
  Percent) { val rate = tax.normalizedValue }` a reload sets `tax`, but `rate` keeps the value of
  the start. Derive it with one of the [three patterns](#values-that-derive-from-others).
