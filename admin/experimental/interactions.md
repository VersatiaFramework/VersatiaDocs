---
title: VersatiaInteractions
counterpart: /experimental/plugins/interactions
description: Installing VersatiaInteractions, who may use its menu, its commands, its config.yml, its messages and how a resource pack changes its icons and sounds.
---

# VersatiaInteractions

VersatiaInteractions gives players a menu, opened with Shift + right click on another player, with
a button for each action another plugin provides, such as the trade of [VersatiaTrade](trade.md).
A click sends an offer. The button shows its state live in both players' menus (available, waiting
with a countdown, offered to you, busy, unavailable with the reason, in progress), the receiver
gets a line in chat to accept or decline, and the offer expires, or ends when a player quits, dies
or walks away. Two players who send each other an offer start the action at once.

## Installing {/* #installing */}

Put `VersatiaInteractions-0.0.1.jar` into `plugins/` next to VersatiaCore, together with the plugins
that provide actions: on a server where no plugin provides one, Shift + right click opens nothing.

| Plugin | Needed for |
|---|---|
| VersatiaCore | always |
| a plugin providing an action, such as [VersatiaTrade](trade.md) | the buttons of the menu |
| [CommandAPI](https://commandapi.dev/) 12.x | `/interact`, which the [Accept] and [Decline] of the receiver's chat line run |

Without CommandAPI, `/interact` does not exist and the chat line's buttons cannot answer: players
answer in the menu, or you set `receiver.notify` to `dialog`, whose buttons need no command
([config.yml](#config-yml)). Install or remove CommandAPI, then restart
([Optional plugins](../installation.md#optional-plugins)).

## Permissions {/* #permissions */}

| Permission | Default | Lets the player |
|---|---|---|
| `versatia.interactions.menu` | everyone | open the menu with Shift + right click on a player |
| `versatia.interactions.command.interact` | everyone | answer an offer with `/interact`, which the chat line's buttons run |
| `versatia.interactions.exempt` | nobody | never be asked: no menu opens for them and no offer reaches them (staff) |

Players the viewer cannot see, such as those a vanish plugin hides, and NPCs cannot be asked either.
An action may need permissions of its own: a trade needs `versatia.trade.use` for both players
([VersatiaTrade permissions](trade.md#permissions)).

## Commands {/* #commands */}

| Command | What it does |
|---|---|
| `/interact accept <player> [action]` | accepts the offer `<player>` sent; `[action]` picks one when they sent several |
| `/interact decline <player> [action]` | declines it |
| `/versatia reload interactions` | applies an edited `config.yml` or messages file ([`/versatia reload`](../commands.md#versatia-reload)) |

The buttons of the chat line run the first two, so players rarely type them.

## config.yml {/* #config-yml */}

VersatiaInteractions writes the file at its first start:

```yaml title="plugins/VersatiaInteractions/config.yml"
requests:
  timeout: 10s
  countdown: true
  max-distance: 16
  cancel-on: [distance, world-change, death]
receiver:
  notify: chat
window:
  rows: 3
icons:
  available: "minecraft:paper"
  waiting: "minecraft:clock"
  offered: "minecraft:lime_dye"
  busy: "minecraft:gray_dye"
  denied: "minecraft:barrier"
  active: "minecraft:clock"
sounds:
  offered: "minecraft:ui.button.click"
  received: "minecraft:block.note_block.pling"
  accepted: "minecraft:entity.player.levelup"
  declined: "minecraft:block.note_block.bass"
  expired: "minecraft:block.note_block.bass"
  cancelled: "minecraft:block.note_block.bass"
  busy: "minecraft:entity.villager.no"
actions:
  trade:
    slot: 11
    icons:
      available: "minecraft:emerald"
  duel:
    slot: 15
```

| Key | What it sets |
|---|---|
| `requests.timeout` | how long an offer waits for an answer, a [duration](../configuration-files.md#durations) longer than zero |
| `requests.countdown` | whether the waiting button's stack size shows the seconds left (up to 99) |
| `requests.max-distance` | blocks; sending and accepting an offer need the two players this close, in the same world |
| `requests.cancel-on` | what ends a waiting offer besides its timeout: `distance`, `world-change`, `death`; leaving the server always does |
| `receiver.notify` | how the receiver hears of an offer besides the menu: `chat`, `dialog` or `both` |
| `window.rows` | the menu's rows, 1 to 6 |
| `icons.<state>` | the item model of a button in each state: `available`, `waiting`, `offered`, `busy`, `denied`, `active` |
| `sounds.<moment>` | the sound of each moment: `offered` (to the sender), `received`, `accepted`, `declined`, `expired`, `cancelled`, `busy`; `''` plays nothing |
| `actions.<id>.slot` | the button's slot, from 0 (the top-left corner) to the window's last; an action not listed takes the first free slot |
| `actions.<id>.icons.<state>`, `actions.<id>.sounds.<moment>` | icons and sounds of that action alone, replacing the ones above |

The ids under `actions` are those of the actions the plugins provide, `trade` for VersatiaTrade; an
id no plugin provides, `duel` in the shipped file, is ready for a plugin installed later. A wrong
value fails the start or the reload naming the key, and so do a slot outside the window and two
actions sharing a slot:

```text
config.yml: actions trade, duel share slot 11; give each its own slot
```

## Messages {/* #messages */}

`plugins/VersatiaInteractions/messages/interactions.yml` holds the menu, the chat line, the dialog
and the answers; [Editing messages](../messages.md) explains the format and the styles.

| Part of the file | What it says |
|---|---|
| `window.title` | the menu's title; `{target}` is the player it was opened on |
| `button.<state>.name`, `.lore` | each button, in each state |
| `offer.*` | the offer sent, received (the chat line with [Accept] and [Decline]), accepted, declined, expired and cancelled, for an action whose plugin words none of its own |
| `too-far`, `busy`, `busy-self`, `unavailable` | why an offer cannot be sent or accepted |
| `dialog.*` | the dialog of `receiver.notify: dialog` or `both` |
| `command.*` | the answers of `/interact` |

The sentences about one action come from the plugin providing it. VersatiaTrade's
`plugins/VersatiaTrade/messages/trade.yml` holds, under `interaction`, the trade's name ("Trade"),
the sentences saying a player is trading, the lore of its button and the chat lines of an offer
(`interaction.offer.*`: "Steve offers you a trade."), which replace the menu's defaults for that
action alone. The menu names an action only by its bare name after a colon (`Offer: Trade`), so a
translation never has to inflect it.

A message that reads wrong is yours to fix, in these files. A reason another plugin gives, on a
button or when it stops an offer, comes from that plugin's messages; when such a plugin gives none,
players read the `unavailable` sentence.

## Icons and sounds {/* #icons-and-sounds */}

VersatiaInteractions ships no resource pack. Every icon is an item model key and every sound a
sound key, so players without a pack see vanilla items, and a server with a pack points the keys at
its own. A model for `icons.waiting` whose texture an `.mcmeta` file animates makes the client
animate the waiting button by itself, while the server redraws only the countdown, once per second.
Under `actions.<id>.sounds` a pack's sound plays for one action alone, a voice line say:

```yaml title="plugins/VersatiaInteractions/config.yml"
icons:
  waiting: "myserver:hourglass"
actions:
  trade:
    slot: 11
    sounds:
      received: "myserver:voice.trade_offer"
```

## Corner cases {/* #corner-cases */}

- **Leaving the server always ends an offer**, whatever `requests.cancel-on` lists.
- **A busy player cannot be asked.** While two players trade, neither can send, receive or accept
  an offer of an action that keeps players busy, such as a trade or a duel, and the buttons say who
  is busy.
- **Two offers to each other** start the action at once, without a click on [Accept].
- **An action's own distance.** A plugin may need the two players closer than
  `requests.max-distance`: VersatiaTrade opens a trade only within its own `trade.max-distance`,
  10 blocks by default, so its button reads "too far away to trade" beyond that
  ([VersatiaTrade corner cases](trade.md#corner-cases)).
- **A plugin providing an action stops:** its offers end without a message and the menus showing
  it close.
- **Some players cannot be asked:** players with `versatia.interactions.exempt`, players the viewer
  cannot see and NPCs; no menu opens on them.
