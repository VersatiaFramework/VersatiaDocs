---
description: 'Styles: the names a message gives its parts, mapped to their look in the server''s styles.yml; the shared ones, your own and the server''s tag.'
---

# Styles

import ExampleCard from '@site/src/components/ExampleCard';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

A [message](index.md) says what a text is, `<positive>` or `<hint>`, and the server says how that
looks. Such names are **styles**: tags the server maps to MiniMessage in one file,
`plugins/VersatiaCore/styles.yml`, shared by every plugin. One edit there restyles them all, and no
message names a colour.

<ExampleCard repo="VersatiaExample-Text-Styles" file="src/main/resources/resources/messages/quests.yml" fileLabel="messages/quests.yml">
Messages without a colour in them: a tone for each, values that stand out by themselves, and a style and a tag of the plugin's own with the defaults it ships.
</ExampleCard>

VersatiaCore defines the styles every plugin shares, so a message needs nothing but their names:

<CodeCards>
<CodeCard title="messages/quests.yml">

```yaml
quest:
  done: "<positive>Quest {quest} done: {reward} coins."
  failed: "<negative>Quest {quest} failed."
  hint: "<hint>Type <accent>/quest</accent> to see your quests."
```

</CodeCard>
<CodeCard title="plugins/VersatiaCore/styles.yml">

```yaml
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

</CodeCard>
</CodeCards>

The quest's name and the reward stand out without a tag around them: white on the green of the
first message and on the red of the second, like `/quest` in the hint. That white is the accent of
the top level, which applies wherever a tone has none of its own; `warning` has one, gold on
yellow.

## The shared styles {/* #shared-styles */}

These names exist on every server, so every plugin uses the same ones and none ships them. A chat
message opens with its **tone**:

| Style      | The message is                                   | For example                                |
|------------|--------------------------------------------------|--------------------------------------------|
| `positive` | good news: something worked or was gained        | `<positive>Quest {quest} done.`            |
| `negative` | bad news: something failed or was lost           | `<negative>Not enough coins.`              |
| `warning`  | nothing failed, but the player should take note  | `<warning>The server restarts in {time}.`  |
| `neutral`  | a fact, neither good nor bad                     | `<neutral>You have {count} quests.`        |

Inside it, two names mark the parts, and a third, `serverTag`, is
[the server's tag](#server-tag) in front of the message:

| Style     | The part is                                                               | For example                           |
|-----------|---------------------------------------------------------------------------|---------------------------------------|
| `accent`  | what matters most; every value takes it [by itself](#values-in-a-style)   | `<accent>/quest</accent>`             |
| `hint`    | what matters least, or what to do next                                    | `<hint>Type <accent>/quest</accent>.` |

Two more names are **reserved**: they are what these parts are called in every plugin, never
`title` or `header`. VersatiaCore ships their look, since its own commands show labels and
headings; a plugin that has such a part uses the name and ships nothing for it:

| Reserved  | The part is                       | For example                          |
|-----------|-----------------------------------|--------------------------------------|
| `label`   | the name before a value           | `<label>Balance:</label> {balance}`  |
| `heading` | the title of a list or of a page  | `<heading>Your quests</heading>`     |

A tone also fits a part of a message, `Status: <positive>online</positive>`, and a text that is no
chat message (a menu, a scoreboard) uses the parts without a tone. Write a style for what a text
**is**, not for how it looks today:

```yaml title="Wrong: a look, and a value highlighted by hand"
# error-next-line
bought: "<green>You bought <gold>{item}</gold>."
```

```yaml title="Right: the server decides both, once"
# fix-next-line
bought: "<positive>You bought {item}."
```

## Using a style {/* #using-a-style */}

A style is a tag like any other: it opens, closes and nests as MiniMessage tags do, in a message
file and in [`text.parse`](arguments.md#text-without-a-file) alike. What it stands for is
MiniMessage, anything from `<gold>` to `<hover:show_text:'Open'><click:run_command:'/shop'><underlined>`
or a `<gradient:gold:yellow>`, and the text shows exactly as if you had written those tags
where the style opens and closed them where it closes.

A name is looked up where it stands: in the styles around it, the nearest first, then at the top
level of the file. With the file above, where `warning` has an accent of its own:

| In the text                              | `<accent>` is                                       |
|------------------------------------------|-----------------------------------------------------|
| `<accent>x`                              | `<white>`, the top level                            |
| `<warning>... <accent>x`                 | `<gold>`, the one of `warning`                      |
| `<negative><warning>... <accent>x`       | `<gold>`: `warning` is the nearer one               |
| `<warning><bold>... <accent>x`           | `<gold>`: `<bold>` is no style and hides nothing    |
| `<warning>...</warning> <accent>x`       | `<white>`: `warning` was closed                     |
| `<positive>... <accent>x`                | `<white>`: `positive` has no accent of its own      |

## Styles of your own {/* #default-styles */}

A thing only your plugin has gets a style of its own, named after what it is, `quest` or `rank`,
never after a colour or a look. Ship its default as `src/main/resources/styles.yml`, next to
`plugin.yml`, and let the class [name the style](arguments.md#your-own-values), so that a quest is
light purple instead of the accent without a tag in any message:

<CodeCards>
<CodeCard title="src/main/resources/styles.yml">

```yaml
quest: "<light_purple>"
```

</CodeCard>
<CodeCard title="Quest.kt">

```kotlin
class Quest(val name: String, val reward: Int) : Presentable {
    override val style get() = "quest"

    override fun presentation() = presentation {
        component { text(name) }
        property("reward") { reward }
    }
}
```

</CodeCard>
<CodeCard title="messages/quests.yml">

```yaml
quest:
  offered: "<neutral>{player}, a quest awaits: {quest}."
```

</CodeCard>
<CodeCard title="Console" output>

```text
[Quests] Added the default styles quest to plugins/VersatiaCore/styles.yml
```

</CodeCard>
</CodeCards>

Fixed text takes the tag, `<quest>The Lost Mine</quest>`, and so does a value that is no `Quest`,
such as a quest's name passed as a `String`.

Unlike the files under `resources/`, the file is never copied to your data folder: the server has
one styles file, and a copy in every plugin's folder would be a second place to look. When your
plugin starts, and again at each of its reloads, every style of yours that the server's file lacks
is appended to it under a comment naming your plugin. What the file already defines is left alone
and wins, so your default decides only on a server that has no opinion yet.

| In the file                         | Means                                                              |
|-------------------------------------|--------------------------------------------------------------------|
| `quest: "<light_purple>"`           | the style `quest`                                                  |
| a section, `quest:`                 | a scope: its names apply only inside `<quest>`                     |
| `style:` in a section               | the section's own style, what `<quest>` itself stands for          |
| a dotted key, `positive.quest:`     | the same as nesting `quest` under `positive`                       |
| an empty value, `plain:`            | a style that changes nothing                                       |

A flat file, every name at the top level, is the whole of it for most plugins; scopes are for a
style that must differ by context.

:::admin

The file, its format and what a reload re-reads are explained to the server admin under
[Styles](/admin/messages#styles).

:::

## The server's tag {/* #server-tag */}

Many servers open their chat messages with their name, `[Realm] Welcome!`. That tag is the shared
style `serverTag`: a style may hold text, and written self-closing it inserts that text. It stands
right after the tone:

<CodeCards>
<CodeCard title="messages/welcome.yml">

```yaml
welcome: "<neutral><serverTag/>Welcome to the server, {player}!"
```

</CodeCard>
<CodeCard title="plugins/VersatiaCore/styles.yml">

```yaml
serverTag: "<gold><bold>[Realm]</bold></gold> "
```

</CodeCard>
</CodeCards>

VersatiaCore ships the tag empty, so a message shows none until the admin writes the server's.
The space after the tag is part of the style for that reason: an empty tag leaves no gap. The tag
above looks the same in every message, whatever the tone, since it says who speaks and not what
kind of news follows. A tag written without a colour takes the tone's instead, and a tone may
hold a tag of its own, `negative.serverTag`, like any name.

```yaml title="Wrong: every server has to edit the name out of every file"
# error-next-line
welcome: "<neutral>[Realm] Welcome to the server, {player}!"
```

```yaml title="Right: the server writes its tag once"
# fix-next-line
welcome: "<neutral><serverTag/>Welcome to the server, {player}!"
```

A tag opens a chat message that stands alone. A line of a list, a hint under another message and
a text in a menu carry none.

### A tag of your own {/* #own-tag */}

A plugin that speaks in its own name ships a tag of its own, a style named after the plugin and
ending in `Tag`, and writes it where the server's would stand:

<CodeCards>
<CodeCard title="src/main/resources/styles.yml">

```yaml
quest: "<light_purple>"
questTag: "<dark_purple><bold>[Quests]</bold></dark_purple> "
```

</CodeCard>
<CodeCard title="messages/quests.yml">

```yaml
quest:
  done: "<positive><questTag/>Quest {quest} done: {quest.reward} coins."
```

</CodeCard>
</CodeCards>

An admin edits or empties it like any style. A name of two words is written in camel case,
`questTag`, like a property in braces; MiniMessage reads names in either case, so `<questtag/>` is
the same tag.

## Values in a style {/* #values-in-a-style */}

A value needs no tag: whatever a brace inserts stands out by itself. It takes the style named
after its type where the server defines one, and `accent` otherwise, looked up where the brace
stands like any other name:

| The value is                                               | Style      |
|------------------------------------------------------------|------------|
| a `Player`, an `OfflinePlayer`                             | `player`   |
| any other `Entity`                                         | `entity`   |
| an `ItemStack`                                             | `item`     |
| a `Location`                                               | `location` |
| a `World`                                                  | `world`    |
| a value whose [class](arguments.md#your-own-values), [registration](arguments.md#types-you-do-not-own) or [server presentation](arguments.md#server-presentations) names a style, `override val style get() = "quest"` | that style, `quest` |
| anything else: a text, a number, a value of your own type  | `accent`   |

```yaml
bought: "<positive>{player} bought {item} for {price} coins."
```

On a server as VersatiaCore sets it up, all three are white, the accent. An admin who adds
`player: "<aqua>"` sees player names in aqua in every message of every plugin, and a
`positive: { player: "<gold>" }` makes them gold inside a positive one. A list is styled element
by element, and a property is a value of its own: `{player.name}` and `{player.displayName}` take
the accent. A `Component` your code builds is a value like any other. A value that brings
formatting of its own, a display name with a rank, keeps it; the style formats only what the value
leaves open.

A tag around the brace alone says how the value looks, and it wins over the value's own
formatting, in every part of it. It sets only what it formats: `<!bold>{player.displayName}</!bold>`
takes the bold off a rank's name and keeps its colours, `<hint>{who}</hint>` shows the name in the
hint style whatever colours it brings. A brace among other text stands out by itself, and the tags
around that text only fill what the value leaves open. A tag around the brace alone is also how a
message keeps a value quiet, a class name or a reason that matters less than the rest:

| In the text                                       | `{count}` is shown in                            |
|---------------------------------------------------|--------------------------------------------------|
| `<neutral>You have {count} quests.`               | the accent: it stands among other text           |
| `<neutral>You have <hint>{count}</hint> quests.`  | the `hint` style: its tag holds the value alone  |
| `<hint>{count} left</hint>`                       | the accent, inside text in the `hint` style      |

The tag must hold the brace and nothing else:

```yaml title="Wrong: the tag holds more than the name, so a bold name stays bold"
# error-next-line
won: "<positive><!bold>{player.displayName} wins</!bold>"
```

```yaml title="Right"
# fix-next-line
won: "<positive><!bold>{player.displayName}</!bold> wins"
```

## Tags that do not exist {/* #tags-that-do-not-exist */}

A tag must exist: as a MiniMessage tag, a [tag you registered](arguments.md#tags-with-access-to-the-arguments)
or a style defined where it stands. Anything else is an error, never text in a player's chat.
Your messages are checked once your plugin has started, so the tags your start functions register
count, and again at every reload when the files are read:

```text
Plugin Quests: message "quest.done" in messages/quests.yml cannot be shown: <positiv> is neither a MiniMessage tag nor a style; the styles in plugins/VersatiaCore/styles.yml are: accent, hint, negative, neutral, positive, serverTag, warning. Write \<positiv> to show it as text
```

At start the plugin does not enable; at a reload the previous messages stay.
`text.parse` throws the same as an `UnknownTagException`. Angle brackets meant as text take a
backslash:

```yaml title="Wrong: <player> and <amount> are read as tags"
# error-next-line
usage: "<negative>Usage: /pay <player> <amount>"
```

```yaml title="Right"
# fix-next-line
usage: "<negative>Usage: /pay \\<player> \\<amount>"
```

In a double-quoted YAML string the backslash is written twice, as above; in a plain or
single-quoted one once.

## Corner cases {/* #corner-cases */}

- **A value alone in a style's tag takes that style only**, whatever the style: in
  `<neutral>{player}`, a message that is nothing but the value, the name is in the neutral look,
  colours of a rank included. A space or a word beside the brace is enough for it to stand out
  again.
- **A value inside the style it would take is not styled twice**, which shows with a style that
  holds text: with `accent: "<gold>* "`, `<accent>the {item}</accent>` has one star.
- **A `Component` stands out like any value**: `arg("who", player.displayName())` and
  `{player.displayName}` look the same. Its own colours and decorations stay under the accent and
  under tags beside other text; only a tag holding it alone changes them.
- **A tag holding a value alone sets its look, not its behaviour**: colour, decorations and font.
  The value's click, hover and insertion stay its own.
- **A gradient or a rainbow around a value alone** colours only what the value leaves open, as
  MiniMessage applies it while it builds the text: a name with colours of its own keeps them.
- **Your own presentation** of a type that has a style, such as `Player`, keeps that style unless
  it names another: names shown by `text.present<Player> { ... }` are still in `player`, and
  `text.present<Player>(style = "accent") { ... }` shows them in the accent.
  `text.miniMessage` is plain MiniMessage and knows no style.
- **A style a class or a registration names need not exist**: where the server defines none of
  that name the value takes the accent, so a misspelt name shows as the accent, not as an error.
  A name that can never be a style fails, at the registration or when the value is first shown,
  and for a [server presentation](arguments.md#server-presentations) at its plugin's start:
  `"bold" cannot name the style of com.example.Quest: it is a MiniMessage tag`.
- **A class that already has a `style` of another kind** cannot answer the one of `Presentable`
  too; register its presentation with `text.present` instead.
- **A default you ship for a shared style is never used**: VersatiaCore's is in the server's file
  before your plugin starts.
- **Two plugins shipping one name with different defaults**: the first to start has its value in
  the server's file, and the second reads it from there, so both look the same. Nothing is
  overwritten and nothing is logged; the admin's edit wins over both.
- **A default deleted from the server's file comes back** at your plugin's next start or reload,
  like an extracted file: your messages need it. A style is changed by editing its value, and an
  empty value switches it off.
- **Under a name the file already has**, a default is appended as a dotted line,
  `positive.quest: "<white>"`, since a YAML section cannot be opened twice.
- **A style used outside the styles that define it** fails like a tag that does not exist:
  `<quest> is a style only inside <negative>, <positive>; define it at the top level of
  plugins/VersatiaCore/styles.yml to use it anywhere`.
- **A name** is letters, digits, `_` and `-`, and neither a MiniMessage tag (`bold`, `red`, `b`,
  `key`) nor `style`, which is the key of a section's own style. Upper and lower case are one
  name, as in MiniMessage's own tags: `<serverTag/>` and `<servertag/>` are the same style, and a
  file cannot define both.
- **A style holds MiniMessage only**: another style inside it is a tag that does not exist, and
  `&6` is an error naming `<gold>`. Text in a style is shown before what the style encloses, so
  `alert: "<red>! "` makes `<alert/>` a prefix.
- **A style takes no arguments**: `<accent:gold>` is an error.
- **A tag you register with `text.tag` wins** over a style of its name, in your plugin only.
- **Hover text is a text of its own**: styles in `<hover:show_text:'...'>` are looked up from the
  top level, not from the styles around the hover.
- **A tag for a plugin that may be missing** must exist either way. Register a fallback that
  inserts nothing when the other plugin is absent, or every message using the tag fails the start.
- **A tag registered in a start function** exists for the check, but not for an earlier function
  of the same start: functions run by class name, then function name. A tag registered in the
  `init` block of a bean exists before any function runs.
- **Brackets around a name without a letter stay text**: `<3`, `<3>` and `<->` are not tags to
  anyone. A real MiniMessage tag with an argument it cannot read, `<color:nope>`, is still printed
  by MiniMessage, as before.
- **Brackets around the name of a style are that style**, on a server that defines it: where an
  admin added a `player` style, `/pay <player>` loses the word instead of failing. Brackets a
  player should read always take the backslash.
