---
title: VersatiaRpg-Skills
counterpart: /admin/experimental/rpg/skills
description: How your plugin adds a skill to the skill bar of VersatiaRpg-Skills, grants and revokes skills, uses them from code, sets cooldowns, and adds costs and levels through its events.
---

# VersatiaRpg-Skills

import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

VersatiaRpg-Skills puts a skill bar on the hotbar: slots 1 to 6 are its places, and a place with a skill
always shows the skill's icon. Picking that slot uses the skill instead of changing what the hand holds.
Your plugin adds skills with one annotation, and a server's own plugin decides who knows which.
VersatiaRpg-Skills knows no classes, levels or costs and deals no damage: what a skill does is your
plugin's.

:::admin

Installing VersatiaRpg-Skills, the size of the bar, the icons of skills and the messages players read
are on the [VersatiaRpg-Skills](/admin/experimental/rpg/skills) page of the server admin guide.

:::

## The bar {/* #the-bar */}

| What | What happens |
|---|---|
| a skill granted | it takes the first free place of the bar; an item in that slot goes into the inventory |
| picking its slot | with its key or the mouse wheel: cancelled, so the hand keeps what it held, and the skill is used; a server may ask for Shift held out of combat mode |
| a hit | the skill's damage is a hit of the player's: with VersatiaRpg-Combat it starts combat mode, and a skill that hurts nobody starts none |
| cooldown | the icon takes the cooldown look, and its count is the seconds left |

A place without a skill is an ordinary slot until a skill takes it, so the bar fills as players learn
skills. The size of the bar (6 slots by default, at most 8) and whether out of combat mode a skill needs Shift
(no by default) are the server's.

## Adding a skill {/* #adding-a-skill */}

A class annotated `@Skill` that implements `SkillAction` adds a skill. It is a local bean of your
plugin, so its constructor is injected, and the annotation carries
`@ConditionalOnPlugin("VersatiaRpg-Skills")`: on a server without VersatiaRpg-Skills the class is
skipped and never loaded. Your build compiles against the plugin with `compileOnly`, `plugin.yml` lists
it under `softdepend:`, your messages hold the skill's name and lore, and your `config.yml` its icon:

<CodeCards>
<CodeCard title="WhirlwindSkill.kt">

```kotlin
@Skill("whirlwind")
class WhirlwindSkill : SkillAction {
    override val cooldown = 12.seconds

    override fun use(use: SkillUse) {
        val around = use.player.getNearbyEntities(3.0, 2.0, 3.0).filterIsInstance<LivingEntity>()
        around.forEach { use.hit(it, 4.0 + use.level) }
    }
}
```

</CodeCard>
<CodeCard title="build.gradle.kts">

```kotlin
dependencies {
    compileOnly("dev.versatia:VersatiaRpg-Skills:0.0.1")
}
```

</CodeCard>
<CodeCard title="plugin.yml">

```yaml
softdepend:
  - VersatiaRpg-Skills
```

</CodeCard>
<CodeCard title="messages/skills.yml">

```yaml
skill:
  whirlwind:
    name: "Whirlwind"
    lore:
      - "Spins, striking everyone around you."
```

</CodeCard>
<CodeCard title="config.yml">

```yaml
skills:
  whirlwind:
    material: iron_axe
    model: myrpg:skills/whirlwind
    cooldown-model: myrpg:skills/whirlwind_cooling
```

</CodeCard>
</CodeCards>

The id, `whirlwind`, names the skill on the server: lower-case letters, digits, `_` and `-`, and one
plugin owns it. `skill.<id>.name` is required, `skill.<id>.lore` optional; in the icon, `material` is
required, and `model` and `cooldown-model`, models of the server's resource pack, are optional. Without
a `cooldown-model`, the skill cools down under the server's common cooldown icon. A reload of your
plugin reads all of them again, and a mistake in them fails its start or its reload. The API is in the
package `dev.versatia.rpg.skills`.

A plugin that keeps a file per skill, with its numbers and effects, writes the icon at the top of that
file instead, `skills/<id>.yml` of its data folder, shipped in your JAR like `config.yml`;
VersatiaRpg-Skills reads the icon there whenever the file exists. Next to the icon, `use-underwater` and
`use-in-air` decide for this skill alone whether it may be used under water and in the air, instead of the
server's `config.yml`; a key left out follows it:

```yaml title="skills/whirlwind.yml"
material: iron_axe
model: myrpg:skills/whirlwind
cooldown-model: myrpg:skills/whirlwind_cooling
use-in-air: true
```

## What a skill answers {/* #what-a-skill-answers */}

| Member | Is |
|---|---|
| `cooldown` | how long the skill cools down after each use; a listener of `SkillUseEvent` may change it for one use |
| `use(use)` | the skill itself, called on the server thread once it is ready and no listener denied it |

What `use` holds:

| Member | Is |
|---|---|
| `use.player`, `use.id`, `use.level` | who uses which skill, at which level |
| `use.hit(target, amount)` | hurts `target` as the player and answers whether the hit landed: false when vanilla (the pvp game rule, invulnerability) or a plugin (a protected region of WorldGuard, an ally in a guild) stopped it. Server thread only, also later, from a task the skill started |

A skill hurts with `use.hit`, so PvP, protected regions and combat mode treat its damage as any hit of the
player's: a hit that lands starts combat mode, and a skill that hurts nobody starts none. Its answer serves
a skill that acts on a landed hit, such as a leap that stops at the first creature it really hits:

```kotlin title="Wrong: nobody's hit, so no rule of the server applies to it"
// error-next-line
target.damage(6.0)
```

```kotlin title="Right"
// fix-next-line
use.hit(target, 6.0)
```

## Granting skills {/* #granting-skills */}

Who knows which skill is up to a plugin, usually the server's own, which injects `Skills`:

| Member | Does |
|---|---|
| `skills.grant(player, id)` | teaches the skill, which takes the first free place of the bar; false when the player knew it |
| `skills.revoke(player, id)` | makes the player forget it; its place goes to a skill that had none, or stays free |
| `skills.known(player)` | the ids the player knows, in the order they learned them |
| `skills.loadout(player)` | the bar, place by place from slot 1: the id there, null for a free place |
| `skills.place(player, id, place)` | puts a known skill on a place, 0 being slot 1, swapping with the skill there |
| `skills.use(player, id)` | uses the skill as picking its slot does, with the same checks and messages, Shift or not |
| `skills.cooldown(player, id, duration)` | makes it cool down for that long from now; `Duration.ZERO` makes it ready |
| `skills.refresh(player)` | makes the icons of the bar anew, after something a `SkillIconShowEvent` listener adds to them changed |

With VersatiaRpg-Characters the skills, the bar and the cooldowns belong to the character a player
plays, so a plugin grants them once the character is played. `grant` fails for a player who plays none:

```kotlin
@ConditionalOnPlugin("VersatiaRpg-Skills", "VersatiaRpg-Characters")
class ClassSkills(private val skills: Skills) : Listener {
    @EventHandler
    fun onSelected(event: CharacterSelectedEvent) {
        if (event.character.classId == "warrior") skills.grant(event.player, "whirlwind")
    }
}
```

All of it, cooldowns included, is in the database, so a cooldown goes on while the player is away.

## Events {/* #events */}

| Event | When | A listener can |
|---|---|---|
| `SkillUseEvent` | before a player uses a skill that is ready | deny it with a reason the player reads, set its `level`, change its `cooldown` |
| `SkillUsedEvent` | after a player used a skill | play a sound, count it for a quest |
| `SkillGrantedEvent`, `SkillRevokedEvent` | after a player learned or forgot a skill | tell them where it is |
| `SkillIconShowEvent` | before a skill's icon shows on a player's bar | add lines below its lore |

`SkillUseEvent` is where a server's own plugin adds what VersatiaRpg-Skills leaves out, such as a cost
in energy and a level growing with the player's. Another listener may still deny the use, so the cost
is paid once the skill was used:

```kotlin
class SkillRules(private val energy: Energy, private val messages: Messages) : Listener {
    @EventHandler
    fun onUse(event: SkillUseEvent) {
        if (energy.of(event.player) < 10) return event.deny(messages["skill.no-energy"].get())
        event.level = event.player.level / 10 + 1
    }

    @EventHandler
    fun onUsed(event: SkillUsedEvent) = energy.take(event.player, 10)
}
```

`SkillIconShowEvent` puts on the icon what a plugin keeps about a skill, below the skill's lore, such as
a proficiency of the server's own; once that changes, the plugin calls `skills.refresh(player)`:

```kotlin
class ProficiencyLines(private val ranks: Ranks, private val messages: Messages) : Listener {
    @EventHandler
    fun onShow(event: SkillIconShowEvent) {
        event.lines += messages["skill.proficiency"].get(arg("rank", ranks.of(event.player, event.id)))
    }
}
```

Their properties are in the repository's
[docs/events.md](https://github.com/VersatiaFramework/VersatiaRpg/blob/master/docs/events.md#versatiarpg-skills).

## Corner cases {/* #corner-cases */}

- **A skill still cooling down** fires no `SkillUseEvent`: the player reads how long it has left.
- **A skill that throws** is logged with its id and plugin, and starts no cooldown.
- **`SkillIconShowEvent`** fires when an icon is made, not while the count of a cooling one goes down; a
  line it adds takes the look of `skillLore` wherever it sets none, so none shows in vanilla's purple italic.
- **A hit landed** when its damage event got past every plugin, as VersatiaRpg-Skills sees it at MONITOR.
  Vanilla stops some hits before any event, a creature hit a moment before, say; `use.hit` answers false for
  those too.
- **Under water or in the air** a skill is not used, from its slot or through `Skills.use`, unless the
  server's `use-underwater` or `use-in-air` allows it, or the skill's own icon does; the player reads why,
  and no `SkillUseEvent` fires.
- **A full bar**: a skill granted then has no place, and takes the first place a forgotten skill frees.
- **A skill with a file of its own**, `skills/<id>.yml`, takes its icon from that file alone; a section
  `skills.<id>` of `config.yml` for it is not read.
- **A skill whose plugin stops** leaves the bars, stays known with its place and cooldown, and comes back
  with the plugin.
- **Icons are never saved**: they go before the player leaves or changes character, and are made again
  from the database, so an inventory your plugin reads or saves holds none.
