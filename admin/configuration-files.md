---
counterpart: /docs/configuration
---

# Configuration files

A plugin built on Versatia keeps its files in its own folder, `plugins/<Name>/`, where `<Name>` is
the name in its `plugin.yml`. This page is about editing them: where they come from, how values
are written and what happens to a mistake.

## Where the files come from {/* #where-the-files-come-from */}

At its first start a plugin copies its default files into `plugins/<Name>/`:

```text
plugins/Shop/
├── config.yml
├── limits.yml
└── messages/
    └── shop.yml
```

- **Your edits are kept.** A file that already exists is never overwritten, not by a restart and
  not by an update of the plugin.
- **A newer default does not reach your copy.** When an update of the plugin changes a default,
  your file keeps what it had; compare it with the plugin's changelog.
- **A deleted file comes back.** Delete it and run `/versatia reload <name>` (or restart) to get
  the default copy back.

## Applying a change {/* #applying-a-change */}

Edit the file and run [`/versatia reload <name>`](commands.md#versatia-reload). The plugin reads
all its files again, and the change takes effect without a restart. What a plugin decides only at
start (its commands, the optional plugins it found) needs a restart; see
[`/versatia reload`](commands.md#versatia-reload).

## Writing values {/* #writing-values */}

Every value is checked against what the plugin expects. A value of the wrong kind is never
converted silently, it is reported:

| The plugin expects    | Write                                          | Rejected                          |
|-----------------------|------------------------------------------------|-----------------------------------|
| yes or no             | `true`, `false`                                |                                   |
| a whole number        | `20`, `-5`                                     | `20.5`; a negative number where only positive ones are allowed; a number too big |
| a number with a fraction | `0.75`                                      |                                   |
| a percentage          | `12.5%`                                        | `12.5`, `0.125`                   |
| a duration            | `30s`, `5m`, `1h 30m`, `500ms`, `2d`, `PT5M`   | `300` (no unit), `-5s`            |
| text                  | `Welcome`, and `'01234'` quoted when it would read as something else | an unquoted `01234`, `yes`, `1.10` |
| a name from a fixed list (a material, a day) | `DIAMOND_SWORD`, `monday` (any case) | a name that is not on the list |
| a list                | `[9, 12, 18]`, or one `- item` per line; `[]` for an empty one | a single value without brackets |
| a password, a token   | see [Secrets](#secrets)                        |                                   |

### Durations {/* #durations */}

A duration always carries its unit, so the file says what it means:

```yaml title="Wrong: plugins/Shop/config.yml"
auto-broadcast:
  # error-next-line
  period: 300
```

```yaml title="Right: plugins/Shop/config.yml"
auto-broadcast:
  # fix-next-line
  period: 5m          # also 300s, 1h 30m, 500ms, 2d or PT5M
```

The units are `d`, `h`, `m`, `s` and `ms`, combined with spaces (`1h 30m`). A bare number is
refused with `is not a duration such as "30s", "5m" or "1h 30m"`.

### Text that looks like something else {/* #quoting-text */}

YAML reads `01234` as a number, `yes` as `true` and `2024-01-01` as a date. Where the plugin
expects text, such a value is refused and the message asks for quotes:

```yaml title="Wrong: plugins/Shop/config.yml"
# error-next-line
voucher-code: 01234
```

```yaml title="Right: plugins/Shop/config.yml"
# fix-next-line
voucher-code: '01234'
```

## Secrets {/* #secrets */}

A password, a token or an API key does not have to be written in the file. Write where the secret
is instead:

```yaml title="plugins/Shop/config.yml"
discord:
  token: ${env:SHOP_DISCORD_TOKEN}                     # an environment variable of the server process
  # token: ${file:/run/secrets/shop_discord_token}     # or a file holding only the secret
  # token: ${pluginfile:discord-token.txt}             # or a file next to this one: plugins/Shop/discord-token.txt
  # token: 'mfa.3kX9...'                               # or the secret itself, quoted
```

| Written              | Read from                                                                          |
|----------------------|------------------------------------------------------------------------------------|
| `${env:NAME}`        | the environment variable `NAME`, set in the server's start script or container     |
| `${file:PATH}`       | a file holding only the secret; a relative path starts at the server folder (the one with `server.properties`), an absolute one (`/etc/minecraft/token.txt`, `C:/secrets/token.txt`) is used as it is |
| `${pluginfile:PATH}` | a file in the plugin's folder: `${pluginfile:api-key.txt}` in `plugins/Shop/config.yml` reads `plugins/Shop/api-key.txt` |
| `''`                 | nothing: the feature that needs the secret is switched off; shipped files hold this |

- **The secret never appears in a log.** Logs and messages show it as `****`, an empty one as `''`.
- **A rotated secret is picked up by a reload.** The references are read again at every
  `/versatia reload <name>`.
- **A missing variable or file is reported** with the key and the reference, never the secret:

  ```text
  Plugin Shop: com.example.DiscordBridge.token could not be read from config.yml: Value at "discord.token" uses ${env:SHOP_DISCORD_TOKEN}, which is not set; set that environment variable for the server, or write the value instead
  ```

- **A secret file is read whole**, as UTF-8, without the line breaks at its end. Make it readable
  only by the user the server runs as.
- **Docker and Kubernetes** hand secrets to a container as files under `/run/secrets/`, which is
  what `${file:...}` is for.

`${DB_PASSWORD}` without `env:` is an error that asks whether you meant `${env:DB_PASSWORD}`.

## Mistakes {/* #mistakes */}

A mistake never half-applies a file. The plugin reads every value first and changes nothing when
one of them is wrong:

| When                  | What happens                                                                     |
|-----------------------|----------------------------------------------------------------------------------|
| at `/versatia reload` | the reply names the file, the key and what is allowed; the plugin keeps every previous value |
| at start              | the same message is logged and the plugin stays disabled                         |

```text
Plugin Shop: com.example.Shop.tax could not be read from config.yml: No value present at "shop.tax"
Plugin Shop: com.example.Shop.tax could not be read from config.yml: Value at "shop.tax" is not a percent string such as "12.5%" (0-100): "8"
Plugin Shop: config.yml could not be read
```

The first line means a key is missing: put it back, with the value from the plugin's
documentation or from a fresh default copy. The third means the file is not valid YAML; the cause
below it gives the line and column. A tab used for indentation and a missing space after a colon
are the usual culprits. More messages are in [Troubleshooting](troubleshooting.md#configuration).

## Corner cases {/* #corner-cases */}

- **An absent key is not an empty list.** Write `hours: []`; leaving the key out is a missing
  value.
- **A single value where a list belongs** (`hours: 9`) is an error, not a list of one. Write
  `hours: [9]`.
- **A duration is never negative or infinite.** `0s` is the shortest one.
- **A secret containing `${`** cannot be written in the file itself; put it in a variable or a
  file, whose content is taken as written.
- **A plugin reads only from its own folder.** A file path that leads out of `plugins/<Name>/` is
  refused.
