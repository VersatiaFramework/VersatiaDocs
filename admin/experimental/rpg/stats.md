---
title: VersatiaRpg-Stats
counterpart: /experimental/plugins/rpg/stats
description: Installing VersatiaRpg-Stats, the stats of the server besides vanilla's attributes, their names, and the /stats command.
---

# VersatiaRpg-Stats

VersatiaRpg-Stats adds up the stats of players and mobs from the parts other plugins give: an item's
bonus, a buff, a class. Vanilla attributes, such as maximum health or attack damage, work as in vanilla;
the server's own stats, such as a critical chance, mean what the plugin reading them makes of them.

## Installing {/* #installing */}

Put `VersatiaRpg-Stats.jar` into `plugins/` and start the server:

| Plugin | Dependency | Needed for |
|---|---|---|
| VersatiaCore | required | everything: VersatiaRpg-Stats runs on it |
| CommandAPI | optional | `/stats` |

On its own, VersatiaRpg-Stats changes nothing: the plugins giving parts do.

## The server's stats {/* #the-servers-stats */}

```yaml title="plugins/VersatiaRpg-Stats/stats.yml"
stats:
  rpg:critical_chance: {default: 0, min: 0, max: 100}
  rpg:monster_damage: {default: 0}
```

Each stat is an id, `namespace:name`, never in the `minecraft` namespace, which holds vanilla's
attributes. `default` is its value while no plugin gives it anything, 0 when left out; `min` and `max`
are the least and the most it can be. The page of a plugin that reads stats names the ones it needs, and
a plugin giving a stat the file lacks fails, naming it. `/versatia reload stats` applies a change.

The name players read is in `plugins/VersatiaRpg-Stats/messages/stats.yml`, under its namespace, and a
stat without one fails the start or the reload, naming it. A vanilla attribute takes its name from each
player's game language, unless the file names it too, under `minecraft`, which every player then
reads, whatever their language. [Editing messages](../../messages.md) explains the format:

```yaml title="plugins/VersatiaRpg-Stats/messages/stats.yml"
stat:
  rpg:
    critical_chance: "Critical chance"
    monster_damage: "Damage to monsters"
  minecraft:
    armor: "Armour"
```

## Commands and permissions {/* #commands-and-permissions */}

| Command | Permission | Default | Does |
|---|---|---|---|
| `/stats` | `versatia.stats.command.stats` | everyone | shows your stats: each of `stats.yml` and each attribute a plugin gives a part of, with what each source gives |
| `/stats <player>` | `versatia.stats.command.stats.others` | operators | shows the stats of a player online |
