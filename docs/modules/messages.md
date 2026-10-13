# Messages module

import ExampleCard from '@site/src/components/ExampleCard';

[VersatiaModule-Messages](https://github.com/VersatiaFramework/VersatiaModule-Messages) reads
every YAML file under `messages/` in your plugin's data folder into a bank of messages, keeps it
up to date with `/versatia reload`, and sends them with **runtime arguments**. The text is
[MiniMessage](https://docs.advntr.dev/minimessage/format.html): angle brackets are formatting,
braces are data. The code hands over values, the text decides what to show of them.

<ExampleCard repo="VersatiaExample-Modules-Messages" file="src/main/resources/resources/messages" fileLabel="messages/">
Two message files, a service sending one with arguments, values that describe themselves and a reload that picks up edits without a line of code.
</ExampleCard>

Set-up is the same as for every [module](index.md#using-a-module): the API comes with
[VersatiaStarter](../getting-started/installation.md#in-your-build), `VersatiaModule-Messages` goes
under `depend:`, and the module's JAR on the server. The module gives your plugin two beans, each
in a package of its own:

| Inject     | Package                                 | What it is                                                   |
|------------|-----------------------------------------|--------------------------------------------------------------|
| `Messages` | `com.github.marcoral.versatia.messages` | your plugin's [bank of messages](#the-files), read from its data folder |
| `Text`     | `com.github.marcoral.versatia.text`     | the parser behind the messages, for [text that is not in a file](#text-without-a-file) and for describing your types; arguments (`arg`) and presentations live here too |

```kotlin
import com.github.marcoral.versatia.messages.Messages
import com.github.marcoral.versatia.text.arg

@LocalBean
class Shop(private val messages: Messages) {
    fun sell(player: Player, item: ItemStack, price: Int) =
        messages["shop.bought"].send(player, arg("player", player), arg("item", item), arg("price", price))
}
```

## The files

Ship the files under `src/main/resources/resources/messages/`; [resource extraction](../resources.md)
puts them into `plugins/<Name>/messages/` on the first start, where server owners edit them. Any
`.yml` or `.yaml` there, in any subdirectory, is read:

```yaml
# messages/shop.yml
shop:
  open: "<green>The shop is open: {offers} offers today."
  bought: "<green>{player} bought {item} for <gold>{price}</gold> coins."
  closed:
    - "<red>The shop is closed."
    - "<gray>Come back tomorrow."
```

| In the file                      | Becomes                                                            |
|----------------------------------|--------------------------------------------------------------------|
| nested sections                  | a dotted key: `shop.bought`                                        |
| a list                           | one message of several lines                                       |
| a number or boolean              | its text                                                           |
| the file name and directory      | nothing: files only organise messages, a key may move between them |
| the same key in two files        | an error naming both files                                         |

Every standard MiniMessage tag works in angle brackets; the arguments are in braces, as
[below](#arguments-and-properties).

## Sending

`messages[key]` is a `Message`; a key that does not exist throws `MissingMessageException` with the
keys that start the same way (`Plugin Shop has no message "shop.byu"; the messages under "shop"
are: shop.bought, shop.closed, shop.open`). `getOrNull` and `contains` are there for optional
messages, `keys` for all of them.

| On a `Message`                       | Does                                                                |
|--------------------------------------|---------------------------------------------------------------------|
| `get()`                              | the component; a message without arguments was parsed once when the file was read, one with arguments fails here with the first missing argument |
| `get(arg("item", item), ...)`        | the component with the arguments, parsed for the call               |
| `send(audience, ...arguments)`       | sends it to a player, the console, any `Audience`                   |
| `broadcast(...arguments)`            | sends it to every online player and the console                     |
| `key`, `raw`, `file`                 | the key, the text as written, the file relative to the data folder  |

## Arguments and properties

`{name}` inserts the argument. `{name.property}` inserts one of its properties, and properties
chain: `{player.location.x}` is the x coordinate of the player's location. The text, not the code,
picks what to show, so a message file can switch from `{player}` to `{player.name}` without a
rebuild. What a value offers depends on its type:

| Value                              | `{name}` inserts                  | Properties                                                        |
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

Properties are evaluated only when the text uses them, and once per call. Argument names consist
of letters, digits, `_` and `-`; braces around anything else (`{}`, `{ x }`, `{1,2}`) are plain
text, so JSON or code in a message is left alone.

## Your own values

A class implements `Presentable` and says how it appears; `presentation { }` is a small builder
where everything is lazy:

```kotlin
import com.github.marcoral.versatia.text.Presentable
import com.github.marcoral.versatia.text.presentation

class Offer(val item: String, val price: Price) : Presentable {
    override fun presentation() = presentation {
        component { text(item) }         // {offer}
        property("item") { item }        // {offer.item}
        property("price") { price }      // {offer.price}, and {offer.price.coins} if Price has that property
    }
}
```

A property may return anything an argument may be, which is how they chain. A presentation
without `component { }` can only be used through its properties; using the bare brace fails with
`{offer} cannot be inserted as text; use one of its properties: item, price`.

## Types you do not own

For a type you cannot make `Presentable`, register a presentation on your `Text`, once, for
example in an `@AutoInvoke(EventType.PLUGIN_START_ONLY)` function:

```kotlin
@AutoInvoke(EventType.PLUGIN_START_ONLY)
fun describe(text: Text) = text.present<Duration> { duration ->
    presentation {
        component { text("${duration.toMinutes()} min") }
        property("seconds") { duration.toSeconds() }
    }
}
```

The registration applies to everything your plugin parses, its messages included, and to nothing
else: `Text` is a [module prototype](#one-instance-per-plugin). Among registered types, the one
nearest to the value's class wins, so a presentation for `Entity` applies to a villager and a more
specific one for `Player` to players; your registrations take precedence over the built-in ones,
registering a type again replaces its presentation, and a `Presentable` value always describes
itself.

## Text without a file

`text.parse(input, ...arguments)` parses a string with the same rules and returns a `Component`,
for text that is built in code rather than read from a file:

```kotlin
import com.github.marcoral.versatia.text.Text
import com.github.marcoral.versatia.text.arg

class Welcome(private val text: Text) : Listener {
    @EventHandler
    fun onJoin(event: PlayerJoinEvent) =
        event.player.sendMessage(text.parse("<gold>Welcome {player}, you are at {player.location}.", arg("player", event.player)))
}
```

`text.argumentNames(input)` lists the arguments a text refers to, and `text.miniMessage` is the
plain MiniMessage instance behind it.

## Tags with access to the arguments

`text.tag(name) { arguments, context, values -> ... }` adds a MiniMessage tag, in angle brackets
like any tag, that resolves with the call's arguments in hand, in messages and in `parse` alike.
`values` gives the arguments by name, `values.require<Player>("who")` with a type check. This is
the hook for bridges such as a PlaceholderAPI tag that reads the target player from an argument:

```kotlin
text.tag("upper") { arguments, _, values -> Tag.selfClosingInserting(text(values.require<String>(arguments.pop().value()).uppercase())) }

text.parse("<upper:who> joined", arg("who", "Steve"))   // STEVE joined
```

Tag names follow MiniMessage's rules (lower-case letters, digits, `_`, `-`) and cannot shadow a
standard tag.

## Reloading

`/versatia reload <name>` re-reads the files before your reload-phase functions run; nothing in
your plugin knows about it, because the `Messages` instance made for your plugin is a
[`Reloadable` bean](../lifecycle/reload.md#reloadable-beans) of your plugin. A file that fails to
read (invalid YAML, a duplicate key) fails the reload with
`Plugin X: ... failed to reload` and a cause naming the file, and the previous messages stay in
use; at start-up the plugin does not enable.

## One instance per plugin

`Messages` and `Text` are [module prototypes](index.md#one-instance-per-plugin): the instances you
inject are your plugin's own. Your `Messages` reads your data folder and parses with your `Text`,
the same instance your beans inject, so the presentations and tags you register apply to your
messages. Two plugins never see each other's messages or registrations, and neither needs the
other's keys to be unique.

## Errors

A missing or unreadable message is a `MessagesException` (package `messages`):

| Exception                       | When                                                           |
|---------------------------------|----------------------------------------------------------------|
| `MissingMessageException`       | `messages["shop.byu"]`: no such key; lists the keys starting the same way |
| `MessagesLoadException`         | a file is not valid YAML, or a key is defined in two files; names the file |

A text that uses an argument wrongly fails the `get`, `send` or `parse` call with a
`TextException` (package `text`) naming what is wrong and what is available, so a broken message
file is found at the first use rather than by a player reading a stray `{player.nmae}`:

| Exception                       | When                                                           |
|---------------------------------|----------------------------------------------------------------|
| `UnknownArgumentException`      | `{nmae}`: `No argument "nmae"; the arguments are: name, item`; also a tag asking `values` for an argument the call did not pass |
| `UnknownPropertyException`      | `{player.nmae}`: `{player} has no property "nmae"; it has: name, displayName, ...` |
| `NoTextFormException`           | the bare brace of a value whose presentation has no component   |
| `InvalidArgumentNameException`  | an argument named with anything but letters, digits, `_` and `-` |
| `ReservedTagNameException`      | a tag named like a MiniMessage tag (`b`, `color`, `click`...) or not a tag name |
| `ArgumentTypeException`         | `values.require<T>` on an argument of another type               |

MiniMessage tags that do not exist are not an error: MiniMessage leaves them as text, as it
always does.
