---
title: VersatiaRegions
counterpart: /admin/experimental/regions
description: Reading which regions of each layer a place lies in and the values they carry, and stopping or following players who cross into other regions through VersatiaRegions' events.
---

# VersatiaRegions

import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

VersatiaRegions gives a server regions of any shape, in layers: lands, then the places inside them,
then whatever a server needs. In a layer every column of the world lies in at most one region, and
a place inherits from the region of every layer it lies in, the innermost one winning, so a
cemetery painted inside a land takes the land's respawn point unless it sets its own. Builders
paint the shapes in game; the server's `regions.yml` names the regions and gives them values. Your
plugin reads which regions a place lies in and what they say, and stops or follows players who
cross into other regions.

:::admin

Installing VersatiaRegions, writing `regions.yml` and drawing regions are on the
[VersatiaRegions](/admin/experimental/regions) page of the server admin guide.

:::

## Reading the regions of a place {/* #reading-regions */}

VersatiaRegions exposes `Regions` to the plugins started after it. A bean of your plugin injects
it, carrying `@ConditionalOnPlugin("VersatiaRegions")` when your plugin runs without it too
([Working with a plugin](index.md#working-with-a-plugin)); `at` gives the regions of a place, one
per layer, and `value` the value the innermost of them sets:

<CodeCards>
<CodeCard title="Respawns.kt">

```kotlin
@ConditionalOnPlugin("VersatiaRegions")
class Respawns(private val regions: Regions, private val places: Places) {
    fun respawnOf(player: Player): Location? =
        regions.at(player.location).value<String>("respawn")?.let(places::get)
}
```

</CodeCard>
<CodeCard title="plugins/VersatiaRegions/regions.yml">

```yaml
worlds:
  karhan:
    lands:
      vayron:
        respawn: vayron-square
    places:
      vayron-cemetery:
        respawn: cemetery-gate
```

</CodeCard>
</CodeCards>

A player in the cemetery respawns at its gate, one anywhere else in Vayron on the square, one
outside every land nowhere special (`null`). The stack also tells each layer's region,
`inLayer("lands")`, and lists them all, outermost first, in `regions`; a `Region` has its `id`, its
`layer` and the `name` players read, from the server's messages.

- **Any thread.** `at` reads a snapshot of the shapes, so it is cheap and safe off the server
  thread too; it never loads a chunk.
- **Values are the server's.** A region carries whatever keys the admin writes; `value<T>` reads one
  as a `String`, `Boolean`, `Long`, `Double` or anything YAML holds, a whole number also as a
  `Long` or a `Double`. A value of another type fails naming where it is written
  (`Value at "worlds.karhan.lands.vayron.respawn" is "5", which is no String`).
- **A column, not a block.** Regions are 2D: a place's height does not matter.

## Events {/* #events */}

VersatiaRegions fires an event before a player walks into, or teleports to, a column whose regions
differ from theirs, which your plugin may deny, one after anything changed a player's regions, and
one after a builder changed the shapes:

| Event | When | A listener can |
|---|---|---|
| `PlayerRegionChangeEvent` | before a player moves or teleports into other regions | deny it with a reason the player reads |
| `PlayerRegionChangedEvent` | after a player's regions changed: a move, a teleport, joining, respawning, or the shapes changing under them | read `entered` and `left` |
| `RegionShapesChangedEvent` | after a builder filled, cut or deleted regions of a layer | read which regions changed |

Both player events carry `from` and `to`, the regions of the two columns, and `entered` and
`left`, the regions of any layer in one and not in the other, compared by id. A denied move leaves
the player where they were and shows the reason on the action bar, so that pushing against a
border does not fill the chat; a denied teleport shows it in the chat:

```kotlin title="ArenaRules.kt"
@ConditionalOnPlugin("VersatiaRegions")
class ArenaRules(private val combat: CombatTags, private val messages: Messages) : Listener {
    @EventHandler
    fun onChange(event: PlayerRegionChangeEvent) {
        if (event.left.any { it.id == "arena" } && combat.isTagged(event.player)) event.deny(messages["arena.no-escape"].get())
    }
}
```

The events are called on the server thread. Each is described, with all its properties, in the
[events of VersatiaRegions](https://github.com/VersatiaFramework/VersatiaRegions/blob/master/docs/events.md).

## Corner cases {/* #corner-cases */}

- **A reload makes new `Region` objects.** Compare regions by `id`, as `entered` and `left` do,
  never by identity.
- **Joining fires only `PlayerRegionChangedEvent`**, and only when the player joins inside a region;
  `from` is then empty. Joining and respawning cannot be denied.
- **Riding is seen late.** A player carried by a horse or a boat crosses a border unseen; the
  events fire at their next move of their own.
- **Shapes changing under a player** fire `PlayerRegionChangedEvent` with cause `REGIONS`, right
  after `RegionShapesChangedEvent`; so does a reload that changed regions.yml or the shapes.
