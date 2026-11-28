---
title: VersatiaRpg-Characters
counterpart: /experimental/plugins/rpg/characters
description: Installing VersatiaRpg-Characters, the classes that give every player a character slot each, the start of new characters, the lobby, their skins, its messages, commands and permissions, and where character data is kept.
---

# VersatiaRpg-Characters

VersatiaRpg-Characters gives every player a character slot per class: a slot is free until the
player first plays that class, and each character has its own place, inventories, health, food,
effects and experience bar. Players switch characters with `/character`.

## Installing {/* #installing */}

Put `VersatiaRpg-Characters.jar` into `plugins/` and start the server:

| Plugin | Dependency | Needed for |
|---|---|---|
| VersatiaCore | required | everything: VersatiaRpg-Characters runs on it |
| VersatiaModule-Database | required | the characters' data ([Character data](#character-data)) |
| CommandAPI | optional | `/character` and `/characters`; without it players choose no character themselves |
| VersatiaRpg-Combat | optional | with it, nobody changes or creates a character in combat mode |

A player who never created a character plays as on any server, in the lobby if you set one
([The lobby](#the-lobby)) and in the skin of the look `none` if you give one ([Skins](#skins)); nothing
else changes for them until they create one, which starts with what you give it
([The start of a new character](#the-start-of-a-new-character)).

## Classes {/* #classes */}

```yaml title="plugins/VersatiaRpg-Characters/config.yml"
classes: [warrior, mage, archer]
```

`classes` lists the class ids, one character slot each, in the order players see them: lower-case
letters, digits, `_` and `-`, at least one, none twice, and never `none`, the look of a player with no
character ([Skins](#skins)). Removing a class keeps its characters, which nobody can play until it is
back. `/versatia reload characters` applies a change.

## The start of a new character {/* #the-start-of-a-new-character */}

A new character starts with full health and food, an empty ender chest, at experience level 1, and with
three parts you choose, for every class and, part by part, for one class:

| Part | What it is | Without it anywhere |
|---|---|---|
| `location` | where the character starts | the spawn of the first world |
| `inventory` | the items it carries, armour and off hand included | nothing |
| `effects` | its potion effects | none |

Each part comes from the class's own start, else from the start of every class, else from the last
column: a class with an inventory of its own gets that inventory whole, nothing of the shared one. A
player's first character starts the same way: nothing they carried before comes along.

You set a part from yourself, in game: stand where characters should start, carry what they should
carry, have the effects they should have, then run the command; without a class it is the part of every
class:

| Command | Does |
|---|---|
| `/characters start` | shows the start of every class and the parts each class has of its own |
| `/characters start location set [class]` | characters start where you stand |
| `/characters start inventory set [class]` | characters start with what you carry |
| `/characters start effects set [class]` | characters start with the effects you have |
| `/characters start <location\|inventory\|effects> clear [class]` | removes the part: the class takes that of every class, every class vanilla's |

The commands write `plugins/VersatiaRpg-Characters/starts.yml`, where the parts are kept as Bukkit
writes locations, items and effects:

```yaml title="plugins/VersatiaRpg-Characters/starts.yml"
every-class:
  location:
    ==: org.bukkit.Location
    world_key: minecraft:overworld
    x: 0.5
    y: 64.0
    z: 0.5
    pitch: 0.0
    yaw: 0.0
classes:
  mage:
    effects:
    - ==: PotionEffect
      effect: minecraft:speed
      duration: 600
      amplifier: 0
      ambient: false
      has-particles: true
      has-icon: true
```

You may edit the file by hand and apply it with `/versatia reload characters`; a class it names that
`config.yml` does not list fails the start or the reload, naming it.

## The lobby {/* #the-lobby */}

A player who plays no character joins in the lobby: a new account, or a player whose character was
deleted. The lobby has two places, both optional: one for players without characters, new accounts
above all, and one for everyone else, which also takes the new accounts while theirs is not set.
Without a place, players join where vanilla puts them.

| Command | Does |
|---|---|
| `/characters lobby` | shows both places |
| `/characters lobby set` | the lobby is where you stand |
| `/characters lobby set new-accounts` | the lobby of new accounts is where you stand |
| `/characters lobby clear [new-accounts]` | removes the place |

The commands write `plugins/VersatiaRpg-Characters/lobby.yml`, keys `location` and `new-accounts`, as
Bukkit writes locations; `/versatia reload characters` reads a hand edit.

By default a player who left playing a character plays it on when they join. To have every player join
in the lobby and choose a character with `/character` each time, set:

```yaml title="plugins/VersatiaRpg-Characters/config.yml"
resume-last-character: false
```

The character they left is then put away as they join, as at a change of character, and they are in the
lobby with nothing.

### The selection screen {/* #the-selection-screen */}

In the lobby, a player chooses a character on the selection screen: a mannequin of each of their slots,
which they alone see. A character's mannequin wears its skin and armour, with its level and play time
above; a free slot's wears the grey skin of its class. A click on a mannequin plays that character, or
creates it in a free slot. Players in the lobby do not see each other. Stand where a class's mannequin
goes, facing where it looks, and run:

| Command | Does |
|---|---|
| `/characters lobby mannequin set <class>` | the mannequin of the class stands where you stand |
| `/characters lobby mannequin clear <class>` | removes it |

The places go into `lobby.yml` under `mannequins`; without any, there is no selection screen and players
choose with `/character`. The text above a mannequin is `selection.character` or `selection.free` of the
[messages](#messages), and the grey skins are under `free-slots` in `skins.yml` ([Skins](#skins)).

## Skins {/* #skins */}

A character wears the look named after its class, and a player who plays no character the look `none`.
A look has a skin per rank, and a skin is the texture value and signature that
[mineskin.org](https://mineskin.org/) gives for a skin's PNG file: upload it, then copy its Texture
Value and Texture Signature. A player whose look has no skin wears their own.

```yaml title="plugins/VersatiaRpg-Characters/skins.yml"
ranks:
  noble: group.noble
  premium: group.premium
looks:
  none:
    default:
      value: "ewogICJ0aW1lc3RhbXAiIDogMTcw..."
      signature: "QDBxAm9vZ0..."
  warrior:
    default:
      value: "ewogICJ0aW1lc3RhbXAiIDogMTcz..."
      signature: "kR3fT0aX9w..."
    noble:
      value: "ewogICJ0aW1lc3RhbXAiIDogMTc0..."
      signature: "Pq8LzV1nE2..."
```

A free slot's mannequin on [the selection screen](#the-selection-screen) takes its skin from a section
`free-slots` of the same form as `looks`, a grey one by custom.

`ranks` are tried from the top: a player holds the first rank whose permission they are given, such
as `group.noble` for the members of the LuckPerms group `noble`, or the rank `default`. Being op is not
enough. A rank without a skin of its own wears the look's `default` skin, so a premium warrior above
wears the default one. Another plugin may give players another look, a holiday's for example; its page
names the looks, which go under `looks` like a class's.

The skin goes on when a player joins or changes character. After a player's rank changes,
`/characters skin refresh <player>` puts it on at once, on their mannequins in the lobby too, and says
which look and rank they wear;
`/versatia reload characters` applies an edited `skins.yml` to everyone online.

## Messages {/* #messages */}

`plugins/VersatiaRpg-Characters/messages/characters.yml` holds every text of the plugin;
[Editing messages](../../messages.md) explains the format, and the messages are yours to word and
translate. Each class needs its name under `class:`; a class of `config.yml` without one fails the
start or the reload, naming it:

```yaml title="plugins/VersatiaRpg-Characters/messages/characters.yml"
class:
  warrior: "Warrior"
  mage: "Mage"
  archer: "Archer"
```

The sentences players read when another plugin stops a character from being created or played come
from that plugin; `play.create-denied` and `play.select-denied` are used when it gives none.

## Commands and permissions {/* #commands-and-permissions */}

| Command | Permission | Default | Does |
|---|---|---|---|
| `/character` | `versatia.characters.command.character` | everyone | lists the player's slots, with buttons to play or create |
| `/character play <class>` | the same | everyone | plays the character of the class, creating it in its free slot |
| `/characters <player>` | `versatia.characters.command.characters` | operators | lists a player's characters, online or not |
| `/characters delete <player> <class>` | the same | operators | deletes a character |
| `/characters start ...` | the same | operators | shows and sets the start of new characters ([The start of a new character](#the-start-of-a-new-character)) |
| `/characters lobby ...` | the same | operators | shows and sets the lobby and the mannequins of the selection screen ([The lobby](#the-lobby)) |
| `/characters skin refresh <player>` | the same | operators | puts the player's skin on again, and their mannequins' in the lobby, and says which look and rank they wear ([Skins](#skins)) |

## Character data {/* #character-data */}

The characters are kept by the [Database module](../../database/index.md), in the table `characters`
under the plugin's prefix (`characters_characters` by default), in a SQLite file in
`plugins/VersatiaRpg-Characters/` unless its `database.yml` names another database. A player's
characters are loaded before they join; when the database cannot be read, the login is refused, so
nobody plays on missing data.

Every character's state is in the database, the one a player plays included, and so is which one
they play: a player may join any server of a network sharing the database, and the player file is
never read for characters. The state of the character played is written with every autosave of the
database (`stores.autosave` of `database.yml`, 5 minutes by default), when the player leaves and at
every change of character, so a crash loses at most what changed since the last autosave.

## Corner cases {/* #corner-cases */}

- **Deleting a character its player plays** sends them, with nothing, to the lobby, else to the start
  location of every class. Deleted while they are offline, the same happens when they join.
- **A world removed** since a character was left sends it to its class's start location.
- **Installing on a running server**: what players carry before their first character is lost.
