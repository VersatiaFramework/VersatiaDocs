# Messages module

import ExampleCard from '@site/src/components/ExampleCard';

[VersatiaModule-Messages](https://github.com/VersatiaFramework/VersatiaModule-Messages) reads
every YAML file under `messages/` in your plugin's data folder into a bank of messages, keeps it
up to date with `/versatia reload`, and sends them with the
[Text module](text.md)'s runtime arguments.

<ExampleCard repo="VersatiaExample-Modules-Messages" file="src/main/resources/resources/messages" fileLabel="messages/">
Two message files, a service sending one with arguments and a reload that picks up edits without a line of code.
</ExampleCard>

Set-up is the same as for every [module](index.md#using-a-module): the API comes with
[VersatiaStarter](../getting-started/installation.md#in-your-build), `VersatiaModule-Messages` goes
under `depend:`, and the module's JAR, together with the Text module's, on the server. Then inject
`Messages`:

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
  open: "<green>The shop is open: <offers> offers today."
  bought: "<green><player> bought <item> for <gold><price></gold> coins."
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

The text is [MiniMessage](https://docs.advntr.dev/minimessage/format.html) with the Text module's
arguments: `<player>`, `<player:name>`, `<item:amount>`, as the
[Text page](text.md#arguments-and-properties) describes.

## Sending

`messages[key]` is a `Message`; a key that does not exist throws `MissingMessageException` with the
keys that start the same way (`Plugin Shop has no message "shop.byu"; the messages under "shop"
are: shop.bought, shop.closed, shop.open`). `getOrNull` and `contains` are there for optional
messages, `keys` for all of them.

| On a `Message`                       | Does                                                                |
|--------------------------------------|---------------------------------------------------------------------|
| `get()`                              | the component, parsed once when the file was read                   |
| `get(arg("item", item), ...)`        | the component with the arguments, parsed for the call               |
| `send(audience, ...arguments)`       | sends it to a player, the console, any `Audience`                   |
| `broadcast(...arguments)`            | sends it to every online player and the console                     |
| `key`, `raw`, `file`                 | the key, the text as written, the file relative to the data folder  |

## Reloading

`/versatia reload <name>` re-reads the files before your reload-phase functions run; nothing in
your plugin knows about it, because the `Messages` instance made for your plugin is a
[`Reloadable` bean](../lifecycle/reload.md#reloadable-beans) of your plugin. A file that fails to
read (invalid YAML, a duplicate key) fails the reload with
`Plugin X: ... failed to reload` and a cause naming the file, and the previous messages stay in
use; at start-up the plugin does not enable.

## One bank per plugin

`Messages` is a [module prototype](index.md#one-instance-per-plugin): the instance you inject reads
your data folder and parses with your plugin's own `Text`, so the presentations you register with
`text.present` apply to your messages. Two plugins never see each other's messages, and neither
needs the other's keys to be unique.
