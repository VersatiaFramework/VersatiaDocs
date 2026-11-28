---
title: VersatiaRpg
sidebar_label: Overview
pagination_label: VersatiaRpg
counterpart: /experimental/plugins/rpg
description: The plugins of the VersatiaRpg engine, what each gives a server, and what each needs to run.
---

# VersatiaRpg

VersatiaRpg is an RPG engine made of small plugins, one idea each, which a server installs as it needs
them. None depends on another, and none imposes rules of a particular server: those come from the
server's own plugin.

| Plugin | What it gives a server | Needs |
|---|---|---|
| [VersatiaRpg-Characters](characters.md) | a character slot per class for every player, each character with its own place, inventories, health and experience bar | VersatiaCore, VersatiaModule-Database |
| [VersatiaRpg-Combat](combat.md) | combat mode, started by a hit, its timer reset by every further one, with a pace of its own for health and food regeneration | VersatiaCore |
| [VersatiaRpg-Stats](stats.md) | the stats of players and mobs added up from the parts other plugins give, vanilla attributes included, and the server's own stats | VersatiaCore |
| [VersatiaRpg-Items](items.md) | the server's own items, with the stats they give, the level, class or stats they ask for, and their lore | VersatiaCore |
| [VersatiaRpg-Skills](skills.md) | a skill bar on hotbar slots 1 to 6 for the skills other plugins add, used with their keys | VersatiaCore, VersatiaModule-Database |

Each plugin is a JAR of its own, such as `VersatiaRpg-Characters.jar`, which goes
into `plugins/` like any plugin; its page says how to set it up.
