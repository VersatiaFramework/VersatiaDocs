---
counterpart: /docs/reference/troubleshooting
---

# Troubleshooting

Messages a server log or `/versatia` may show, what they mean and what to do. A message about one
plugin affects only that plugin; the others keep running. When the fix is in the plugin's code,
the entry says so: send the full message to the plugin's author.

## At start-up {/* #at-start-up */}

### A plugin needs VersatiaCore {/* #needs-versatiacore */}

Paper refuses to load a plugin whose `depend:` lists a plugin that is missing, and names it.
Install [VersatiaCore](installation.md), and every [module](installation.md#modules) the message
names, then restart.

### `X was built for descriptor format A, but this VersatiaCore supports B` {/* #descriptor-format */}

The plugin and VersatiaCore come from different releases, and the plugin stays disabled. The
message says which side to update; see [Updating](installation.md#updating).

### `Skipped X: Y is not installed` {/* #skipped */}

Not an error. The plugin has a part that works only with `Y`, and `Y` was not there when the plugin
started. Install `Y` and restart to use that part; a reload does not change it. The variant
`Y is installed but was not enabled before X; list it under softdepend: in plugin.yml` is for the
plugin's author.

### `LinkageError` or `ClassCastException` naming a `kotlin` class {/* #linkage-error */}

The plugin carries its own copy of Kotlin, which only VersatiaCore may provide. The plugin's
author has to rebuild it; nothing on the server fixes it.

### `Plugin X: the friendly name "n" is already used by Y` {/* #friendly-name-taken */}

Two plugins claim the same short name, so the second stays disabled. Keep one of them, and tell
the authors.

### Any other `Plugin X: ...` at start {/* #other-start-errors */}

Messages about beans, descriptors or classes (`no bean provides`, `descriptor ... not found`,
`cannot be loaded`) point at the plugin's build: send them to its author. When the message is
`Plugin X: Y.f() failed at START`, the cause below it often names a file or a setting: check it
first.

## Configuration {/* #configuration */}

Each of these comes at start, when the plugin stays disabled, or at `/versatia reload`, when the
plugin keeps its previous values. See [Configuration files](configuration-files.md#mistakes).

### `Plugin X: Y.z could not be read from f.yml: ...` {/* #value-could-not-be-read */}

A value is missing or of the wrong kind; the rest of the message gives the key and what is
allowed. `No value present at "k"` means the key is missing: put it back.

### `Plugin X: f.yml could not be read` {/* #file-could-not-be-read */}

The file is not valid YAML. The cause below gives the line and column; look for a tab used for
indentation or a missing space after a colon.

### `Plugin X: f.yml is missing from the data folder; ...` {/* #file-missing */}

The file was deleted. Run `/versatia reload <name>` and the default copy comes back. When the
message says `the plugin JAR has no default copy`, the plugin's documentation tells you what the
file must contain.

### `... uses ${env:NAME}, which is not set; ...` {/* #secret-not-set */}

A [secret](configuration-files.md#secrets) names an environment variable the server process does
not have, or a file that does not exist. Set the variable in the server's start script and
restart, or fix the path and reload.

### Messages {/* #messages */}

`messages/f.yml is not valid YAML`, `is defined twice`, `has no message "k"` and
`cannot be shown` are explained in [Editing messages](messages.md#mistakes).

## At a reload {/* #at-a-reload */}

### `/versatia` is an unknown command {/* #unknown-command */}

CommandAPI 12.x is not installed. Drop its JAR into `plugins/` and restart. When the log shows
`/versatia could not be registered. The installed CommandAPI ... may not be compatible ...`,
install a 12.x release instead. See [Soft dependencies](installation.md#soft-dependencies).

### `X failed to reload: ...` {/* #failed-to-reload */}

The reply names the plugin and the cause; the plugin keeps running with its previous state. A
configuration mistake is one warning in the log; anything else is an error with a stack trace for
the plugin's author.

### `Y failed to reload after X, whose beans it uses: ...` {/* #cascade-failed */}

`X` reloaded, and `Y`, which uses values of `X`, failed in the reload that follows. `X` keeps its
new values and `Y` its previous state. Fix the cause and run `/versatia reload Y`.

### `Plugin X is not running`, `... is still starting`, `... is already reloading` {/* #cannot-reload-now */}

The plugin is disabled or failed to start (look higher in the log for why), has not finished
starting, or is in the middle of a reload. Wait, or fix the start error and restart.

## Debug mode {/* #debug-mode */}

When a plugin does not do what its documentation says, switch on VersatiaCore's debug log:

```yaml title="plugins/VersatiaCore/config.yml"
debug: true
```

Run `/versatia reload VersatiaCore`, then reload or restart the plugin. Every step of each
plugin's start, reload and stop is logged:

```text
[debug] Shop START: descriptor format 1.6, 11 elements, 9 for this event
[debug] Shop START: skipped VaultBridge: @ConditionalOnPlugin(Vault) is not met
[debug] Shop START: created 2 beans: "plugin" (com.example.shop.ShopPlugin), "counter" (com.example.shop.Counter)
[debug] Economy RELOAD: set 3 values, config.yml: base, rate, tax
[debug] Economy RELOAD: goes on to Shop, holding beans that follow its reloads
```

Values are logged by key, never with what the file holds, so the log is safe to share with a
plugin's author. Switch it off again the same way. [`/versatia info <plugin>`](commands.md#versatia-info)
shows the same state at a glance.
