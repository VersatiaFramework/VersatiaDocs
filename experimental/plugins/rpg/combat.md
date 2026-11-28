---
title: VersatiaRpg-Combat
counterpart: /admin/experimental/rpg/combat
description: How your plugin reads, starts and ends combat mode with VersatiaRpg-Combat, stops it from starting, follows it through its events, and gives its own regeneration the pace of combat mode.
---

# VersatiaRpg-Combat

VersatiaRpg-Combat brings combat mode: a player enters it with a hit, dealt or taken, and stays in it
until its timer runs out, every further hit resetting the timer; in it, the player heals and eats at a
pace of its own. It computes no damage: how hard a hit lands stays vanilla's, or your plugin's.

:::admin

Installing VersatiaRpg-Combat, how long combat mode lasts, the hits that start it and its pace of
regeneration are on the [VersatiaRpg-Combat](/admin/experimental/rpg/combat) page of the server admin
guide.

:::

## Combat mode {/* #combat-mode */}

| Step | What happens |
|---|---|
| start | a hit between a player and another player or creature, as the server's `triggers` say, a projectile or a primed TNT counting as its source's hit; or your plugin's `enter` |
| timer | every further hit resets it to `duration` (10 seconds by default), never adding to the time left |
| in it | natural health regeneration and the food eating gives come at the server's pace; the default, 1.0, is vanilla's own pace |
| end | the timer runs out, the player dies or leaves the server, or a plugin ends it |

## Working with combat mode {/* #working-with-combat-mode */}

VersatiaRpg-Combat exposes `Combat`, which your plugin injects:

| Member | Does |
|---|---|
| `combat.isInCombat(player)` | whether the player is in combat mode now |
| `combat.remaining(player)` | how much longer, null while they are not in it |
| `combat.enter(player)`, `combat.enter(player, 30.seconds)` | starts it, or resets its timer, as a hit does; false when a plugin stopped the start |
| `combat.leave(player)` | ends it at once |
| `combat.healthRegeneration(player)`, `combat.foodRegeneration(player)` | the pace of regeneration now, as a multiple of vanilla's: 1.0, vanilla's own pace, outside combat mode, and by default in it too |

```kotlin
class SafeTeleport(private val combat: Combat, private val messages: Messages) {
    fun home(player: Player, home: Location) {
        if (combat.isInCombat(player)) return messages["home.in-combat"].send(player)
        player.teleport(home)
    }
}
```

## Regeneration of your own {/* #regeneration-of-your-own */}

VersatiaRpg-Combat paces vanilla's own regeneration. A plugin that heals players itself, with a
regeneration skill say, multiplies its amount by the pace, so the server's setting holds for it too:

```kotlin title="Wrong: the skill heals at full speed in a fight"
// error-next-line
player.heal(0.5)
```

```kotlin title="Right"
// fix-next-line
player.heal(0.5 * combat.healthRegeneration(player))
```

## Events {/* #events */}

| Event | When | A listener can |
|---|---|---|
| `CombatStartEvent` | before a player enters combat mode (not when a hit only resets the timer) | cancel it: the player stays out of combat mode, the hit itself is not affected |
| `CombatStartedEvent` | after a player entered combat mode | show a bar, lock a menu |
| `CombatEndedEvent` | after a player left combat mode, with its `cause` | undo what it started |

`opponent` names the other side of the hit that started combat mode, null when a plugin started it;
`cause` is `EXPIRED`, `DEATH`, `QUIT` or `ENDED` (a plugin, or VersatiaRpg-Combat stopping). Their
properties are in the repository's
[docs/events.md](https://github.com/VersatiaFramework/VersatiaRpg/blob/master/docs/events.md#versatiarpg-combat).

## Corner cases {/* #corner-cases */}

- **A hit resets the timer**, but never shortens a longer time a plugin gave with `enter`.
- **A cancelled hit** starts nothing.
