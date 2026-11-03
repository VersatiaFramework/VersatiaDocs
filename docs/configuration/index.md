---
counterpart: /admin/configuration-files
---
# Reading values

import ExampleCard from '@site/src/components/ExampleCard';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

A value a plugin reads from its configuration is a property marked `@Value`: the runtime sets it
from a YAML file in the data folder when the plugin starts and again at every
[reload](../lifecycle/reload.md). No file handling, no getter, no reload function.

<ExampleCard repo="VersatiaExample-Config-Values" file="src/main/kotlin/dev/versatia/example/values/Shop.kt">
Values on the main class, on an object and on a bean, from two files, re-read with <code>/versatia reload values</code>.
</ExampleCard>

<CodeCards>
<CodeCard title="Shop.kt">

```kotlin
import dev.versatia.config.Value

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

</CodeCard>
<CodeCard title="config.yml">

```yaml
shop:
  tax: 8%
  hours: [9, 17]
```

</CodeCard>
<CodeCard title="limits.yml">

```yaml
max-players: 20
```

</CodeCard>
</CodeCards>

`key` is the dotted path inside the file, `file` the path relative to the data folder,
`config.yml` unless given (`Value.DEFAULT_FILE`). The file is one the plugin ships under
[`resources/`](../resources.md), so the defaults are the file itself and the administrator edits the
extracted copy.

:::admin

The server admin edits the values in `plugins/<Name>/` and applies them with `/versatia reload <name>`;
[Configuration files](/admin/configuration-files) in the server admin guide explains how values are
written and what a mistake does.

:::

The types a value may have, durations, secrets and mappers among them, are on [Value
types](types.md); acting on a new value and keeping derived values current on [Changes and derived
values](changes.md).

## Where a property may live {/* #where-a-property-may-live */}

| Owner                   | Set on                                      |
|-------------------------|---------------------------------------------|
| the plugin's main class | the plugin instance                         |
| a Kotlin `object`       | the object                                  |
| a bean                  | the bean instance of that plugin            |
| a plain [`Listener`](../events.md) or [`BackgroundTask`](../tasks/index.md#background-tasks), or any class a [subclass enhancement](../internals/enhancements.md#subclass-enhancements) creates | the one instance the plugin creates for it, which stays no bean |

The same places an [auto-invoked function](../lifecycle/auto-invoke.md#where-a-function-may-live) may
live, for the same reason: the runtime has an instance there. On an `@ExposePrototype` the
property is set on every instance, the owner's own and each one made for another plugin, from the
owner's files, and a reload of the owner updates them all and then reloads the plugins holding
them; see [`@Value` on a prototype](../lifecycle/event-order.md#value-on-a-prototype). On a plain listener or
task the property is set right after its constructor, before the listener is registered or the
task first runs, and again at every reload, before the task restarts. In a bean or a plain
listener or task the property may also be declared [in the primary constructor](#in-a-constructor). The property must be a `var`,
or a `val` holding a [`PreviousValueTracking`](changes.md#reacting-to-a-change). Visibility does not
matter: a private property, a `private set` or a private class gets a reflective setter in the
descriptor, a visible one a direct assignment. Anything else is a compile error: a `val` of any
other type, a plain constructor parameter, a parameter of a function, a top-level property, a
property of a plain class that nothing creates.

The initializer is only a placeholder until the runtime sets the value, so pick what reads best:
`lateinit var motd: String` for a reference type, `var maxPlayers = 0`,
`var tax = Percent.ZERO`, `var period = 30.seconds` or `var token = Secret.EMPTY` for a primitive or
a value class such as `Int`, `UInt`, `Percent`, `Duration` or `Secret`, which Kotlin does not allow
as `lateinit`.

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

A bean, or a plain listener or task, may declare a value as a property of its primary constructor:

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

## When the values are set {/* #when-the-values-are-set */}

Values are set at `PLUGIN_RELOAD_OR_START`. At start the files are extracted first; a value
declared in a bean's constructor is read before that bean is created, and a value of a bean's
body is set once the bean exists. At a reload the values are set before anything else. The
plugin's [`Reloadable` beans](../lifecycle/reload.md#reloadable-beans) are reloaded afterwards, so a
`reload()` may read a value, and the [auto-invoked functions](../lifecycle/auto-invoke.md) of the
event run last, so a function reading a `@Value` property always sees the current file. Why this
order and what follows from it, with examples, is under
[The order within an event](../lifecycle/event-order.md):

```kotlin
class ShopPlugin : VersatiaPlugin() {
    @Value("motd")
    lateinit var motd: String

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    fun announce() = logger.info(motd)
}
```

Listeners and tasks read the property when they need it rather than copying it when they are
created, like any other [reloadable state](../lifecycle/reload.md#designing-for-reload).

## Common mistakes {/* #common-mistakes */}

- **`@Value` on a `val` or a plain constructor parameter.** The runtime assigns the property at
  start and at every reload, so the build fails with `Shop.name must be a var to be enhanced`, and
  for the parameter with `Shop.tax must be a var to be enhanced; declare the constructor parameter as a property`:

  ```kotlin title="Wrong"
  @LocalBean
  // error-next-line
  class Shop(@Value("shop.tax") tax: Percent) {
      @Value("shop.name")
      // error-next-line
      val name = ""
  }
  ```

  ```kotlin title="Right"
  @LocalBean
  // fix-next-line
  class Shop(@Value("shop.tax") var tax: Percent) {
      @Value("shop.name")
      // fix-next-line
      lateinit var name: String
  }
  ```

  A `val` is right only when it holds a [`PreviousValueTracking`](changes.md#reacting-to-a-change).
- **Implementing `Reloadable` to read the plugin's own files.** `Reloadable` exists for the
  prototypes of [modules](../modules/index.md), which read the consuming plugin's files and have no
  other way to follow that plugin's reloads. A plugin's own configuration is `@Value` properties,
  with a [mapper](types.md#mappers) for anything the built-in types do not cover; what derives from them
  is rebuilt in a `PLUGIN_RELOAD_OR_START` function. A bean that loads a file in `reload()` is a
  module's job done by hand.
- **Reading a file in a constructor.** Constructors run once; the value never changes on reload.
- **A default in the code.** The initializer of a `@Value` property is overwritten at start and
  never consulted again, so it is a placeholder, not a default: `lateinit` where Kotlin allows it,
  `0` or `Percent.ZERO` where it does not. The default belongs in the shipped file, where the
  administrator sees it; an optional value is a nullable property.
- **Copying a value into a listener or task.** Read the property when the event or tick
  happens; a reload changes the property, not the copy.
- **A password or a token as a `String`.** Any log line or message that prints it shows it, and
  the file has to hold it in plain text. Make it a [`Secret`](types.md#secrets), which prints as `****` and
  can come from an environment variable or a file, and call `reveal()` only where it is handed over:

  ```kotlin title="Wrong"
  @Value("discord.token")
  // error-next-line
  lateinit var token: String

  fun connect() {
      // error-next-line
      logger.info("Connecting with token $token")       // the token is in the server log
      client.login(token)
  }
  ```

  ```kotlin title="Right"
  @Value("discord.token")
  // fix-next-line
  var token = Secret.EMPTY

  fun connect() {
      // fix-next-line
      logger.info("Connecting with token $token")       // Connecting with token ****
      client.login(token.reveal())
  }
  ```

## Corner cases {/* #corner-cases */}

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
- **An override is annotated once.** When a base class declares `@Value("limit") open var
  limit`, a subclass overrides it without `@Value`: the value set through the base property
  already reaches the override, and annotating both is a compile error.
- **Both annotation targets work on a constructor property.** `@Value("k") var x: Int` and
  `@property:Value("k") var x: Int` in a primary constructor are the same: the value is passed to
  the constructor and updated at every reload.

## Under the hood {/* #under-the-hood */}

`@Value` is an [enhancement](../internals/enhancements.md) like any other: the descriptor records
each property as a `PropertyTarget` with its type and a setter, and
`ValueEnhancementProcessor` (`ConfigProcessors.VALUE`) in VersatiaCore reads the files and
assigns the values, or lets the `ValueMapper` read them. The supported types are listed in
`ValueTypes`, which the compile-time step checks against, and read with the getters of
`util.config`; see
[The descriptor](../internals/descriptor.md#propertytarget) and [The runtime](../internals/runtime.md#configuration-values).
