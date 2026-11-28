---
title: VersatiaRpg-Skills
counterpart: /experimental/plugins/rpg/skills
description: Installing VersatiaRpg-Skills, how players use the skill bar, its size and whether a skill needs Shift out of combat, the icons of skills, and the messages players read.
---

# VersatiaRpg-Skills

VersatiaRpg-Skills gives players a skill bar on the hotbar, for the skills other plugins add, such as
your server's own. Which player knows which skill is up to those plugins; VersatiaRpg-Skills shows the
skills, uses them and keeps their cooldowns.

## Installing {/* #installing */}

Put `VersatiaRpg-Skills.jar` into `plugins/` and start the server:

| Plugin | Dependency | Needed for |
|---|---|---|
| VersatiaCore | required | everything: VersatiaRpg-Skills runs on it |
| VersatiaModule-Database | required | the skills players know, their places on the bar and their cooldowns, in a SQLite file in `plugins/VersatiaRpg-Skills/` unless its `database.yml` names another database |
| VersatiaRpg-Combat | optional | a skill that hurts someone starts combat mode as any hit does; with `out-of-combat: sneak`, a skill needs Shift out of combat mode |
| VersatiaRpg-Characters | optional | the skills belong to the character played; without it, to the player |

## How players use it {/* #how-players-use-it */}

Slots 1 to 6 of the hotbar are the skill bar.

- **A slot with a skill** always shows its icon and never holds an item; a slot of the bar without a
  skill holds items as ever, until the player learns a skill that takes it. The item that lay there then
  goes into the inventory, or to the ground when the inventory is full.
- **Picking a slot with a skill**, with its key or the mouse wheel, uses the skill, and the hand keeps
  what it held. Under `out-of-combat: sneak`, out of combat mode the player holds Shift while picking it,
  and without Shift the action bar tells them to.
- **A skill that hurts someone** starts combat mode, as any hit does; one that hurts nobody starts none.
- **A skill cooling down** shows its cooldown icon, and its count is the seconds left.

## The bar {/* #the-bar */}

```yaml title="plugins/VersatiaRpg-Skills/config.yml"
bar-size: 6
out-of-combat: always
use-underwater: false
use-in-air: false
cooldown-icon:
  material: gray_dye
```

- `bar-size` is how many slots of the hotbar, from slot 1 on, are the bar: 1 to 8, so that one is always
  left for items.
- `out-of-combat: always`, the default, uses a skill whenever its slot is picked; `sneak` asks for Shift
  out of combat mode, so that scrolling through the hotbar uses no skill by accident. A server without
  VersatiaRpg-Combat has no combat mode, so `sneak` there means Shift every time.
- `use-underwater` and `use-in-air`, both `false` by default, let players use skills under water (while
  their air bar shows) and in the air (standing on nothing while neither swimming, climbing nor riding);
  a player who may not reads why, in messages `underwater` and `in-air`. A skill's own icon may decide
  either for that skill ([Icons of skills](#icons)).
- `cooldown-icon` is the icon of a skill while it cools down, a `material` and an optional `model` of
  your resource pack, used for every skill whose plugin names no cooldown model of its own.

`/versatia reload skills` applies a change at once.

## Icons of skills {/* #icons */}

The plugin that adds a skill describes it in its own files, which you edit like any of its files: its
name and lore in its messages, under `skill.<id>`, and its icon in its `config.yml`, under
`skills.<id>`, or, when the plugin keeps a file per skill, at the top of that skill's file,
`skills/<id>.yml`. For a skill `whirlwind` of your server's plugin `MyRpg`:

```yaml title="plugins/MyRpg/config.yml"
skills:
  whirlwind:
    material: iron_axe
    model: myrpg:skills/whirlwind
    cooldown-model: myrpg:skills/whirlwind_cooling
```

With a file per skill, the same icon opens that skill's file:

```yaml title="plugins/MyRpg/skills/whirlwind.yml"
material: iron_axe
model: myrpg:skills/whirlwind
cooldown-model: myrpg:skills/whirlwind_cooling
```

- `material` is the Minecraft item the icon is made of; the icon gives none of its attributes.
- `model` and `cooldown-model`, both optional, are models of your resource pack, `namespace:path`, for
  the icon ready and cooling down; without a `cooldown-model`, the skill cools down under
  `cooldown-icon` of VersatiaRpg-Skills.
- `use-underwater` and `use-in-air`, both optional, decide for this skill alone whether players may use it
  under water and in the air, whatever `config.yml` of VersatiaRpg-Skills says: `use-in-air: true` lets a
  roar be used mid-jump on a server that keeps every other skill on the ground.

A reload of that plugin (`/versatia reload myrpg`) reads them again. Every line of a skill's lore, and
every line another plugin adds below it, takes the style `skillLore` (grey, not italic), and a skill's name in a message the style `skill` if you
define one, in `plugins/VersatiaCore/styles.yml`.

## Messages {/* #messages */}

`plugins/VersatiaRpg-Skills/messages/skills.yml` holds the lines players read;
[Editing messages](../../messages.md) explains the format:

```yaml title="plugins/VersatiaRpg-Skills/messages/skills.yml"
cooling-down: "<negative>{skill} is not ready yet: {seconds} s left."
use-denied: "<negative>You cannot use {skill} now."
sneak-to-use: "<neutral>Hold Shift to use {skill} out of combat."
```

`sneak-to-use` shows in the action bar. `use-denied` shows only when a plugin stops a skill without a
sentence of its own; a plugin's own sentence is in its messages, which you edit there.

## Corner cases {/* #corner-cases */}

- **A cooldown goes on while the player is away**, and one longer than 99 seconds shows 99 until 99
  seconds are left.
- **Icons are never saved with an inventory**: they go as a player leaves, before a change of character
  and when the plugin stops, and come back from the database. A death drops none.
- **Icons stay in their slots**: players cannot move, drop or use them. A player in creative mode sets
  their slots themselves and can copy an icon; the copy does nothing and soon goes.
- **A start kit** of VersatiaRpg-Characters with items in slots that skills take puts those items into the
  inventory instead.
- **A skill whose plugin is removed** stays known, its place an ordinary slot, until the plugin is back.
- **A smaller `bar-size`** leaves the skills past it known but off the bar, until it grows again.
- **A skill with a file of its own** takes its icon from that file; a section `skills.<id>` for it in the
  plugin's `config.yml` is then ignored.
