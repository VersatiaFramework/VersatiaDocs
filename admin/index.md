---
title: Server admin guide
slug: /
---

# Server admin guide

This part of the documentation is for the **server admin**: the person who installs plugins built
on Versatia, edits their files in `plugins/` and runs their commands, without touching their code.
Writing such a plugin is covered by the [developer documentation](/docs).

| You want to                                         | Read                                                     |
|-----------------------------------------------------|----------------------------------------------------------|
| put Versatia and its plugins on a server            | [Installation](installation.md)                          |
| edit a plugin's files, hand over a password                 | [Configuration files](configuration-files.md) |
| apply an edited file without a restart, see what a plugin has | [Commands and permissions](commands.md)        |
| reword, recolour or translate what a plugin says              | [Editing messages](messages.md)                |
| understand a message in the log                               | [Troubleshooting](troubleshooting.md)          |

## What Versatia is on a server {/* #what-versatia-is */}

Versatia is one plugin, **VersatiaCore**, that other plugins depend on. A plugin built on Versatia
lists `VersatiaCore` under `depend:` in its `plugin.yml`, so Paper refuses to start it without
VersatiaCore. Beyond that it behaves like any plugin: its JAR goes into `plugins/` and its files
into `plugins/<Name>/`.

What Versatia gives you on every such plugin:

- **One way to reload.** `/versatia reload <plugin>` re-reads the plugin's files without a
  restart, and a file with a mistake leaves the previous values in place
  ([Commands](commands.md#versatia-reload)).
- **One permission pattern.** Every command of every Versatia plugin is guarded by
  `versatia.<plugin>.command.<command>` ([Permissions](commands.md#permissions)).
- **Clear errors.** A wrong value names the file, the key and what is allowed, instead of a stack
  trace.
