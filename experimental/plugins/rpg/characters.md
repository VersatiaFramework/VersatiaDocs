---
title: VersatiaRpg-Characters
counterpart: /admin/experimental/rpg/characters
description: How your plugin reads the character a player plays, keeps data per character and follows characters through their events, with VersatiaRpg-Characters.
---

# VersatiaRpg-Characters

VersatiaRpg-Characters gives every player a character slot per class, and each character its own
place, inventories, health, food, effects and experience bar. A slot is free until the player first
plays its class.

:::admin

Installing VersatiaRpg-Characters, its classes, the start of new characters, their skins, its messages
and its commands are on the [VersatiaRpg-Characters](/admin/experimental/rpg/characters) page of the
server admin guide.

:::

## What a character keeps {/* #what-a-character-keeps */}

A VersatiaRpg-Characters character is a vanilla player state of its own. Switching characters puts the
state of one away and gives the player the state of the other:

| Data | Each character its own | Shared by a player's characters |
|---|---|---|
| place, respawn point | ✓ | |
| inventory with armour and off hand, ender chest | ✓ | |
| health, food, saturation, exhaustion, potion effects | ✓ | |
| experience bar | ✓ | |
| game mode, advancements, statistics, recipes | | ✓ |

The character a player plays keeps its state where vanilla keeps it, in the player's own file, so
whatever your plugin does to a player the vanilla way (fill an inventory, heal, teleport) is done to
that character, with no call to VersatiaRpg-Characters. A plugin that gives the experience bar another
meaning, such as RPG levels, keeps it right; the bar already follows the character.

## Working with characters {/* #working-with-characters */}

VersatiaRpg-Characters exposes `Characters`, which your plugin injects:

| Member | Gives |
|---|---|
| `characters[player]` | the `Character` the player plays, null while they play none |
| `characters.all(player)` | the player's characters, in the order of the server's classes |
| `characters.classes` | the class ids of the server, one slot each |
| `characters.play(player, classId)` | plays that character, creating it in its free slot, as `/character play` does |
| `characters.refreshSkin(player)` | puts the player's skin on again ([Skins](#skins)) |

A `Character` holds its `id`, its player's UUID (`account`), its `classId`, when it was created and
last played, and its play time. Values are snapshots: read `characters[player]` again rather than
keeping one.

```kotlin
class ClassGreeting(private val characters: Characters, private val messages: Messages) : Listener {
    @EventHandler
    fun onJoin(event: PlayerJoinEvent) {
        val character = characters[event.player] ?: return
        messages["greeting.${character.classId}"].send(event.player)
    }
}
```

Your plugin compiles against `dev.versatia:VersatiaRpg-Characters` and names the plugin in
`plugin.yml`, as for every [plugin built on Versatia](../index.md#working-with-a-plugin).

## Data of your own per character {/* #data-per-character */}

A plugin that keeps something per character, a quest log or a wallet, keys it by `character.id`, never
by the player's UUID, which every character of the player shares:

```kotlin title="Wrong: every character of the player shares the quest log"
// error-next-line
quests[event.player.uniqueId] = QuestLog()
```

```kotlin title="Right"
// fix-next-line
quests[characters[event.player]?.id ?: return] = QuestLog()
```

The events tell when that data comes and goes: `CharacterSelectedEvent` when a character starts being
played (at a join too), `CharacterDeselectedEvent` when the player leaves it for another one, and
`CharacterDeletedEvent` when an admin deletes it, which is when your rows of that `character.id` go.
Each plugin keeps such data in its own database, so the rows are never deleted by a foreign key.

## Skins {/* #skins */}

A player wears the skin the server's `skins.yml` gives the look of their character, named after its
class, or the look `none` while they play no character; their rank picks the look's skin. A plugin of
yours may give players another look in `CharacterSkinChangeEvent`, and after something its choice
depends on changed, it calls `characters.refreshSkin(player)` for each player concerned:

```kotlin
class WinterLooks(private val characters: Characters) : Listener {
    private var winter = false

    fun start() {
        winter = true
        VersatiaEngine.onlinePlayers.forEach(characters::refreshSkin)
    }

    @EventHandler
    fun onSkin(event: CharacterSkinChangeEvent) {
        if (winter) event.look += "-winter"
    }
}
```

The server then gives the looks `warrior-winter` and the others in its `skins.yml`; say on your
plugin's page which looks it names, since a look the file lacks leaves the player their own skin.

## Events {/* #events */}

| Event | When | A listener can |
|---|---|---|
| `CharacterCreateEvent` | before a character is created in a free slot | deny it, with a reason the player reads |
| `CharacterSelectEvent` | before a player starts playing a character | deny it, with a reason the player reads |
| `CharacterCreatedEvent` | after a character was created | hand out a starter kit |
| `CharacterSelectedEvent` | after a player started playing a character, at a join too | apply its data of that character |
| `CharacterDeselectedEvent` | after a player stopped playing a character without leaving | put away its data of that character |
| `CharacterDeletedEvent` | after an admin deleted a character | delete its data of that character |
| `CharacterSkinChangeEvent` | before a player takes the skin of their look | name another look, or cancel it to keep the skin they have |
| `LobbyEnteredEvent` | after a player came to play no character, at a join too | give what a player in the lobby has, until `CharacterSelectedEvent` |
| `CharacterSlotShowEvent` | before a player in the lobby is shown the mannequin of a slot | name another look, change its text, or cancel it to hide the slot |

A denied event takes a whole sentence from the denying plugin's messages, like the events of
[VersatiaTrade](../trade.md#stopping-a-trade):

```kotlin
class CharacterRules(private val combat: CombatTags, private val messages: Messages) : Listener {
    @EventHandler
    fun onSelect(event: CharacterSelectEvent) {
        if (combat.isTagged(event.player)) event.deny(messages["combat.no-switch"].get())
    }
}
```

A new character fires `CharacterCreateEvent`, `CharacterSelectEvent`, then, once the change is saved,
`CharacterDeselectedEvent` for the character left, `CharacterCreatedEvent` and `CharacterSelectedEvent`.
Leaving the server fires none of them: read `characters[player]` in your own `PlayerQuitEvent` handler,
which runs before the session ends. Every event, with its properties, is in the repository's
[docs/events.md](https://github.com/VersatiaFramework/VersatiaRpg/blob/master/docs/events.md).

## Corner cases {/* #corner-cases */}

- **The change completes a moment later**: `play` checks and fires the events at once, and the switch
  happens once it is saved.
- **A starter kit of your own** goes in `CharacterCreatedEvent`, which comes after the server's start
  of the class.
- **A character of a class the server no longer lists** stays in `all(player)`, but nobody can play it.
- **In combat mode**, with VersatiaRpg-Combat on the server, `CharacterSelectEvent` comes already
  denied.
- **With `resume-last-character: false`** on the server, a player joins playing no character, so no
  `CharacterSelectedEvent` comes at the join.
