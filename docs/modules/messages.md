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

## The files {/* #the-files */}

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
| a list                           | one message of several [lines](#lines), each parsed on its own; every line must be text |
| any other value, `Yes`, `off`, `1.10`, `010` included | its text exactly as written, never a boolean or a number |
| an empty value, `closed:`        | an empty message                                                   |
| the file name and directory      | nothing: files only organise messages, a key may move between them |
| the same key twice, in one file or in two | an error naming the file or both files                    |
| a key that is a message in one place and a group of messages in another | an error naming the files      |

Files are read as UTF-8; a file in another encoding is an error that says to save it as UTF-8.
Invalid YAML is reported with the file and the place:
`Plugin Shop: messages/shop.yml is not valid YAML at line 3, column 12: mapping values are not allowed here`.

Every standard MiniMessage tag works in angle brackets; the arguments are in braces, as
[below](#arguments-and-properties).

### Legacy colour codes {/* #legacy-colour-codes */}

MiniMessage shows `&a` and `§l` as text. A message using them is reported once per load, through
your plugin's logger, with the tags to write instead:

```text
[Shop] Message "shop.sale" in messages/shop.yml uses legacy colour codes, which MiniMessage shows as text: &a -> <green>, &l -> <bold>; write the tags instead, or turn this warning off with "legacy-color-warnings: false" in messages/.versatia.yml
```

A code is `&` or `§` followed by `0`-`9`, `a`-`f`, `k`-`o` or `r`, in either case, with no letter
or digit right before it, unless that character ends another code: `&a&lSale` has two codes,
`R&D` and `B&B` have none. To keep codes on purpose, such as a help message explaining them, turn
the warning off for your plugin in `messages/.versatia.yml`, which you can ship with the other
files:

```yaml
# messages/.versatia.yml
legacy-color-warnings: false
```

This file holds settings, not messages: a file whose name starts with a dot is never read for
messages. An unknown setting, or a value other than `true` or `false`, fails the load.

## Sending {/* #sending */}

`messages[key]` is a `Message`; a key that does not exist throws `MissingMessageException` with the
keys that start the same way (`Plugin Shop has no message "shop.byu"; the messages under "shop"
are: shop.open, shop.bought, shop.closed`). `getOrNull` and `contains` are there for optional
messages, `keys` for all of them.

| On a `Message`                       | Does                                                                |
|--------------------------------------|---------------------------------------------------------------------|
| `get()`                              | the component; a message that uses arguments fails here with the first missing one |
| `get(arg("item", item), ...)`        | the component with the arguments                                    |
| `lines(...arguments)`                | one component per [line](#lines), for item lore and other places that take lines |
| `send(audience, ...arguments)`       | sends it to a player, the console, any `Audience`                   |
| `broadcast(...arguments)`            | sends it to the console and every online player with `bukkit.broadcast.user` (everyone, unless a permission plugin revokes it); fires a cancellable `BroadcastMessageEvent` |
| `key`, `raw`, `file`                 | the key, the text as written, the file relative to the data folder  |

A message is parsed when it is used, never when the file is read, so a
[tag](#tags-with-access-to-the-arguments) registered after the files were read applies at once.
A text without braces and without registered tags gives the same component every time, so it is
parsed on its first use and reused; this holds for each constant line of a message even when the
call passes arguments. A text with a registered tag is parsed at every use, because the tag may
answer differently each time.

## Lines {/* #lines */}

A YAML list is a message of several lines. `get()` joins them with line breaks; `lines()` gives
them apart, which is what item lore takes:

```yaml
sword:
  lore:
    - "<gray>Damage: <red>{damage}"
    - "<gray>Forged by {smith}"
```

```kotlin
meta.lore(messages["sword.lore"].lines(arg("damage", 7), arg("smith", player)))
```

Each line is parsed on its own, so formatting never carries over: a `<red>` left open on the
first line does not colour the second. A message that is a single text is one line.

## Arguments and properties {/* #arguments-and-properties */}

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
| `Material`, `EntityType` and any other translatable value | its name in the viewer's language (`Component.translatable`) | none |
| a `List`, `Set`, any other `Iterable` or an array | the elements joined with `, `, each shown as an argument would be | `size` |
| a [`Presentable`](#your-own-values) | what its presentation says        | what its presentation says                                        |
| anything else                      | its `toString()`                  | none, unless [registered](#types-you-do-not-own)                  |

A value of a more specific type keeps its own row: a `Player` or an `ItemStack` is shown as above,
not as a translatable. Properties are evaluated only when the text uses them, and once per call.
Argument names consist
of letters, digits, `_` and `-`; braces around anything else (`{}`, `{ x }`, `{1,2}`) are plain
text, so JSON or code in a message is left alone.

A backslash escapes a brace, as MiniMessage's `\<` escapes a tag, in the text and inside tag
arguments alike:

```yaml
help: "Write \\{nick} in the template to insert your name, {player}."   # shows {nick}
copy: "<click:suggest_command:'/template \\{nick}'>Copy</click>"        # suggests /template {nick}
```

In a double-quoted YAML string the backslash itself is written twice, as above; in a plain or
single-quoted one it is written once: `help: Write \{nick} ...`.

### Braces inside a tag {/* #braces-inside-a-tag */}

In the text a brace inserts the value's component. Inside the argument of a tag, where MiniMessage
reads a plain string, it inserts the value's plain text instead, escaped so that it can neither
end the argument nor open a tag:

```yaml
whisper: "<click:suggest_command:'/msg {player.name} '>Click to answer {player}</click>"
copy: "<insert:{player.name}>{player}</insert>"
```

An unquoted argument holding a brace is quoted for you. The text of `<hover:show_text:...>`, which
MiniMessage parses again, keeps the component.

## Your own values {/* #your-own-values */}

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

## Types you do not own {/* #types-you-do-not-own */}

For a type you cannot make `Presentable`, register a presentation on your `Text`, once, for
example in an `@AutoInvoke(Phase.PLUGIN_START_ONLY)` function:

```kotlin
@AutoInvoke(Phase.PLUGIN_START_ONLY)
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
`String`, numbers and collections included, registering a type again replaces its presentation,
and a `Presentable` value always describes itself.

## Text without a file {/* #text-without-a-file */}

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

## Tags with access to the arguments {/* #tags-with-access-to-the-arguments */}

`text.tag(name) { arguments, context, values -> ... }` adds a MiniMessage tag, in angle brackets
like any tag, that resolves with the call's arguments in hand, in messages and in `parse` alike.
`values` gives the arguments by name, `values.require<Player>("who")` with a type check. This is
the hook for bridges such as a PlaceholderAPI tag that reads the target player from an argument:

```kotlin
text.tag("upper") { arguments, _, values -> Tag.selfClosingInserting(text(values.require<String>(arguments.pop().value()).uppercase())) }

text.parse("<upper:who> joined", arg("who", "Steve"))   // STEVE joined
```

:::warning[Insert outside strings as text]

A value from elsewhere, such as the result of `PlaceholderAPI.setPlaceholders`, may contain what a
player typed: a nickname, a prefix, a clan tag. Insert it as a text component, as `upper` does
with `text(...)`, never through `Tag.preProcessParsed` or `context.deserialize`: those parse it as
MiniMessage, and a clan tag `<click:run_command:'/op x'>` becomes a working click.

:::

Tag names follow MiniMessage's rules (lower-case letters, digits, `_`, `-`) and cannot shadow a
standard tag; names starting with `versatia-argument-` are reserved for the braces.

## Reloading {/* #reloading */}

`/versatia reload <name>` re-reads the files before your reload-phase functions run; nothing in
your plugin knows about it, because the `Messages` instance made for your plugin is a
[`Reloadable` bean](../lifecycle/reload.md#reloadable-beans) of your plugin. A file that fails to
read (invalid YAML, a duplicate key, a value that is not text) fails the reload with
`Plugin X: ... failed to reload` and a cause naming the file, and the previous messages stay in
use; at start-up the plugin does not enable.

## One instance per plugin {/* #one-instance-per-plugin */}

`Messages` and `Text` are [module prototypes](index.md#one-instance-per-plugin): the instances you
inject are your plugin's own. Your `Messages` reads your data folder and parses with your `Text`,
the same instance your beans inject, so the presentations and tags you register apply to your
messages. Two plugins never see each other's messages or registrations, and neither needs the
other's keys to be unique.

## Errors {/* #errors */}

A missing or unreadable message is a `MessagesException` (package `messages`):

| Exception                       | When                                                           |
|---------------------------------|----------------------------------------------------------------|
| `MissingMessageException`       | `messages["shop.byu"]`: no such key; lists the keys starting the same way |
| `MessagesLoadException`         | a file cannot be read, is not valid YAML or not UTF-8, a value is not text, a key is defined twice or is both a message and a group of messages, `messages/.versatia.yml` holds an unknown setting; names the file |
| `MessageRenderException`        | a message cannot be shown; names the key and the file, with the `TextException` below as its cause: `Plugin Shop: message "shop.bought" in messages/shop.yml cannot be shown: No argument "nmae"; the arguments are: player, item, price` |

A text that uses an argument wrongly fails the call with a `TextException` (package `text`) naming
what is wrong and what is available, wrapped in a `MessageRenderException` for a message, so a
broken message file is found at the first use rather than by a player reading a stray
`{player.nmae}`:

| Exception                       | When                                                           |
|---------------------------------|----------------------------------------------------------------|
| `UnknownArgumentException`      | `{nmae}`: `No argument "nmae"; the arguments are: name, item`; also a tag asking `values` for an argument the call did not pass |
| `UnknownPropertyException`      | `{player.nmae}`: `{player} has no property "nmae"; it has: name, displayName, ...` |
| `NullValueException`            | `{player.location.world.name}` while the world is null: `{player.location.world} is null, so it has no property "name"` |
| `NoTextFormException`           | the bare brace of a value whose presentation has no component   |
| `PresentationException`         | a presentation, or the code it calls, threw; names the brace and has the exception as its cause: `{item.price} cannot be shown: java.lang.IllegalStateException: ...` |
| `InvalidArgumentNameException`  | `arg("Player Name", x)`: a name with anything but letters, digits, `_` and `-`; thrown by `arg()` itself |
| `DuplicateArgumentException`    | the same argument name passed twice in one call                  |
| `ReservedTagNameException`      | a tag named like a MiniMessage tag (`b`, `color`, `click`...), starting with `versatia-argument-`, or not a tag name |
| `ArgumentTypeException`         | `values.require<T>` on an argument of another type               |

MiniMessage tags that do not exist are not an error: MiniMessage leaves them as text, as it
always does.

## Corner cases {/* #corner-cases */}

- **A key that is a message in one file and a group in another** fails the load:
  `Plugin Shop: "shop" is a message in messages/general.yml and a group of messages in
  messages/shop.yml; rename one of them`. Within one file the message reads
  `"shop" is both a message and a group of messages in messages/shop.yml; rename one of them`.
- **An empty value** is an empty message, not an error and not a missing key.
- **YAML types do not apply.** `enabled: Yes` is the text `Yes`, `version: 1.10` is `1.10`, and
  `code: 010` is `010`, exactly as written.
- **A brace inside `<pre>`** is not replaced: the message shows an internal placeholder instead of
  the value. Keep arguments out of `<pre>`.
- **A tag of your own is called twice per parse**, because MiniMessage reads a text in two passes.
  Keep it free of side effects.
- **An `Inventory` is an `Iterable`**, so `{inventory}` lists its items; an empty slot shows as
  nothing between two commas.
- **Threads.** `Text` and `Messages` may be used, and `present` and `tag` called, from any thread,
  such as an `AsyncChatEvent` renderer. The built-in presentations read Bukkit state
  (`{player.location}`, `{world.players}`), which is safe on the main thread only.
- **A missing key never falls back** to a copy of the file in the plugin JAR: the bank is what the
  data folder holds.
- **Backslashes before a brace pair up.** An odd number escapes it; in the text and in a quoted
  tag argument, where MiniMessage reads `\\` as one backslash, `\\{nick}` shows `\Steve` (with
  `nick` = `Steve`) and `\\\{nick}` shows `\{nick}`. A backslash before anything else is left to
  MiniMessage. `argumentNames` skips
  escaped braces, and a text whose only braces are escaped is parsed once like any constant text.
- **Inside an unquoted tag argument** the brace escape is the only backslash rule: MiniMessage
  reads every other backslash there literally, so `<insert:\{nick}>` inserts `{nick}` and
  `<insert:\\{nick}>` inserts `\\Steve`.
- **Legacy codes are found by the character before them.** `x&a` and `5&l` are not reported, since
  a letter or digit precedes the code; `&a&l` is two codes. Hex forms (`&#55ff55`, `&x&5&5...`)
  are not detected. The warning comes again at every reload until the message or the setting
  changes.
- **Files starting with a dot** (`messages/.versatia.yml`, `messages/.draft.yml`) hold no
  messages; only `messages/.versatia.yml` is read, for settings.
