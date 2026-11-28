---
title: ItemViews module
counterpart: /experimental/modules/item-views
description: Installing the ItemViews module, which shows items to each player apart, and what players and the server notice of it.
---

# ItemViews module

The ItemViews module lets plugins show their items to each player apart: a requirement in red for
a player who misses it, a price in a shop's window. It changes only what each player sees; the
items on the server, in chests and in the database stay as they are. On its own the module does
nothing: the plugins that use it say what their items show, such as
[VersatiaRpg-Items](rpg/items.md#the-lore).

## Installing {/* #installing */}

Put `VersatiaModule-ItemViews-0.0.1.jar` into `plugins/` next to VersatiaCore and restart the
server:

| Plugin | Dependency | Needed for |
|---|---|---|
| VersatiaCore | required | everything: the module runs on it |

The module has no files of its own and no commands. It reads and writes the server's own packets,
so it runs on the Paper build it was made for and needs its own new version for another one; a
mismatch fails its start, which the log names.

## What players notice {/* #what-players-notice */}

A player sees the look of an item in their inventory, on their cursor, in the windows they open and
in the trades of merchants. Everywhere else, in an item frame, on the ground or in a hover over an
item in chat, an item shows as the server holds it. A player in creative mode who takes an item
from their inventory gets the item itself, never what they saw of it.

## Corner cases {/* #corner-cases */}

- **Another plugin that rewrites items in packets** (some resource-pack plugins do, for their own
  items) works beside the module as long as the two do not show the same items.
- **A plugin that cannot show its items** logs the error once and its items show as the server holds
  them until it is fixed; nothing is lost.
