---
title: VersatiaRpg
sidebar_label: Overview
pagination_label: VersatiaRpg
counterpart: /admin/experimental/rpg
description: The VersatiaRpg engine, its plugins, each one idea as a thin layer over vanilla, and how a server's own plugin combines them.
---

# VersatiaRpg

VersatiaRpg is an RPG engine made of small plugins, one idea each. Every plugin is a thin layer over
vanilla Minecraft: it brings its concept, its events, its settings and an API, and imposes no formula
of a particular server, which wraps the plugins in rules of its own, in a plugin of its own.

| Plugin | Its idea | What your plugin does with it |
|---|---|---|
| [VersatiaRpg-Characters](characters.md) | a character slot per class for every player, each character with its own place, inventories, health and experience bar | read the character a player plays, keep data per character, stop or follow the creation and switching of characters |
| [VersatiaRpg-Combat](combat.md) | combat mode, started by a hit, its timer reset by every further one, with its own pace of health and food regeneration | read, start and end combat mode, stop it from starting, give your own regeneration its pace |
| [VersatiaRpg-Stats](stats.md) | the stats of players and mobs added up from the parts plugins give, vanilla attributes included | give a part of an entity's stats, read what they add up to, follow their changes |
| [VersatiaRpg-Items](items.md) | types of items in a file, with the stats they give, what a player needs to wear or hold them, and their lore | make items of a type, keep values of your own in them, add parts of their lore and kinds of requirement |
| [VersatiaRpg-Skills](skills.md) | a skill bar on the hotbar for the skills any plugin adds, each always on its slot, with cooldowns kept in the database | add skills, grant and revoke them, use them from code, add costs and levels through their events |

The plugins need nothing of each other: a server installs those it uses, and your plugin names in
`plugin.yml` the ones it works with, as for every [plugin built on Versatia](../index.md#working-with-a-plugin).
Every event they fire is in the repository's
[docs/events.md](https://github.com/VersatiaFramework/VersatiaRpg/blob/master/docs/events.md).

:::admin

Installing the plugins of VersatiaRpg is on the [VersatiaRpg](/admin/experimental/rpg) pages of the
server admin guide.

:::

## Plugins that work together {/* #plugins-that-work-together */}

The plugins go from the most general to the most specific: VersatiaRpg-Combat and VersatiaRpg-Stats
make sense on any server, VersatiaRpg-Characters builds on them, VersatiaRpg-Items and VersatiaRpg-Skills
on those, and a server's own plugin comes last. A
plugin depends only on plugins more general than itself, never the other way round, and always softly:
it lists them under `softdepend`, puts `@ConditionalOnPlugin` on every class naming their classes, and
works without them. A plugin of yours takes its place in the same order.

A rule tying two plugins lives in the more specific one, which reads the general one's API and denies
through an event: its own event when the rule restricts its own action, the general plugin's event when
it restricts that one's. VersatiaRpg-Characters keeps a player in combat mode from changing character by
denying its own `CharacterSelectEvent`; a rule against combat mode during a switch would deny
VersatiaRpg-Combat's `CombatStartEvent`. The general plugin never names the specific one: it offers its
state through its API, and events before and after its actions. Plugins equally general never depend on
each other, so a rule between them is the server's. A vanilla action, an ender pearl or a command, is
restricted by the plugin whose state the rule reads. A built-in rule has no switch: a server's plugin
lifts it by letting the event through at a later priority.

```kotlin
@ConditionalOnPlugin("VersatiaRpg-Combat")
class NoDepositInCombat(private val combat: Combat, private val messages: Messages) : Listener {
    @EventHandler
    fun onDeposit(event: DepositEvent) {
        if (combat.isInCombat(event.player)) event.deny(messages["deposit.in-combat"].get())
    }
}
```

## A server's own rules {/* #a-servers-own-rules */}

A rule of one server belongs to that server's own plugin, which injects what it needs. Classes that
need a permission, say:

```kotlin
class LockedClasses(private val messages: Messages) : Listener {
    @EventHandler
    fun onCreate(event: CharacterCreateEvent) {
        if (!event.player.hasPermission("server.class.${event.classId}")) event.deny(messages["class.locked"].get())
    }
}
```

The same goes for formulas: how much damage a hit deals, critical hits or blocking are the server's,
written in its plugin on top of vanilla's damage events and the APIs of the engine.
