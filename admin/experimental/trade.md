---
title: VersatiaTrade
counterpart: /experimental/plugins/trade
description: Installing VersatiaTrade with or without VersatiaInteractions and an economy, how a trade goes, its permissions and commands, its config.yml, its messages and its trade log.
---

# VersatiaTrade

VersatiaTrade lets two players trade items and money in a window: each clicks the items of their
inventory to offer them, sets an amount of money and accepts. Every change takes both acceptances
back, a short countdown runs, and the exchange moves everything or nothing. The offered items never
leave their owner's inventory before the exchange, so nothing is lost when a player quits, dies or
walks away, or when the server stops or crashes. Every completed trade goes into a daily log.

## Installing {/* #installing */}

Put `VersatiaTrade-0.0.1.jar` into `plugins/` next to VersatiaCore. Each of the other plugins adds a
part, and players need VersatiaInteractions or CommandAPI to ask for a trade:

| Plugin | Dependency | Adds |
|---|---|---|
| VersatiaCore | required | everything: VersatiaTrade runs on it |
| [VersatiaInteractions](interactions.md) | optional | a Trade button in its menu (Shift + right click on a player), with its waiting countdown; `/trade` then sends that menu's offer |
| Vault ([VaultUnlocked](https://modrinth.com/plugin/vaultunlocked) or the original) and an economy plugin | optional | money in trades; without them trades are items only |
| [CommandAPI](https://commandapi.dev/) 12.x | optional | `/trade` |

Install or remove one of them, then restart ([Optional plugins](../installation.md#optional-plugins)).
An economy plugin that registers with Vault after VersatiaTrade started is found at the next trade.

## How a trade goes {/* #how-a-trade-goes */}

1. A player asks another with `/trade <player>` or the Trade button of VersatiaInteractions' menu;
   the other accepts from the chat line or the menu. Two players asking each other start at once.
2. The window opens for both. Its upper part shows the two offers side by side, 16 stacks each,
   the money buttons, the partner's money, the accept button, whether the partner accepted and a
   status line. Its lower part
   shows the player's inventory: a left click offers the stack, a right click one item, and a click
   on an offered item takes it back.
3. Both accept. Any change to either offer takes both acceptances back. The status says at once
   when one of them lacks room or money, and accepting waits until that is fixed.
4. A countdown runs (`trade.countdown`, 3 s), then the exchange moves both sides in one go and
   saves both players' data.

Shift clicks, number keys, drags and the off-hand key move nothing in the window. Closing it,
leaving the server, dying or moving farther apart than `trade.max-distance` ends the trade, and
since nothing left an inventory, nothing has to be given back. Players pick up no items while they
trade.

## Permissions {/* #permissions */}

| Permission | Default | Lets the player |
|---|---|---|
| `versatia.trade.use` | everyone | trade; both players need it, and losing it during a trade ends the trade |
| `versatia.trade.money` | everyone | offer money, with Vault and an economy plugin |
| `versatia.trade.command.trade` | everyone | use `/trade` |

VersatiaTrade has no game mode rule. To keep items from creative mode out of trades, deny
`versatia.trade.use` in creative mode, with LuckPerms:

```text
/lp group default permission set versatia.trade.use false gamemode=creative
```

## Commands {/* #commands */}

| Command | What it does |
|---|---|
| `/trade <player>` | asks a player to trade; with VersatiaInteractions, sends its menu's offer |
| `/trade accept <player>`, `/trade decline <player>` | answer a request, on a server without VersatiaInteractions; the chat line's buttons run them |
| `/versatia reload trade` | applies an edited `config.yml` or messages file ([`/versatia reload`](../commands.md#versatia-reload)) |

## config.yml {/* #config-yml */}

VersatiaTrade writes the file at its first start:

```yaml title="plugins/VersatiaTrade/config.yml"
trade:
  countdown: 3s
  max-distance: 10
money:
  steps: [1, 10, 100, 1000]
request:
  timeout: 15s
log:
  enabled: true
window:
  icons:
    divider: "minecraft:black_stained_glass_pane"
    accept: "minecraft:lime_dye"
    accepted: "minecraft:lime_concrete"
    blocked: "minecraft:barrier"
    status: "minecraft:paper"
    countdown: "minecraft:clock"
    money: "minecraft:gold_nugget"
    partner-money: "minecraft:gold_ingot"
    partner-accepted: "minecraft:lime_concrete"
    partner-waiting: "minecraft:gray_concrete"
sounds:
  request: "minecraft:block.note_block.pling"
  changed: "minecraft:ui.button.click"
  accepted: "minecraft:block.note_block.chime"
  completed: "minecraft:entity.player.levelup"
  refused: "minecraft:entity.villager.no"
  cancelled: "minecraft:block.note_block.bass"
```

| Key | What it sets |
|---|---|
| `trade.countdown` | how long the exchange waits once both players accepted, a [duration](../configuration-files.md#durations); any change to an offer stops it |
| `trade.max-distance` | blocks; a trade opens only this close, in the same world, and moving farther apart ends it |
| `money.steps` | the amounts of the money buttons, one to four; a left click adds, a right click takes back, Shift makes it ten times as much, never beyond the balance |
| `request.timeout` | how long a `/trade` request waits on a server without VersatiaInteractions; with it, its `requests.timeout` applies |
| `log.enabled` | whether completed trades go into [the trade log](#the-trade-log) |
| `window.icons.<part>` | the item model of each part of the window; a resource pack can give each a model of its own |
| `sounds.<moment>` | the sound of each moment, a sound key of the game or of the resource pack; `''` plays nothing |

A wrong value fails the start or the reload naming the key.

## Messages {/* #messages */}

`plugins/VersatiaTrade/messages/trade.yml` holds everything VersatiaTrade says;
[Editing messages](../messages.md) explains the format and the styles.

| Section | What it says |
|---|---|
| `interaction` | the Trade button of VersatiaInteractions' menu: its name, the sentences saying a player is trading, its lore, and the chat lines and the dialog of an offer |
| `deny` | why a trade cannot start, also shown on the Trade button |
| `request` | requests by `/trade` on a server without VersatiaInteractions, with their chat line |
| `window` | the window: its title, the lore of the items, the money, the accept buttons and the status line |
| `trade` | the end of a trade: completed, refused, an offer that changed, and why it ended |

A message that reads wrong is yours to fix, in this file. A reason another plugin gives when it
stops a trade or keeps an item out of one, a combat plugin say, comes from that plugin's messages;
when it gives none, players read `deny.unavailable` or `trade.item-denied`.

The button that accepts a request or an offer has a style of its own, which VersatiaTrade adds
to the server's file when it starts:

```yaml title="plugins/VersatiaCore/styles.yml"
# Default styles of VersatiaTrade
accept: "<green><!italic>"
```

It is green and upright inside the italic of `clickable`. A player who does not want to trade lets
the request expire or types `/trade decline <player>`; with VersatiaInteractions,
`/interact decline <player> trade`.

## The trade log {/* #the-trade-log */}

Every completed trade is one line of `plugins/VersatiaTrade/logs/trades-<date>.log`, a file per day:
the time, then each player with their UUID, the items they gave and the money:

```text title="plugins/VersatiaTrade/logs/trades-2026-11-22.log"
2026-11-22T00:45:12+01:00 Alice (3f2b6a1e-6a4d-4d55-9a5e-1c2b3d4e5f60) gave [10 × minecraft:diamond] and 30 | Bob (8c1d0e4f-2b7a-4e19-b3c6-7d8e9f0a1b2c) gave [1 × minecraft:iron_sword "Fang"] and 50
```

The lines are written on a thread of their own, in the order of the trades; those still waiting are
written when the plugin stops. `log.enabled: false` switches the log off.

## Corner cases {/* #corner-cases */}

- **Two distances with VersatiaInteractions.** An offer from its menu needs the players within its
  `requests.max-distance` and the trade within `trade.max-distance`: the smaller one applies,
  10 blocks by default.
- **Two timeouts.** With VersatiaInteractions, a trade offer waits its `requests.timeout`, 15 s by
  default; `request.timeout`, also 15 s, applies only to `/trade` without it.
- **An exchange that cannot happen** when the countdown ends (an item is gone, a side lacks room or
  money) does not end the trade: the acceptances go, both players read why, and they may accept
  again.
- **The economy goes away** during a trade: the status says money cannot be traded now, and
  accepting waits until the economy is back or the money is taken out of the offers.
- **A crash right after an exchange** keeps it, since both players' data are saved at once.
- **Items on the ground** stay there while a player trades and can be picked up after the trade.
- **Creative mode** is allowed unless you deny `versatia.trade.use` there
  ([Permissions](#permissions)).
