---
title: VersatiaRpg-Combat
counterpart: /experimental/plugins/rpg/combat
description: Installing VersatiaRpg-Combat, how long combat mode lasts, which hits start it, the pace of health and food regeneration in it, and its messages.
---

# VersatiaRpg-Combat

VersatiaRpg-Combat brings combat mode: a player enters it with a hit, dealt or taken, and stays in it
until its timer runs out, every further hit resetting the timer; in it, the player heals and eats at a
pace you choose. It changes no damage.

## Installing {/* #installing */}

Put `VersatiaRpg-Combat.jar` into `plugins/` and start the server:

| Plugin | Dependency | Needed for |
|---|---|---|
| VersatiaCore | required | everything: VersatiaRpg-Combat runs on it |

## Combat mode {/* #combat-mode */}

```yaml title="plugins/VersatiaRpg-Combat/config.yml"
duration: 10s
triggers:
  player-hits-player: true
  player-hits-creature: true
  creature-hits-player: true
regeneration:
  health: 1.0
  food: 1.0
notify: true
```

- `duration` is how long combat mode lasts after the last hit, with its unit (`10s`, `1m`): every hit
  resets the timer to it, never adding to the time left.
- `triggers` say which hits start it and reset its timer: a player hitting a player (both enter it),
  a player hitting another creature, a creature hitting a player. An arrow, another projectile or a primed TNT
  counts as its source's hit.
- `regeneration` is the pace at which health and food come back in combat mode, as a multiple of
  vanilla's: `1.0`, the default, is vanilla's own pace and changes nothing, `0.5` half of it, `0` none.
  Health is the natural regeneration from a full food bar, food what eating gives.
- `notify` sends players a line when they enter and leave combat mode.

`/versatia reload combat` applies a change; a player already in combat mode keeps the time they have.

## Messages {/* #messages */}

`plugins/VersatiaRpg-Combat/messages/combat.yml` holds the two lines players read;
[Editing messages](../../messages.md) explains the format:

```yaml title="plugins/VersatiaRpg-Combat/messages/combat.yml"
started: "<neutral>You are in combat."
ended: "<neutral>You are out of combat."
```

## Corner cases {/* #corner-cases */}

- **A hit another plugin cancels** (a protected region, say) starts nothing.
