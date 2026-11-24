---
title: VersatiaChat
counterpart: /experimental/plugins/chat
description: Installing VersatiaChat, the datapack that gives chat lines their frame, and the messages and styles of the channel's name, the sender, the card and the text.
---

# VersatiaChat

VersatiaChat puts every chat line in a frame of its own, the channel's name in front of the sender,
`** General ** Steve: hello`, while the line stays the player's own signed message: players can
still report it, hide the sender and use "Only Show Secure Chat", as in vanilla. Hovering over the
sender's name shows a card, which you write line by line. Every player hears the one channel there
is, the general one.

## Installing {/* #installing */}

Put `VersatiaChat-0.0.1.jar` into `plugins/` next to VersatiaCore, its only dependency, and start the
server. VersatiaChat writes its datapack into the main world's `datapacks` folder and logs that it
did; the frame needs one more restart ([The datapack](#the-datapack)). Players install nothing.

## The datapack {/* #the-datapack */}

The client builds a chat line from a chat type, which the server reads only when it starts, before
any plugin. VersatiaChat's chat types come in a datapack it writes when it starts, a file at a
time where one is missing:

```text
world/datapacks/VersatiaChat/pack.mcmeta
world/datapacks/VersatiaChat/data/versatiachat/chat_type/line.json
world/datapacks/VersatiaChat/data/versatiachat/chat_type/line_without_channel.json
```

The server enables a new pack in that folder by itself when it starts, logging
`Found new data pack file/VersatiaChat, loading it automatically`, and `/datapack list` shows it.
From then on lines read `** General ** Steve: hello`; before that, and whenever the pack is disabled,
they use the frames of vanilla chat, `** General ** <Steve> hello`, and VersatiaChat logs what is
missing and how to get it.

- **Players notice nothing of the pack.** The server sends them its chat types when they join, with
  the rest of its registries. The frame is the same in every language of the client.
- **Switching it off:** `/datapack disable "file/VersatiaChat"`, then a restart; lines keep their
  parts in the frames of vanilla chat.
- **A fresh copy:** VersatiaChat never overwrites a file of the pack. Delete the folder and restart
  twice: the first start writes it, the second reads it.
- **Removing it harms nothing.** A chat type is no part of the world or of the players' data.

## Messages {/* #messages */}

`plugins/VersatiaChat/messages/chat.yml` holds the parts of a line; [Editing messages](../messages.md)
explains the format, and the messages are yours to word and translate.

```yaml title="plugins/VersatiaChat/messages/chat.yml"
channel:
  general: "<generalChannel>** General **</generalChannel>"
sender: "{player}"
card:
  - "{player}"
  - "<cardSeparator>----------------</cardSeparator>"
  - "<label>Level:</label> {player.level}"
text: "<chatText>{text}</chatText>"
```

| Key | What it is |
|---|---|
| `channel.general` | the channel's name in front of its lines; an empty name, `general: ""`, leaves the lines without one: `Steve: hello` |
| `sender` | the sender's name, which looks like a player's name in every Versatia message |
| `card` | the card shown on hover over the sender's name, one entry per line, top to bottom |
| `text` | what the player wrote, `{text}`, as typed: tags a player types stay plain text |

The card shows any property of the player: `{player.name}`, `{player.level}`, `{player.health}`,
`{player.foodLevel}`, `{player.gameMode}` and `{player.ping}`, and those a plugin presenting players
for the whole server adds, such as a rank. A click on the sender's name puts `/tell <name> ` in the
chat box and Shift + click inserts the name, as in vanilla.

`/versatia reload chat` applies a change ([`/versatia reload`](../commands.md#versatia-reload)); the
frame around the parts changes only with a restart.

## Styles {/* #styles */}

VersatiaChat adds its styles to `plugins/VersatiaCore/styles.yml` when it starts
([Styles](../messages.md#styles)):

```yaml title="plugins/VersatiaCore/styles.yml"
# Default styles of VersatiaChat
generalChannel: "<dark_aqua>"
cardSeparator: "<dark_gray>"
chatText: "<gray>"
```

| Style | What it colours |
|---|---|
| `generalChannel` | the name of the general channel |
| `cardSeparator` | the line under the name in the card |
| `chatText` | what players write, quieter than their names |

The sender's name takes the style `player` when you define one, and `accent` otherwise.

## Corner cases {/* #corner-cases */}

- **A server in offline mode** (`online-mode=false`) never has signed messages: the client shows
  every player's line as not secure, as on any offline server, and the console marks it
  `[Not Secure]`.
- **Keep `{text}` whole in `text`.** The client marks a line as modified by the server when it no
  longer holds what the player signed; anything around `{text}` is fine.
- **"Only Show Secure Chat"** shows a player the text as typed, without its style, still in the
  frame and with the sender's name.
- **Another plugin that changes the text** in the chat event breaks the signature: such a line goes
  out unsigned, in the same frame, and the client shows it as a line the server sent.
- **The console** shows the frame in English, `<Steve>` for vanilla's; players see it in their
  language.
