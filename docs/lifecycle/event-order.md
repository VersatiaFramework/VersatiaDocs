# The order within an event

At `START` and at `RELOAD` the runtime works through a plugin in a fixed order, and the order
decides what each piece of code can see:

| Step | At `START`                                                     | At `RELOAD`                               |
|------|----------------------------------------------------------------|-------------------------------------------|
| 1    | the files under `resources/` are extracted                     | the same, for files missing from the data folder |
| 2    | the [`@Value` properties](../configuration/index.md) of the main class and of `object`s are set from the files | every `@Value` property is set again |
| 3    | the beans are created in dependency order; constructors run, receiving their [constructor values](../configuration/index.md#in-a-constructor), and each bean's body values are set right after its constructor |                |
| 4    | the [`Reloadable` beans](reload.md#reloadable-beans) are reloaded, in creation order | the same                      |
| 5    | the [listeners](../events.md) are registered and the [background tasks](../tasks/index.md#background-tasks) launched | the running calls of the background tasks are cancelled, their `finally` blocks run, and new calls are launched |
| 6    | the [`@AutoInvoke` functions](auto-invoke.md) of the event run, in descriptor order | the same             |
| 7    |                                                                | the [plugins holding this plugin's beans with values](reload.md#plugins-that-use-the-reloaded-ones-values) reload, each through steps 1 to 6 |
| 8    | at the next tick, the background tasks' `run()` begins         | the same, once the cancelled calls have finished |

Every value is read from the files before step 2, so a broken file stops the event before anything
is set or created. The body values of a bean are set right after its own constructor, before it is
injected anywhere, so a constructor sees the values of the main class and of `object`s, its own
constructor values and every value of the beans it takes, but the placeholders of its own body.

## Why the values come before the reloads {/* #why-the-values-come-before-the-reloads */}

A `reload()` may depend on a value; a value never depends on a `reload()`, because it comes from a
file and nothing else. Were the reloads to run first, a `reload()` reading a value would see what
the property held *before* the event: at start the placeholder, at a reload the previous
configuration. The administrator edits the file, runs `/versatia reload`, and the change would
show only at the next reload. With the values set first, `reload()` sees the current file at both
events. Setting a property is the smaller operation of the two, so it goes first and the bigger
one builds on it.

## What follows at start {/* #what-follows-at-start */}

The first `reload()` of a bean therefore does **not** run inside the bean's creation, as it
would have to for the constructors of its dependents to see a loaded bean: it runs in step 4, once
every bean exists and every value is set. A constructor that reads from a `Reloadable` dependency,
such as the `Messages` instance VersatiaCore [makes](../messages/index.md) for your
plugin, sees it empty:

```kotlin
@LocalBean
class Shop(messages: Messages) {
    val greeting = messages["shop.open"].get()   // throws: the messages have not been read yet
}
```

This is the rule that constructors only wire dependencies, applied to one more case. Read the
dependency when it is needed, or in a function of the event, which runs after the reloads:

```kotlin
@LocalBean
class Shop(private val messages: Messages) {
    val greeting get() = messages["shop.open"].get()   // read on use

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    fun announce() = messages["shop.open"].broadcast()   // step 6, after the reload
}
```

## What follows later {/* #what-follows-later */}

An instance obtained after step 4 is reloaded as soon as it is obtained, so nothing is ever
handed out unloaded. A reload-phase function that is the first to ask for a module's prototype
receives a loaded instance:

```kotlin
@AutoInvoke(Phase.PLUGIN_RELOAD_ONLY)
fun announce(messages: Messages) = messages["reloaded"].broadcast()   // created now, reloaded now, then called
```

## `@Value` on a prototype {/* #value-on-a-prototype */}

A `@Value` property belongs to the plugin that declares the class, and its file is that plugin's.
On an `@ExposePrototype` it is set on every instance, the owner's own and each one made for another
plugin, and every reload of the owner reaches them all:

```kotlin
// Economy, values from Economy's config.yml
@ExposePrototype
class PriceList(@Value("base-price") var basePrice: Double) {
    @Value("tax")
    var tax = 0.0
}

// Shop, which gets its own PriceList
@LocalBean
class Checkout(private val logger: Logger, private val prices: PriceList) {
    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    fun rebuild() = logger.info("Tax is now ${prices.tax}")   // runs again after every reload of Economy
}
```

An instance made later, for a plugin enabled after a reload of Economy, starts with the values of
that reload, constructor values included. A `PreviousValueTracking` in the constructor is a cell of
each instance's own, so `changed` says what changed for that instance since it was made. The
owner's files say nothing about the consumer: a module that needs a setting per consumer reads it
in `reload()` from the consumer's data folder, which is what the prototype receives the consuming
plugin for.
