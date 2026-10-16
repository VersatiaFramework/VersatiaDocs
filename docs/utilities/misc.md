# Scheduler, logging and more

The smaller helper packages under `com.github.marcoral.versatia.util`. Server-wide calls, such as
finding players, broadcasting or loading a service, are on [`VersatiaEngine`](index.md#start-with-versatiaengine).

## Logging {/* #logging */}

Package `util.plugin`. Shorthands over `Plugin.logger` for places that hold a `Plugin`, such as a
bean that takes the plugin as a constructor parameter:

```kotlin
plugin.log("Loaded")                       // INFO
plugin.log(Level.FINE) { "expensive $detail" }   // message built only if the level is enabled
plugin.logWarning("Config key missing")
plugin.logSevere("Could not save", cause)
```

Inside the plugin class itself, `logger.info(...)` is just as short; the helpers add nothing there.

## Scheduler {/* #scheduler */}

Package `util.scheduler`. Wrappers over `BukkitScheduler` that take the plugin as receiver:

```kotlin
plugin.runTask { /* next tick, main thread */ }
plugin.runTaskLater(20) { /* in one second */ }
plugin.runTaskTimer(periodTicks = 20) { /* every second, from the next tick */ }
plugin.runTaskAsynchronously { /* off the main thread */ }
plugin.callSyncMethod { VersatiaEngine.onlinePlayers.size }   // Future<Int> from an async thread
plugin.cancelAllTasks()
```

The timer variants keep Bukkit's parameter order, `delayTicks` before `periodTicks`. The delay
defaults to `0`, so a timer that starts at once names its period: `runTaskTimer(periodTicks = 20)`.

Each variant has a `*WithContext` twin whose lambda receives the `BukkitTask`, so a repeating task
can cancel itself:

```kotlin
plugin.runTaskTimerWithContext(delayTicks = 100, periodTicks = 20) { task ->
    if (done) task.cancel()
}
```

## Validation {/* #validation */}

Package `util.validation`. `validate`, `validateAtLeast`, `validateAtMost`, `validateBetween`,
`validateIn`, `validateGreaterThan`, `validateLessThan`, `validateZero` and `validateNotZero` wrap
`require` and **return the receiver**, so they chain inline:

```kotlin
val size = config.getIntOrThrow("size").validateAtLeast(1) { "size must be positive" }
```

They are generic over `Comparable<T>` (or `Number` for the zero checks). Messages are lambdas and
evaluated only on failure.

## Reflection {/* #reflection */}

Package `util.reflect`, built on `kotlin-reflect`.

- `KProperty1.forceGetValue(instance)`, `KMutableProperty1.forceSetValue(instance, value)` and
  `KFunction.forceInvoke(args)` temporarily make a member accessible and **restore the previous
  accessibility afterwards**.
- Properties of Kotlin `object`s are backed by static fields, which `kotlin-reflect` cannot set
  through `KMutableProperty1.set` on the instance. The helpers detect a static backing field and go
  through `java.lang.reflect.Field` instead.
- `KClass.forceGetObjectInstance()` and `getObjectInstanceOrThrow()` read an `object`'s instance
  even when the object is private.
- `isClassInClasspath(name, classLoader)` takes the loader explicitly, because every plugin on a
  Paper server has its own class loader. The class is loaded without initialization, so no static
  initializers run as a side effect.

:::note[Runtime requirement]

`kotlin-reflect` is on the server because VersatiaCore lists it under `libraries:`. Your plugin
reaches it through `depend: [VersatiaCore]` and must not list it itself.

:::

## Inventory {/* #inventory */}

Package `util.inventory`.

- `ItemStack?.isNullOrAir()`.
- `Inventory.getAmountOfSimilarItems(item)` and the same on `Array<ItemStack?>`.
- `ItemStack.loreWithoutDefaultFormat(lore)` / `ItemMeta.loreWithoutDefaultFormat(lore)` and
  `List<Component>.withoutDefaultItemFormat()` strip the italic purple default that Minecraft
  applies to lore lines.
- `PlayerInventorySlots` holds the raw slot indices of the player inventory;
  `Int.toEquipmentSlotOrNull()` maps an armour slot index to its `EquipmentSlot`.

## World {/* #world */}

Package `util.world`.

- `Location.getCircleAround(radius, points = 100)` returns evenly spaced points on a horizontal
  circle around the location.
- `Location.spawnParticle(...)` spawns a particle at the location and does nothing when the world
  is not loaded.

## Enums {/* #enums */}

Package `util.lang`. `asEnumIgnoreCase<T>(name)`, `asEnumIgnoreCaseOrThrow<T>(name)` and
`isEnumIgnoreCase<T>(name)` look up enum constants without caring about case; the configuration
getters use them for enum values.

## Text {/* #text */}

Package `util.text`. `toSubscript()` and `toSuperscript()` on `Int`, `Long`, `UInt`, `ULong` and
`String` convert digits and a leading minus to their Unicode sub- and superscript forms
(`12.toSuperscript()` is `¹²`, `"-3".toSubscript()` is `₋₃`). A string holding anything else
throws `IllegalArgumentException`.

## Value types {/* #value-types */}

Package `util.type`.

- `Percent` is an inline value class around a `Double` in `0..100`, comparable. Create it with
  `Percent.of(12.5)`, `Percent.of(current, total)`, `Percent.ofNormalizedValue(0.125)` or
  `Percent.parse("12.5%")`; `normalizedValue` gives the `0..1` form. The configuration getters
  parse the `"12.5%"` notation.
- `LevelWithExp` pairs a level with an experience fraction; `ImmutableLevelWithExp` and
  `MutableLevelWithExp` implement it.
