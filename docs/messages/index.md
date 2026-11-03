---
counterpart: /admin/messages
---
# Sending messages

import ExampleCard from '@site/src/components/ExampleCard';

Versatia reads
every YAML file under `messages/` in your plugin's data folder into a bank of messages, keeps it
up to date with `/versatia reload`, and sends them with **runtime arguments**. The text is
[MiniMessage](https://docs.advntr.dev/minimessage/format.html): angle brackets are formatting,
braces are data. The code hands over values, the text decides what to show of them.

<ExampleCard repo="VersatiaExample-Text-Messages" file="src/main/resources/resources/messages" fileLabel="messages/">
Two message files, a service sending one with arguments, values that describe themselves and a reload that picks up edits without a line of code.
</ExampleCard>

Nothing to install or declare: every plugin may inject two beans VersatiaCore provides, each in a
package of its own:

| Inject     | Package                                 | What it is                                                   |
|------------|-----------------------------------------|--------------------------------------------------------------|
| `Messages` | `dev.versatia.messages` | your plugin's [bank of messages](#the-files), read from its data folder |
| `Text`     | `dev.versatia.text`     | the parser behind the messages, for [text that is not in a file](arguments.md#text-without-a-file) and for describing your types; arguments (`arg`) and presentations live here too |

```kotlin
import dev.versatia.messages.Messages
import dev.versatia.text.arg

@LocalBean
class Shop(private val messages: Messages) {
    fun sell(player: Player, item: ItemStack, price: Int) =
        messages["shop.bought"].send(player, arg("player", player), arg("item", item), arg("price", price))
}
```

Arguments, their properties and tags of your own are on [Arguments and tags](arguments.md).

## The files {/* #the-files */}

Ship the files under `src/main/resources/resources/messages/`; [resource extraction](../resources.md)
puts them into `plugins/<Name>/messages/` on the first start, where server owners edit them. Any
`.yml` or `.yaml` there, in any subdirectory, is read:

```yaml title="messages/shop.yml"
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
[Arguments and tags](arguments.md#arguments-and-properties) shows.

:::admin

Server admins edit the texts without the code; [Editing messages](/admin/messages) in the server
admin guide is the page to send them to.

:::

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

```yaml title="messages/.versatia.yml"
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
[tag](arguments.md#tags-with-access-to-the-arguments) registered after the files were read applies at once.
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

## Reloading {/* #reloading */}

`/versatia reload <name>` re-reads the files before your reload-phase functions run; nothing in
your plugin knows about it, because the `Messages` instance made for your plugin is a
[`Reloadable` bean](../lifecycle/reload.md#reloadable-beans) of your plugin. A file that fails to
read (invalid YAML, a duplicate key, a value that is not text) fails the reload with
`Plugin X: ... failed to reload` and a cause naming the file, and the previous messages stay in
use; at start-up the plugin does not enable.

## One instance per plugin {/* #one-instance-per-plugin */}

`Messages` and `Text` are [exposed prototypes](../dependency-injection/scopes.md#exposeprototype) of VersatiaCore: the
instances you inject are your plugin's own. Your `Messages` reads your data folder and parses with your `Text`,
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
- **Threads.** `Text` and `Messages` may be used, and `present` and `tag` called, from any thread,
  such as an `AsyncChatEvent` renderer. The built-in presentations read Bukkit state
  (`{player.location}`, `{world.players}`), which is safe on the main thread only.
- **A missing key never falls back** to a copy of the file in the plugin JAR: the bank is what the
  data folder holds.
- **Legacy codes are found by the character before them.** `x&a` and `5&l` are not reported, since
  a letter or digit precedes the code; `&a&l` is two codes. Hex forms (`&#55ff55`, `&x&5&5...`)
  are not detected. The warning comes again at every reload until the message or the setting
  changes.
- **Files starting with a dot** (`messages/.versatia.yml`, `messages/.draft.yml`) hold no
  messages; only `messages/.versatia.yml` is read, for settings.
