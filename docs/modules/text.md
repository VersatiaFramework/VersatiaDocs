# Text module

import ExampleCard from '@site/src/components/ExampleCard';

[VersatiaModule-Text](https://github.com/VersatiaFramework/VersatiaModule-Text) parses
[MiniMessage](https://docs.advntr.dev/minimessage/format.html) text with **runtime arguments**: the
code hands over values, the text decides what to show of them.

<ExampleCard repo="VersatiaExample-Modules-Text" file="src/main/kotlin/com/github/marcoral/versatia/example/text/TextPlugin.kt">
A plugin injecting <code>Text</code>, passing its own and foreign values as arguments and greeting players with their location.
</ExampleCard>

Set-up is the same as for every [module](index.md#using-a-module): `compileOnly` on
`com.github.marcoral.versatia:VersatiaModule-Text`, `VersatiaModule-Text` under `depend:`, and
the module's JAR on the server. Then inject `Text`:

```kotlin
import com.github.marcoral.versatia.text.Text
import com.github.marcoral.versatia.text.arg

@LocalBean
class Shop(private val text: Text) {
    fun sold(player: Player, item: ItemStack, price: Int) =
        player.sendMessage(text.parse("<green><player> bought <item> for <gold><price></gold> coins.", arg("player", player), arg("item", item), arg("price", price)))
}
```

`parse` returns a `Component`. Every standard MiniMessage tag works; on top of them, each
argument is a tag named after it.

## Arguments and properties

`<name>` inserts the argument. `<name:property>` inserts one of its properties, and properties
chain: `<player:location:x>` is the x coordinate of the player's location. The text, not the code,
picks what to show, so a message file can switch from `<player>` to `<player:name>` without a
rebuild. What a value offers depends on its type:

| Value                              | `<name>` inserts                  | Properties                                                        |
|------------------------------------|-----------------------------------|-------------------------------------------------------------------|
| `String`                           | the text, verbatim: tags in it are **not** parsed, so player input is safe | none |
| a number, `Boolean`, `Char`        | its text                          | none                                                              |
| `null`                             | nothing                           | none                                                              |
| `Component`                        | the component                     | `plain`                                                           |
| `Player`                           | the display name                  | `name`, `displayName`, `uuid`, `level`, `health`, `foodLevel`, `gameMode`, `ping`, `location`, `world` |
| any other `Entity`                 | its name                          | `name`, `type`, `uuid`, `location`, `world`                       |
| `OfflinePlayer`                    | the name, or the UUID             | `name`, `uuid`                                                    |
| `ItemStack`                        | the item name                     | `name`, `hoverable` (the name with the item's hover), `type`, `amount`, `maxStackSize` |
| `Location`                         | `x, y, z` as block coordinates    | `x`, `y`, `z`, `blockX`, `blockY`, `blockZ`, `yaw`, `pitch`, `world` |
| `World`                            | its name                          | `name`, `environment`, `time`, `players`                          |
| a [`Presentable`](#your-own-values) | what its presentation says        | what its presentation says                                        |
| anything else                      | its `toString()`                  | none, unless [registered](#types-you-do-not-own)                  |

Properties are evaluated only when the text uses them, and once per call.

## Your own values

A class implements `Presentable` and says how it appears; `presentation { }` is a small builder
where everything is lazy:

```kotlin
import com.github.marcoral.versatia.text.Presentable
import com.github.marcoral.versatia.text.presentation

class Offer(val item: String, val price: Price) : Presentable {
    override fun presentation() = presentation {
        component { text(item) }         // <offer>
        property("item") { item }        // <offer:item>
        property("price") { price }      // <offer:price>, and <offer:price:coins> if Price has that property
    }
}
```

A property may return anything an argument may be, which is how they chain. A presentation
without `component { }` can only be used through its properties; using the bare tag fails with
`<offer> cannot be inserted as text; use one of its properties: item, price`.

## Types you do not own

For a type you cannot make `Presentable`, register a presentation on your `Text` instance, once,
for example in an `@AutoInvoke(EventType.PLUGIN_START_ONLY)` function:

```kotlin
text.present<Duration> { duration ->
    presentation {
        component { text("${duration.toMinutes()} min") }
        property("seconds") { duration.toSeconds() }
    }
}
```

The registration is yours alone: `Text` is a [module prototype](index.md#one-instance-per-plugin),
one instance per plugin. Among registered types, the one nearest to the value's class wins, so a
presentation for `Entity` applies to a villager and a more specific one for `Player` to players;
your registrations take precedence over the built-in ones, and a `Presentable` value always
describes itself.

## Tags with access to the arguments

`text.tag(name) { arguments, context, values -> ... }` adds a MiniMessage tag that resolves with
the call's arguments in hand. `values` gives the arguments by name, `values.require<Player>("who")`
with a type check. This is the hook for bridges such as a PlaceholderAPI tag that reads the target
player from an argument:

```kotlin
text.tag("upper") { arguments, _, values -> Tag.selfClosingInserting(text(values.require<String>(arguments.pop().value()).uppercase())) }

text.parse("<upper:who> joined", arg("who", "Steve"))   // STEVE joined
```

## Errors

A text that uses an argument wrongly fails the `parse` call with a `TextException` naming what is
wrong and what is available, so a broken message file is found at the first use rather than by a
player reading a stray `<player:nmae>`:

| Exception                       | When                                                           |
|---------------------------------|----------------------------------------------------------------|
| `UnknownPropertyException`      | `<player:nmae>`: `<player> has no property "nmae"; it has: name, displayName, ...` |
| `NoTextFormException`           | the bare tag of a value whose presentation has no component     |
| `ReservedArgumentNameException` | an argument or tag named like a MiniMessage tag (`b`, `color`, `click`...) or not a tag name (lower-case letters, digits, `_`, `-`) |
| `UnknownArgumentException`      | a tag asks `values` for an argument the call did not pass       |
| `ArgumentTypeException`         | `values.require<T>` on an argument of another type               |

A tag that is neither an argument nor a MiniMessage tag is not an error: MiniMessage leaves it as
text, as it always does.
