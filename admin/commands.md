---
counterpart: /docs/commands
description: VersatiaCore's /versatia command, its reload and info subcommands, and the permissions of every plugin's commands.
---

# Commands and permissions

VersatiaCore adds one command, `/versatia`, with two subcommands. Like every command of a plugin
built on Versatia it exists only while [CommandAPI](installation.md#soft-dependencies) 12.x is
installed.

| Command                   | Permission                     | Default   |
|---------------------------|--------------------------------|-----------|
| `/versatia reload [plugin]` | `versatia.core.command.reload` | operators |
| `/versatia info [plugin]`   | `versatia.core.command.info`   | operators |

Replies take the server's [styles](messages.md#styles), like every plugin's messages: a reply
opens with its tone (`neutral`, `positive`, `warning`, `negative`), labels up to their colon are
`label`, a plugin's name heading its lines is `heading`, and the values filled in (plugin names,
versions, counts) are `accent`. Change those in `plugins/VersatiaCore/styles.yml` and the replies
change with them.

## `/versatia reload` {/* #versatia-reload */}

| Command                   | Effect                                                                                  |
|---------------------------|-----------------------------------------------------------------------------------------|
| `/versatia reload`        | reloads every running Versatia plugin, in the order in which they started               |
| `/versatia reload <name>` | reloads the plugin registered under that name; an unknown name lists the running ones  |

`<name>` is the plugin's short name (`shop` for a plugin called `ShopPlugin`), which tab completion
offers and [`/versatia info`](#versatia-info) lists first on every line.

A reload re-reads the plugin's files in `plugins/<Name>/`:

- **A file you deleted comes back** with its default content.
- **A file with a mistake changes nothing**: the plugin keeps every previous value, and the reply
  names the file, the key and what is allowed. Fix the file and reload again.
- **Plugins that use the reloaded one follow.** When `shop` uses prices from `economy`,
  `/versatia reload economy` reloads `shop` right after it, so `shop` sees the new prices:

  ```text
  Reloaded economy; then shop, which uses beans of economy.
  ```

- **The styles are VersatiaCore's.** `plugins/VersatiaCore/styles.yml`, the
  [styles](messages.md#styles) every plugin's messages use, is read again by `/versatia reload`
  without a name, before the plugins check their messages against it.
- **What a plugin decides at start needs a restart**: its commands, and the optional plugins it
  found next to it (a plugin that integrates with Vault only when Vault is installed checks that once).

## `/versatia info` {/* #versatia-info */}

`/versatia info` changes nothing; it shows what the runtime keeps. Without an argument it lists
the running Versatia plugins with their short name, version and descriptor format, and their
`plugin.yml` name when it differs from the short name:

```text
VersatiaCore 0.0.1 (descriptor format 1.0)
economy 1.2.0 (Economy, descriptor format 1.0)
shop 0.4.0 (Shop, descriptor format 1.0)
```

With a plugin's short name it adds what that plugin consists of: its beans (the objects the plugin
is built from) grouped by scope, the beans other plugins use, the plugins its reloads cascade to
and the files it reads values from:

```text
economy 1.2.0 (Economy, descriptor format 1.0)
Beans (3):
  local (1):
    "plugin" com.example.economy.EconomyPlugin
  exposed singleton (1):
    "clock" com.example.economy.Clock
  exposed prototype (1):
    "priceList" com.example.economy.PriceList
Exposed beans used by others: "priceList" by shop
Reloads cascade to: shop
@Value files: config.yml
```

`@Value files` are the files in `plugins/Economy/` that `/versatia reload economy` re-reads.

## Permissions {/* #permissions */}

Every command of every plugin built on Versatia is guarded by a permission of one pattern:

```text
versatia.<plugin>.command.<command>
```

`<plugin>` is the plugin's short name, `<command>` the command or subcommand:

| Plugin                         | Command              | Permission                     |
|--------------------------------|----------------------|--------------------------------|
| VersatiaCore                   | `/versatia reload`   | `versatia.core.command.reload` |
| ShopPlugin, short name `shop`  | `/shop price <item>` | `versatia.shop.command.price`  |

Grant them with your permission plugin, for example with LuckPerms:

```text
/lp group moderator permission set versatia.core.command.info true
/lp group default permission set versatia.shop.command.price true
```
