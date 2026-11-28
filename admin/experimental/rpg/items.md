---
title: VersatiaRpg-Items
counterpart: /experimental/plugins/rpg/items
description: Installing VersatiaRpg-Items, the types of items of items.yml with their stats and requirements, the layout of their lore, and the /items command.
---

# VersatiaRpg-Items

VersatiaRpg-Items gives a server its own items: each type is made of a Minecraft item, gives the stats
the server sets, asks for a level, a class or stats, and tells all of it in its lore. A player who does
not meet a requirement can neither wear nor hold the item.

## Installing {/* #installing */}

Put `VersatiaRpg-Items.jar` into `plugins/` and start the server:

| Plugin | Dependency | Needed for |
|---|---|---|
| VersatiaCore | required | everything: VersatiaRpg-Items runs on it |
| CommandAPI | optional | `/items` |
| [VersatiaRpg-Stats](stats.md) | optional | the stats items give and require |
| [VersatiaRpg-Characters](characters.md) | optional | the classes items require |
| [VersatiaModule-ItemViews](../item-views.md) | optional | the lore rendered for each player, with what they miss of an item's requirements marked |

A type that gives stats without VersatiaRpg-Stats, or requires classes without VersatiaRpg-Characters,
fails the start, naming it.

## Types of items {/* #types-of-items */}

```yaml title="plugins/VersatiaRpg-Items/items.yml"
items:
  short_sword:
    material: iron_sword
    model: rpg:short_sword
    stats:
      minecraft:attack_damage: 6
      minecraft:attack_speed: -2.4
      rpg:critical_chance: 5
    requires:
      level: 10
      classes: [warrior, barbarian]
      stats: {rpg:strength: 30}
```

| Key | Means |
|---|---|
| `material` | the Minecraft item it is made of; its own attributes are gone, so give it everything it should give, its attack speed too |
| `model` | optional, a model of the server's resource pack |
| `slot` | where it gives its stats: `hand`, `off_hand`, `head`, `chest`, `legs` or `feet`; by default the material's own slot (`head` for a helmet), else `hand` |
| `stats` | what it adds to each stat: vanilla attributes (`minecraft:attack_damage`, `minecraft:armor`) and the stats of [VersatiaRpg-Stats](stats.md#the-servers-stats) |
| `requires` | `level`, an experience level; `classes` of VersatiaRpg-Characters; `stats`, the least values of the stats of VersatiaRpg-Stats, counted without what items give; and the kinds other plugins add |

Each type needs its name in `plugins/VersatiaRpg-Items/messages/items.yml`, and may have a description,
a line or a list of lines; [Editing messages](../../messages.md) explains the format:

```yaml title="plugins/VersatiaRpg-Items/messages/items.yml"
item:
  short_sword:
    name: "Short sword"
    lore:
      - "The light sword of a recruit."
```

`/versatia reload items` applies a change: items in players' inventories take their new look at once,
those in chests when one is opened.

## Requirements {/* #requirements */}

In survival and adventure a player who misses a requirement cannot put the item on, the hotbar passes
over its slot, and using it does nothing. An item worn that stops being theirs to use, after a level was
lost, moves into their inventory. In creative and spectator nothing is stopped, but only the items whose
requirements a player meets give stats.

## The lore {/* #the-lore */}

```yaml title="plugins/VersatiaRpg-Items/config.yml"
lore:
  order: [description, space, stats, space, requirements]
  hidden-stats: [minecraft:attack_speed]
  unusable: requirements
```

`order` lists the parts of the lore, top to bottom: `description` (the type's, then the item's own,
which a plugin may give it), `stats`, `requirements`, and the parts other plugins add under their
names, which stay empty while no plugin adds them. The part
`stats` opens with what the item is: the line of its slot, `lore.kind.<slot>` (`Weapon` for `hand`,
`Helmet` for `head`), or the type's own, `item.<id>.kind`; leave a slot out for no such line. In the
line of a stat, `{value}` is what the item gives and `{percent}` the same times 100, for a fraction
such as `minecraft:knockback_resistance` (`+{percent}%` reads `+10%`). `space` is an
empty line that shows only between two parts with lines; `force-space` one that always shows.
`hidden-stats` are stats an item gives without a line in its lore. The texts, a header over a part
(`lore.header.<part>`, shown only over a part with lines), the line of a stat and those of the
requirements, are in `messages/items.yml`. Every line takes the style `itemLore` of
[the server's styles](../../messages.md#styles), grey and upright by default.

Without the [ItemViews module](../item-views.md) the lore is written on the item, the same for every
player. With it, each player sees the lore worked out for them, and `unusable` says what shows
that they miss a requirement: `requirements` marks the lines of the requirements they miss, in the
style `unmetRequirement`; `item` shows the whole item, its name and every line, in the style
`unusableItem`. A plugin can put the lore of an item in a style of its own as well, such as its
tier's, which colours the headers and lines inside it as the server's styles file says. Both are red by default, and the names inside them, a heading, a label or a value
(`accent`), take the colours the section gives them:

```yaml title="plugins/VersatiaCore/styles.yml"
unusableItem:
  style: "<red>"
  heading: "<dark_red><bold>"
  label: "<red>"
  accent: "<dark_red>"
unmetRequirement:
  style: "<red>"
  label: "<red>"
  accent: "<dark_red>"
```

## Commands and permissions {/* #commands-and-permissions */}

| Command | Permission | Default | Does |
|---|---|---|---|
| `/items list` | `versatia.items.command.items` | operators | lists the types of `items.yml` |
| `/items give <player> <type> [amount]` | the same | operators | gives items of a type; what the inventory cannot hold drops at the player's feet |

## Corner cases {/* #corner-cases */}

- **An item whose type `items.yml` no longer has** keeps its look and gives nothing.
- **Installing or removing the ItemViews module** needs nothing more: an item takes the lore of the
  new way the next time it is touched, as at a reload.
- **A worn item whose requirements stop being met while the inventory is full** stays on: it gives
  nothing, shows as unusable, and moves into the inventory at the next change there that leaves a free
  slot (storage first, then the hotbar).
- **In creative mode** a player can put on and hold any item, one they cannot use too, which then gives
  nothing. Back in survival or adventure such an item goes from their armour and off hand into the
  inventory at once, where there is room, and the hotbar passes over it again.
