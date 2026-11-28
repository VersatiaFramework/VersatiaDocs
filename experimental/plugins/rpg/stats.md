---
title: VersatiaRpg-Stats
counterpart: /admin/experimental/rpg/stats
description: How your plugin gives players and mobs parts of their stats, vanilla attributes or the server's own, and reads what the parts add up to, with VersatiaRpg-Stats.
---

# VersatiaRpg-Stats

VersatiaRpg-Stats adds up the stats of players and mobs from the parts plugins give: the items a player
wears, the buffs on them, their class. It computes no damage and no critical hit: it gives the numbers,
and vanilla, or the plugin that reads a stat, gives them their meaning.

:::admin

Installing VersatiaRpg-Stats, the server's stats, their names and `/stats` are on the
[VersatiaRpg-Stats](/admin/experimental/rpg/stats) page of the server admin guide.

:::

## Stats {/* #stats */}

A `Stat` is named `namespace:name` and is one of two kinds:

| Kind | Example | Its effect |
|---|---|---|
| a vanilla attribute | `Stat.of(Attribute.MAX_HEALTH)`, any attribute of Paper | vanilla's: more hearts, a harder hit, a faster run |
| a stat of the server's `stats.yml` | `Stat.of("rpg:critical_chance")` | the one the plugin reading it gives |

A vanilla attribute takes each part as a transient modifier of the entity, so vanilla gives the effect
and nothing goes into a save. `stat in stats` tells whether the server has a stat: check the stats your
plugin's content names when it starts.

## Giving a part {/* #giving-a-part */}

A source, such as `items`, sets its whole part of an entity whenever it changes, and the new part
replaces the old one; a part giving nothing, or `remove`, takes it away:

```kotlin
class ItemStats(private val stats: Stats) {
    fun onEquipmentChanged(player: Player) = stats.contribute(player, source = "items") {
        add(ATTACK_DAMAGE, 6.0)
        add(CRITICAL_CHANCE, 5.0)
        multiply(MOVEMENT_SPEED, 0.10)
    }

    companion object {
        val ATTACK_DAMAGE = Stat.of(Attribute.ATTACK_DAMAGE)
        val MOVEMENT_SPEED = Stat.of(Attribute.MOVEMENT_SPEED)
        val CRITICAL_CHANCE = Stat.of("rpg:critical_chance")
    }
}
```

The operations are vanilla's: `add` adds, `multiply` adds a fraction of what is added up (0.1 is +10%,
and two of them make +20%), `multiplyTotal` multiplies the whole after everything else. A stat adds up
as (base + adds) × (1 + fractions) × the total factors. A stat that is neither vanilla's nor in the
server's `stats.yml` fails `contribute`, naming it.

## Reading stats {/* #reading-stats */}

```kotlin
val critical = stats[player][CRITICAL_CHANCE]
```

A vanilla attribute reads as the entity has it, its other modifiers included, such as those of the
sword in the player's hand. A stat of `stats.yml` is its default with every part, within its `min` and
`max`.

## When parts go {/* #when-parts-go */}

A part lasts while its entity is in the world: a mob's goes when the mob dies or unloads, a player's when
they leave the server, and a respawn keeps it. Set yours again when the entity comes back: a player's at
`PlayerJoinEvent`, or, with [VersatiaRpg-Characters](characters.md), at `CharacterSelectedEvent`, since
each character has its own items and class.

## Events {/* #events */}

| Event | When | A listener can |
|---|---|---|
| `StatsChangedEvent` | after a part or a reload of stats.yml changed an entity's stats | follow each stat changed, with its old and new value: a health bar, an item's description |

## Corner cases {/* #corner-cases */}

- **An attribute the entity lacks**, such as the attack damage of a villager, takes no part.
- **Health above vanilla's maximum** survives a rejoin: vanilla cuts it as the player joins, and the
  parts raising the maximum within a few seconds of the join give it back.
