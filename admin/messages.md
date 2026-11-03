---
counterpart: /docs/messages
---

# Editing messages

A plugin built on Versatia keeps the texts it shows to players in `plugins/<Name>/messages/`. You
can reword, recolour or translate them all without touching the plugin; nothing besides
VersatiaCore has to be installed.

## The files {/* #the-files */}

Every `.yml` or `.yaml` file under `messages/`, in any subfolder, is read. Sections nest, and the
plugin asks for each message by its dotted key:

```yaml title="plugins/Shop/messages/shop.yml"
shop:
  open: "<green>The shop is open: {offers} offers today."      # shop.open
  bought: "<green>{player} bought {item} for <gold>{price}</gold> coins."
  closed:                                                       # a list: one message of two lines
    - "<red>The shop is closed."
    - "<gray>Come back tomorrow."
```

- **Keep the keys.** Change the text after the colon, never the key before it: the plugin asks
  for `shop.bought` by name, and a missing key is an error.
- **Files only organise.** A key may move to another file or folder; the file name is not part of
  the key.
- **Everything is text.** `Yes`, `off`, `1.10` and `010` stay exactly as written.
- **An empty value** (`closed:`) is an empty message, not an error.
- **Save as UTF-8.** A file in another encoding is reported.

Edit, then run [`/versatia reload <name>`](commands.md#versatia-reload). A file that fails to read
fails the reload, and the previous texts stay in use.

## Formatting {/* #formatting */}

Texts are written in [MiniMessage](https://docs.advntr.dev/minimessage/format.html): angle brackets
format, as in `<green>`, `<bold>`, `<gradient:gold:yellow>` or `<click:run_command:'/shop'>`.
The colour codes `&a` and `§l` are shown as text, so each one is reported once per load with the
tag to write instead:

```text
[Shop] Message "shop.sale" in messages/shop.yml uses legacy colour codes, which MiniMessage shows as text: &a -> <green>, &l -> <bold>; write the tags instead, or turn this warning off with "legacy-color-warnings: false" in messages/.versatia.yml
```

```yaml title="Wrong: plugins/Shop/messages/shop.yml"
# error-next-line
sale: "&a&lSale! &7Everything for half the price."
```

```yaml title="Right: plugins/Shop/messages/shop.yml"
# fix-next-line
sale: "<green><bold>Sale!</bold> <gray>Everything for half the price."
```

To keep codes on purpose, such as in a help message that explains them, switch the warning off:

```yaml title="plugins/Shop/messages/.versatia.yml"
legacy-color-warnings: false
```

`messages/.versatia.yml` holds settings, not messages. Every other file whose name starts with a
dot (`messages/.draft.yml`) is not read at all, which makes it a place for a draft.

## Arguments {/* #arguments */}

Braces insert what the plugin fills in when it sends the message: `{player}`, `{item}`,
`{price}`. Each message has its own arguments; the default file shows which ones, and a name the
message does not have is reported with the list of the ones it has.

An argument is never written as a tag:

```yaml title="Wrong: MiniMessage shows the unknown tags as text"
# error-next-line
joined: "<yellow><player> joined in <world>"
```

```yaml title="Right"
# fix-next-line
joined: "<yellow>{player} joined in {player.world}"
```

A dot picks a detail of an argument, and details chain: `{player.location.x}`. What an argument
offers depends on what it is:

| The argument is   | `{name}` shows                 | Details                                                            |
|-------------------|--------------------------------|--------------------------------------------------------------------|
| a player          | the display name               | `name`, `displayName`, `uuid`, `level`, `health`, `foodLevel`, `gameMode`, `ping`, `location`, `world` |
| another entity    | its name                       | `name`, `type`, `uuid`, `location`, `world`                        |
| an offline player | the name                       | `name`, `uuid`                                                     |
| an item           | the item name                  | `name`, `hoverable` (the name, with the item shown on hover), `type`, `amount`, `maxStackSize` |
| a location        | `x, y, z` as block coordinates | `x`, `y`, `z`, `blockX`, `blockY`, `blockZ`, `yaw`, `pitch`, `world` |
| a world           | its name                       | `name`, `environment`, `time`, `players`                           |
| a material, an entity type | its name in the player's language | none                                              |
| a list            | the elements joined with `, `  | `size`                                                             |
| text, a number    | the value; tags in a player's text are never applied | none                                         |

A plugin may give its own values details of their own; its documentation names them.

Inside a tag an argument works too, as plain text:

```yaml title="plugins/Shop/messages/chat.yml"
whisper: "<click:suggest_command:'/msg {player.name} '>Click to answer {player}</click>"
```

### A literal brace {/* #a-literal-brace */}

A brace meant as text is written `\{`. Inside double quotes the backslash is doubled:

```yaml title="Wrong: {nick} is read as an argument"
# error-next-line
help: "Write {nick} in the template to insert your name, {player}."
```

```yaml title="Right"
# fix-next-line
help: "Write \\{nick} in the template to insert your name, {player}."   # shows {nick}
```

In single quotes or without quotes the backslash is written once: `help: Write \{nick} ...`.
Braces around anything that is not a name, such as `{ x }` or JSON, are left as they are.

## Mistakes {/* #mistakes */}

| Message                                                                 | Fix                                       |
|-------------------------------------------------------------------------|-------------------------------------------|
| `Plugin Shop: messages/shop.yml is not valid YAML at line 3, column 12: ...` | the place is in the message; a tab instead of spaces and a missing space after `:` are the usual causes |
| `message "k" is defined twice in messages/f.yml`, or `... in both messages/a.yml and messages/b.yml` | keep one of them                         |
| `"shop" is a message in messages/general.yml and a group of messages in messages/shop.yml; rename one of them` | a key cannot hold a text and further keys |
| `Plugin Shop has no message "shop.byu"; ...`                           | a key was renamed or deleted; the message lists the keys that start the same way |
| `Plugin Shop: message "shop.bought" in messages/shop.yml cannot be shown: No argument "nmae"; the arguments are: player, item, price` | fix the name in braces |

The first three come at start, when the plugin then stays disabled, or at a reload, when the
previous texts stay. The last two come when the message is used, so test an edited message once
in game.

## Corner cases {/* #corner-cases */}

- **A missing key never falls back** to the default text in the plugin JAR: the plugin shows what
  the folder holds, and a deleted key is an error until you put it back.
- **A brace inside `<pre>`** shows a placeholder instead of the value; keep arguments out of
  `<pre>`.
- **Hex codes** (`&#55ff55`) are not reported as colour codes; write `<#55ff55>`.
- **The colour-code warning repeats** at every reload until the message or the setting changes.
