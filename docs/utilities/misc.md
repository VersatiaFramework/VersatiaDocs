# Server, scheduler and more

The smaller helper packages under `com.github.marcoral.versatia.util`.

## Logging

Package `util.plugin`. Shorthands over `Plugin.logger` for places where only a `Plugin` reference
is at hand, for example a bean that looks its plugin up with `JavaPlugin.getProvidingPlugin`:

```kotlin
plugin.log("Loaded")                       // INFO
plugin.log(Level.FINE) { "expensive $detail" }   // message built only if the level is enabled
plugin.logWarning("Config key missing")
plugin.logSevere("Could not save", cause)
```

Inside the plugin class itself, `logger.info(...)` is just as short; the helpers add nothing there.

## Scheduler

Package `util.scheduler`. Wrappers over `BukkitScheduler` that take the plugin as receiver:

```kotlin
plugin.runTask { /* next tick, main thread */ }
plugin.runTaskLater(20) { /* in one second */ }
plugin.runTaskTimer(periodTicks = 20, delayTicks = 0) { /* every second */ }
plugin.runTaskAsynchronously { /* off the main thread */ }
plugin.callSyncMethod { server.onlinePlayers.size }   // Future<Int> from an async thread
plugin.cancelAllTasks()
```

Each variant has a `*WithContext` twin whose lambda receives the `BukkitTask`, so a repeating task
can cancel itself:

```kotlin
plugin.runTaskTimerWithContext(periodTicks = 20, delayTicks = 0) { task ->
    if (done) task.cancel()
}
```

## Server

Package `util.server`.

| Function                      | Does                                                        |
|-------------------------------|-------------------------------------------------------------|
| `isPrimaryThread()`           | `Bukkit.isPrimaryThread()`                                  |
| `checkPrimaryThread()`        | throws unless on the main thread                            |
| `checkNotPrimaryThread()`     | throws when on the main thread                              |
| `bukkitPrintln(component)`    | sends a `Component` to the console                          |
| `bukkitBroadcast(component)`  | broadcasts a `Component`; returns the number of recipients  |
| `forEachOnlinePlayer { }`     | iterates the online players                                 |
| `loadService<T>()`            | the provider registered for `T` in the `ServicesManager`; `ServiceNotRegisteredException` names the service when there is none |
| `loadServiceOrNull<T>()`      | the same, or null                                           |

## Validation

Package `util.validation`. `validate`, `validateAtLeast`, `validateAtMost`, `validateBetween`,
`validateIn`, `validateGreaterThan`, `validateLessThan`, `validateZero` and `validateNotZero` wrap
`require` and **return the receiver**, so they chain inline:

```kotlin
val size = config.getIntOrThrow("size").validateAtLeast(1) { "size must be positive" }
```

They are generic over `Comparable<T>` (or `Number` for the zero checks). Messages are lambdas and
evaluated only on failure.

## Reflection

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

## Inventory

Package `util.inventory`.

- `ItemStack?.isNullOrAir()`.
- `Inventory.getAmountOfSimilarItems(item)` and the same on `Array<ItemStack?>`.
- `ItemStack.loreWithoutDefaultFormat(lore)` / `ItemMeta.loreWithoutDefaultFormat(lore)` and
  `List<Component>.withoutDefaultItemFormat()` strip the italic purple default that Minecraft
  applies to lore lines.
- `PlayerInventorySlots` holds the raw slot indices of the player inventory;
  `Int.toEquipmentSlotOrNull()` maps an armour slot index to its `EquipmentSlot`.

## World

Package `util.world`.

- `Location.getCircleAround(radius, points = 100)` returns evenly spaced points on a horizontal
  circle around the location.
- `Location.spawnParticle(...)` spawns a particle at the location and does nothing when the world
  is not loaded.

## Enums

Package `util.lang`. `asEnumIgnoreCase<T>(name)`, `asEnumIgnoreCaseOrThrow<T>(name)` and
`isEnumIgnoreCase<T>(name)` look up enum constants without caring about case; the configuration
getters use them for enum values.

## Text

Package `util.text`. `toSubscript()` and `toSuperscript()` on `Int`, `Long`, `UInt`, `ULong` and
`String` convert digits to their Unicode sub- and superscript forms (`"x2".toSuperscript()` is `x²`).

## Value types

Package `util.type`.

- `Percent` is an inline value class around a `Double` in `0..100`, comparable. Create it with
  `Percent.of(12.5)`, `Percent.of(current, total)`, `Percent.ofNormalizedValue(0.125)` or
  `Percent.parse("12.5%")`; `normalizedValue` gives the `0..1` form. The configuration getters
  parse the `"12.5%"` notation.
- `LevelWithExp` pairs a level with an experience fraction; `ImmutableLevelWithExp` and
  `MutableLevelWithExp` implement it.
