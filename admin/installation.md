---
counterpart: /docs/getting-started/installation
---

# Installation

1. Run Paper **1.21.4** on Java **21** or newer.
2. Drop `VersatiaCore-0.0.1.jar` into the `plugins/` directory.
3. Add the [modules](#modules) and the [optional plugins](#soft-dependencies) the plugins on your
   server need, then the plugins themselves.
4. Start the server.

At its first start Paper downloads the Kotlin runtime VersatiaCore lists under `libraries:` into
`libraries/`; that needs internet access once. Plugins built on Versatia never download their own
copy.

:::info[Where do the JARs come from?]

Versatia is not published yet. VersatiaCore and the modules are distributed as plugin JARs by the
Versatia team; a plugin built on Versatia comes from its own author.

:::

## VersatiaCore's configuration {/* #versatiacore-configuration */}

At its first start VersatiaCore writes `plugins/VersatiaCore/config.yml`:

```yaml title="plugins/VersatiaCore/config.yml"
# Logs every step of each Versatia plugin's start, reload and stop at INFO; for diagnosing a plugin, off otherwise
debug: false
```

| Key      | Values           | Effect                                                                                     |
|----------|------------------|--------------------------------------------------------------------------------------------|
| `debug`  | `false` / `true` | `true` logs, for each Versatia plugin, what the runtime does at its start, reload and stop; lines start with `[debug]` |

The file is read at start and at every reload of VersatiaCore, so `/versatia reload VersatiaCore`
switches it without a restart; a deleted file comes back at that reload.

## Soft dependencies {/* #soft-dependencies */}

VersatiaCore works on its own. Some of its features appear only when another plugin is installed
next to it:

| Plugin                                   | Version | What it enables                                          |
|------------------------------------------|---------|----------------------------------------------------------|
| [CommandAPI](https://commandapi.dev/)    | 12.x    | the [`/versatia` command](commands.md), and the commands of plugins built on Versatia |

Without CommandAPI every plugin still runs; only the commands are missing. A CommandAPI release
VersatiaCore is not compatible with costs only the commands, and VersatiaCore logs one warning:

```text
/versatia could not be registered. The installed CommandAPI 13.0.0 may not be compatible with the
12.x release VersatiaCore is built against; everything except the command keeps working.
```

## Optional plugins {/* #optional-plugins */}

A plugin may have parts that work only when another plugin is installed, such as payments through
Vault. Whether that plugin is there is decided when the plugin starts:

- **Install or remove the other plugin, then restart.** A reload does not pick up the change.
- **A `Skipped` line is information**, not an error:

  ```text
  Skipped VaultBridge: Vault is not installed
  ```

## Modules {/* #modules */}

Features beyond the runtime come as modules: one plugin JAR each, installed next to VersatiaCore
when a plugin on the server needs one. A plugin that needs a module lists it under `depend:`, so
Paper names the missing module at start.

| Module JAR                          | Plugin name               | Needs        |
|-------------------------------------|---------------------------|--------------|
| `VersatiaModule-Messages-0.0.1.jar` | `VersatiaModule-Messages` | VersatiaCore |
| `VersatiaModule-Database-0.0.1.jar` | `VersatiaModule-Database` | VersatiaCore; downloads its libraries at the first start ([Database module](database/index.md)) |

## Updating {/* #updating */}

Replace VersatiaCore, the modules and the plugins built on Versatia together, with the versions
from one release. A plugin built for another VersatiaCore stays disabled, with a message naming
both versions and what to update:

```text
Shop was built for descriptor format 1.7, but this VersatiaCore supports 1.6. Update VersatiaCore, or
rebuild the plugin against the VersatiaAPI matching it. The plugin stays disabled.
```

`/versatia info` shows the descriptor format of every running plugin
([Commands](commands.md#versatia-info)).
