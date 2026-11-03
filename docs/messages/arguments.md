# Arguments and tags

A [message](index.md) shows the values the code hands over: `{name}` inserts an argument,
`{name.property}` one of its properties, and tags of your own can read the arguments too.

## Arguments and properties {/* #arguments-and-properties */}

`{name}` inserts the argument. `{name.property}` inserts one of its properties, and properties
chain: `{player.location.x}` is the x coordinate of the player's location. The text, not the code,
picks what to show, so a message file can switch from `{player}` to `{player.name}` without a
rebuild. An argument is never a tag:

```yaml title="Wrong: MiniMessage leaves the unknown tags as text"
# error-next-line
joined: "<yellow><player> joined in <world>"
```

```yaml title="Right"
# fix-next-line
joined: "<yellow>{player} joined in {player.world}"
```

What a value offers depends on its type:

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
arguments alike. Without it, a brace meant literally is read as an argument and the call fails
with `No argument "nick"; the arguments are: player`:

```yaml title="Wrong: {nick} is read as an argument"
# error-next-line
help: "Write {nick} in the template to insert your name, {player}."
```

```yaml title="Right"
# fix-next-line
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
else: `Text` is a [prototype of each plugin](index.md#one-instance-per-plugin). Among registered types, the one
nearest to the value's class wins, so a presentation for `Entity` applies to a villager and a more
specific one for `Player` to players; your registrations take precedence over the built-in ones,
`String`, numbers and collections included, registering a type again replaces its presentation,
and a `Presentable` value always describes itself.

## Text without a file {/* #text-without-a-file */}

`text.parse(input, ...arguments)` parses a string with the same rules and returns a `Component`,
for text that is built in code rather than read from a file:

```kotlin
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

## Corner cases {/* #corner-cases */}

- **A brace inside `<pre>`** is not replaced: the message shows an internal placeholder instead of
  the value. Keep arguments out of `<pre>`.
- **A tag of your own is called twice per parse**, because MiniMessage reads a text in two passes.
  Keep it free of side effects.
- **An `Inventory` is an `Iterable`**, so `{inventory}` lists its items; an empty slot shows as
  nothing between two commas.
- **Backslashes before a brace pair up.** An odd number escapes it; in the text and in a quoted
  tag argument, where MiniMessage reads `\\` as one backslash, `\\{nick}` shows `\Steve` (with
  `nick` = `Steve`) and `\\\{nick}` shows `\{nick}`. A backslash before anything else is left to
  MiniMessage. `argumentNames` skips
  escaped braces, and a text whose only braces are escaped is parsed once like any constant text.
- **Inside an unquoted tag argument** the brace escape is the only backslash rule: MiniMessage
  reads every other backslash there literally, so `<insert:\{nick}>` inserts `{nick}` and
  `<insert:\\{nick}>` inserts `\\Steve`.
