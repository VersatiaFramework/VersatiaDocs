---
counterpart: /docs/messages
description: Rewording, restyling and translating the messages of plugins built on Versatia in plugins/<Name>/messages/, with their arguments and styles.
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
Tags such as `<positive>` or `<accent>` are [styles](#styles), which you define once for every
plugin. A tag that is neither is a mistake the plugin reports instead of showing it to players;
brackets meant as text are written `\<player>`.
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

```yaml title="Wrong: <player> and <world> are read as tags, not as arguments"
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

## Styles {/* #styles */}

A well-kept server looks the same in every plugin. Plugins therefore do not write colours into
their messages; they write what a text is, `<positive>`, `<negative>`, `<accent>`, and one file of
yours says how each of those looks. VersatiaCore fills in the styles every plugin shares when it
first starts:

```yaml title="plugins/VersatiaCore/styles.yml"
# Default styles of VersatiaCore
neutral: "<gray>"
positive: "<green>"
negative: "<red>"
warning:
  style: "<yellow>"
  accent: "<gold>"
accent: "<white>"
hint: "<dark_gray><italic>"
label: "<gold>"
heading: "<aqua><bold>"
serverTag: ""
```

| Style                                        | Where plugins use it                                                                    |
|----------------------------------------------|-----------------------------------------------------------------------------------------|
| `positive`, `negative`, `warning`, `neutral` | the tone of a message: good news, bad news, something to note, a plain fact             |
| `accent`                                     | what matters most; every value a message fills in (a name, a number) takes it by itself |
| `hint`                                       | what matters least, or what to do next                                                  |
| `serverTag`                                  | the tag in front of chat messages, such as `[Realm]`; nothing until you write yours     |

| In the file                       | Means                                                                 |
|-----------------------------------|-----------------------------------------------------------------------|
| `accent: "<white>"`               | wherever a message says `<accent>`, and for every value, it is white  |
| a section, `warning:`             | a scope: what is inside applies only within `<warning>`               |
| `style:` in a section             | the look of `<warning>` itself                                        |
| `accent:` in the section          | the accent inside `<warning>`; the innermost scope around a tag wins  |
| a dotted key, `warning.accent:`   | the same as writing `accent` inside the section                       |

A style may hold any MiniMessage: `"<gold><bold>"`, a gradient, a hover, a click. Change a value,
run [`/versatia reload`](commands.md#versatia-reload) without a name, and every message of every
plugin using that style changes with it. The file belongs to VersatiaCore, so reloading another
plugin by name does not read it again.

**Players, items and the like can have a style of their own.** A value takes the accent, unless
you define the style named after what it is: `player`, `entity`, `item`, `location`, `world`.
With `player: "<aqua>"` every plugin shows player names in aqua; add
`positive.player: "<gold>"` and names inside a positive message are gold.

**A tag around a value alone has the last word.** A name from a rank plugin keeps its own colours
under these styles. A tag that holds the brace and nothing else sets the look of the whole value
over them, and only what the tag formats:

```yaml title="plugins/Shop/messages/shop.yml"
sold: "<positive><!bold>{player.displayName}</!bold> bought the sword"  # no bold, rank colours stay
quiet: "<neutral>By <hint>{player.displayName}</hint>"                    # the whole name in the hint style
```

With a word inside the tag, `<!bold>{player.displayName} bought</!bold>`, the name keeps its own
formatting.

**Your server's tag.** Messages that speak for the server open with `<serverTag/>`, which shows
nothing until you write the tag, together with the space that follows it:

```yaml title="plugins/VersatiaCore/styles.yml"
serverTag: "<gold><bold>[Realm]</bold></gold> "
```

Written like this it looks the same in every message. A tag without a colour, `"[Realm] "`, takes
the colour of the message it opens, and `negative.serverTag` gives bad news a tag of its own. A
plugin may bring a tag of its own (`questTag`), which you edit or empty the same way.

**Plugins fill the file in.** When a plugin starts, the styles of its own that your file does not
have are added at the end, under a comment naming the plugin:

```yaml title="plugins/VersatiaCore/styles.yml"
# Default styles of Quests
quest: "<light_purple>"
positive.quest: "<white>"
```

What your file already defines is never touched, so your choice always wins over a plugin's
default; the rest of the file, your comments included, stays as you wrote it.

```yaml title="Wrong: plugins/VersatiaCore/styles.yml"
# error-next-line
accent: "&6"
# error-next-line
heading: "<accent><bold>"
```

```yaml title="Right: plugins/VersatiaCore/styles.yml"
# fix-next-line
accent: "<gold>"
# fix-next-line
heading: "<gold><bold>"
```

A style is written in MiniMessage tags, never in `&` codes, and it cannot use another style.

## Mistakes {/* #mistakes */}

| Message                                                                 | Fix                                       |
|-------------------------------------------------------------------------|-------------------------------------------|
| `Plugin Shop: messages/shop.yml is not valid YAML at line 3, column 12: ...` | the place is in the message; a tab instead of spaces and a missing space after `:` are the usual causes |
| `message "k" is defined twice in messages/f.yml`, or `... in both messages/a.yml and messages/b.yml` | keep one of them                         |
| `"shop" is a message in messages/general.yml and a group of messages in messages/shop.yml; rename one of them` | a key cannot hold a text and further keys |
| `Plugin Shop has no message "shop.byu"; ...`                           | a key was renamed or deleted; the message lists the keys that start the same way |
| `Plugin Shop: message "shop.bought" in messages/shop.yml cannot be shown: No argument "nmae"; the arguments are: player, item, price` | fix the name in braces |
| `... cannot be shown: <sucess> is neither a MiniMessage tag nor a style; the styles in plugins/VersatiaCore/styles.yml are: accent, hint, negative, neutral, positive, serverTag, warning. Write \<sucess> to show it as text` | fix the tag, define the style, or write `\<` when the brackets are text |
| `... cannot be shown: <accent> is a style only inside <negative>, <positive>; define it at the top level of plugins/VersatiaCore/styles.yml to use it anywhere` | add a top-level `accent`, or use the tag only inside those styles |
| `style "accent" in plugins/VersatiaCore/styles.yml uses <gol>, which is not a MiniMessage tag; ...`, `"my accent" ... cannot name a style: ...`, `... is not valid YAML at line 3, column 5: ...` | fix `styles.yml`; names are letters, digits, `_` and `-`, and not a MiniMessage tag such as `bold` or `red` |
| `styles.yml in the JAR of Shop ...`                                    | the plugin's own default styles are broken: report it to the plugin's author |

The first three come at start, when the plugin then stays disabled, or at a reload, when the
previous texts stay; so do the two about a tag. A `styles.yml` that cannot be read keeps the
styles in use at a reload, and stops VersatiaCore, and with it every Versatia plugin, at start.
`Plugin Shop has no message` and `No argument` come when the message is used, so test an edited
message once in game.

## Corner cases {/* #corner-cases */}

- **A missing key never falls back** to the default text in the plugin JAR: the plugin shows what
  the folder holds, and a deleted key is an error until you put it back.
- **Hex codes** (`&#55ff55`) are not reported as colour codes; write `<#55ff55>`.
- **The colour-code warning repeats** at every reload until the message or the setting changes.
- **A style a plugin needs comes back.** Delete one from `styles.yml` and it is added again when the
  plugin next starts or reloads, with the plugin's default. To change a style, edit its value; to
  switch one off, leave the value empty (`hint: ""`). The styles every plugin shares come back the
  same way, with VersatiaCore.
- **Two plugins wanting one style differently**: the first to start has its default written to the
  file, and the second uses what is there. Your edit then decides for both.
- **A style added under a section you already have** is written as a dotted line,
  `positive.quest: "<white>"`, because the section cannot be opened a second time; move it into the
  section if you like.
- **A changed style needs `/versatia reload` without a name.** After `/versatia reload <name>` of
  VersatiaCore alone the new styles apply at once, but the other plugins' messages are not
  checked against them until those plugins reload.
- **Brackets around something without a letter**, `<3` or `<->`, are text as they always were.
- **Upper and lower case are one name**: `serverTag` and `servertag` are the same style, and the
  file cannot define both.
- **A gradient or a rainbow around a value alone** colours only the parts without a colour of their
  own; every other tag holding the value alone wins over its colours.
