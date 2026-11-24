---
title: VersatiaChat
counterpart: /admin/experimental/chat
description: How VersatiaChat delivers player chat as Minecraft's own signed chat, and how your plugin stops, hides or styles chat lines through Paper's chat events.
---

# VersatiaChat

VersatiaChat puts every chat line in a frame of its own, the channel's name in front of the sender,
`** General ** Steve: hello`, and keeps it Minecraft's own player chat: the sender's signed message
reaches every player as typed, and the client builds the line from a chat type VersatiaChat
registers. Reporting, hiding a player, the narrator and "Only Show Secure Chat" work as in vanilla.
Hovering over the sender's name shows a card the server writes line by line. There is one channel,
the general one, which every player hears.

VersatiaChat has no API to compile against: your plugin works with it through Paper's chat events,
which it leaves to every plugin.

:::admin

Installing VersatiaChat, its datapack, its messages and its styles are on the
[VersatiaChat](/admin/experimental/chat) page of the server admin guide.

:::

## How a line reaches players {/* #how-a-line-reaches-players */}

Minecraft's chat is signed: the client of the player who writes signs the text, the server passes
it on with a chat type, and the client of every player reading it builds the line from that chat
type, a frame around the sender's name and the text. VersatiaChat keeps that path for every line:

1. In `AsyncChatDecorateEvent` it wraps the text in its message `text`, which gives it its look.
   This is how Minecraft lets a server style chat: the decorated text travels with the signed
   message, and the signature still covers the text as typed.
2. In `AsyncChatEvent`, at the `HIGHEST` priority and only when no plugin cancelled the event, it
   takes the players out of the event's viewers and sends each of them the sender's signed message,
   with VersatiaChat's chat type bound to the channel's name and the sender's name. The console and
   the other viewers that are no player get the same line from the event's renderer.

The event stays uncancelled, so plugins that relay or log chat still see it.

## Working with the chat {/* #working-with-the-chat */}

| Your plugin wants to | What it does |
|---|---|
| stop a message, a mute say | cancel `AsyncChatEvent` at a priority lower than `HIGHEST`: no line goes out |
| hide a line from some players | remove them from `AsyncChatEvent.viewers()` before `HIGHEST` |
| style what players write | change the result of `AsyncChatDecorateEvent` ([Styling what players write](#styling-what-players-write)) |
| show a value of its own on the card | present it as a property of players in a [server presentation](/docs/messages/arguments#server-presentations): the server's card can then write it, `{player.rank}` |
| follow what players write | listen to `AsyncChatEvent` at `MONITOR`, where the players are no longer among the viewers |

VersatiaChat fires no events of its own: Paper's chat events are where a plugin steps in.

## Styling what players write {/* #styling-what-players-write */}

A plugin that styles chat text, highlighting the names of online players say, does it where
Minecraft decorates chat, in `AsyncChatDecorateEvent`. VersatiaChat wraps the result at the
`HIGHEST` priority, so what your plugin formats in the text stays inside its look. Changing the
message in `AsyncChatEvent` instead takes the line out of the signature: VersatiaChat then sends the
changed text unsigned, in the same frame, and the client shows it as a line the server sent, which
cannot be reported and ignores a hidden player.

```kotlin title="Wrong: the line loses the sender's signature"
class Mentions(private val players: OnlineNames) : Listener {
    @EventHandler
    fun onChat(event: AsyncChatEvent) {
        // error-next-line
        event.message(players.highlight(event.message()))
    }
}
```

```kotlin title="Right"
class Mentions(private val players: OnlineNames) : Listener {
    @EventHandler
    fun onDecorate(event: AsyncChatDecorateEvent) {
        // fix-next-line
        event.result(players.highlight(event.result()))
    }
}
```

The client checks that a line still holds the text the player signed, so a decoration styles the
text and never rewords it: a decoration that replaces words makes the client mark the line as
modified by the server.

## Corner cases {/* #corner-cases */}

- **The frame comes with a restart.** The server reads chat types only when it starts, so on the
  first start after VersatiaChat writes its datapack, and while the pack is disabled, lines use the
  frames of vanilla chat, `** General ** <Steve> hello`.
- **A channel without a name** frames its lines without a prefix, `Steve: hello`, with a chat type of
  its own.
- **Offline mode** never has signed messages: the client shows every player's line as not secure,
  as it does on any offline server.
- **"Only Show Secure Chat"** shows the text as typed, without its decoration, still in the frame and
  with the sender's name.
- **The card is built on the chat thread**, with the line, so a property it shows must be safe to
  read there, as a server presentation's must be.
