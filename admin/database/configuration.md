---
title: Database configuration
counterpart: /docs/modules/database/configuration
---
# Database configuration


Three files decide where the data of plugins using the Database module lives and how it is reached:

| File                                              | For                                              |
|---------------------------------------------------|--------------------------------------------------|
| `plugins/<Plugin>/database.yml`                   | one plugin: where its data lives, its pool, timings and table prefix |
| `plugins/VersatiaModule-Database/connections.yml` | connections several plugins share, and the connection of plugins installed later |
| `plugins/VersatiaModule-Database/config.yml`      | defaults for every plugin whose `database.yml` leaves a key out |

None of them is required: without them every plugin keeps its data in an SQLite file in its own
folder. The SQL of a plugin is in its JAR and is never edited on the server.

`connections.yml`, `config.yml`, SSL and the connection pool are on [Connections and
defaults](connections.md).

## database.yml {/* #database-yml */}

`plugins/<Plugin>/database.yml` says where one plugin's data lives. It is optional: without it the
plugin uses the [`default-connection`](connections.md#connectionsyml) of the module, or else SQLite. At the first
open the module writes the file with the keys that decide where the data is and the prefix it used,
and nothing else: a later change of `default-connection` or of the plugin's friendly name never
moves a plugin that already has data, while every other setting keeps following the module's
[`defaults`](connections.md#configyml), the connection and the engine. For a plugin named `Shop` on SQLite it reads:

```yaml title="plugins/Shop/database.yml"
# database.yml - where Shop keeps its data; written at the first start, read at every start.
# The keys below decide where the data is: change them only together with import-from, or Shop
# starts on an empty database; they apply after a restart. Any other key of the documentation may be
# added here for Shop alone and applies on /versatia reload shop; what is left out comes from
# defaults: in plugins/VersatiaModule-Database/config.yml, from the connection, or from the engine.
# Every key: https://versatia.dev/admin/database/configuration#every-key
engine: sqlite
file: database.db
table-prefix: shop_
```

A plugin that started on a shared connection (`default-connection: main`) gets `connection: main`
in place of `engine` and `file`.

Edit these keys to move the plugin; they apply after a restart, and the data stays behind unless
`import-from` copies it ([Changing the database](data.md#changing-the-database)). Add any key of
[Every key](#every-key) to give this plugin alone its own value, `main-thread: warn` for one; what
the file leaves out keeps following `defaults:`, the connection and the engine, also when they
change. Leave `table-prefix` as written once the plugin has data: it names the tables the data is
in.

### Every key {/* #every-key */}

Every key is optional. **Applies** says when a change takes effect: `reload` at
`/versatia reload <plugin>` (see [Reloading](operations.md#reloading)), `restart` only at the next
start of the server, with a warning at each reload until then.

| Key                       | Type                 | Default                                 | What it does                                          | Applies |
|---------------------------|----------------------|-----------------------------------------|-------------------------------------------------------|---------|
| `connection`              | name                 | none                                    | uses a [shared connection](connections.md#connectionsyml) of `connections.yml`; the keys from `engine` to `pool` then belong to it and are an error here | restart |
| `engine`                  | `sqlite`, `h2`, `mysql`, `mariadb`, `postgresql`, any case | `sqlite`          | one of the [engines](/docs/modules/database/configuration#engines)                        | restart |
| `file`                    | path                 | `database.db`                           | `sqlite` and `h2` only: the file, relative to the plugin's folder; H2 drops a `.db` or `.mv.db` ending and stores `<name>.mv.db` | restart |
| `host`                    | text, [references](#secrets-in-the-file) | `localhost`         | server engines only: the host name or address (an IPv6 address without brackets) | restart |
| `port`                    | 1 to 65535           | 3306 (`mysql`, `mariadb`), 5432 (`postgresql`) | server engines only                            | restart |
| `database`                | text, [references](#secrets-in-the-file) | `minecraft`         | server engines only: the database on the server, which must exist | restart |
| `schema`                  | text                 | `''`, the user's search path            | `postgresql` only, ignored elsewhere: the schema the tables live in | restart |
| `username`                | text, [references](#secrets-in-the-file) | `minecraft`         | server engines only; never shown in logs, errors or the status | reload |
| `password`                | text, [references](#secrets-in-the-file) | `''`                | server engines only; never shown                      | reload |
| `ssl`                     | `disabled`, `preferred`, `required`, `verify` | `preferred`    | TLS to the server, [mapped per driver](connections.md#ssl)          | reload |
| `properties`              | map of text, [references](#secrets-in-the-file) in text values | `{}` | extra driver properties, applied after the module's tuning and winning over it | reload |
| `table-prefix`            | `a-z`, `0-9` and `_` | see [The table prefix](#the-table-prefix) | what `{prefix}` expands to and builders and stores add | restart |
| `pool.size`               | 1 or more            | [per engine](#defaults-per-engine)      | the most connections the plugin's pool opens; SQLite is always 1, with a warning for more | reload |
| `pool.min-idle`           | 0 or more            | 1                                       | the connections kept open while the plugin is idle, at most `pool.size`; more open when calls wait for one, up to `pool.size`, and close after 10 idle minutes | reload |
| `pool.connection-timeout` | duration, at least 250ms (less, `0` included, is 250ms) | [per engine](#defaults-per-engine) | how long a call waits for a free connection, and a connect for the server | reload |
| `pool.max-lifetime`       | duration, `0` = unlimited | [per engine](#defaults-per-engine) | when a connection is replaced; [lowered](connections.md#pool-and-timeouts) below the server's idle timeout | reload |
| `pool.leak-warning`       | duration, `0` = off  | `0`                                     | from 2 s up, logs the stack of whoever held a connection that long | reload |
| `threads`                 | 1 or more            | [per engine](#defaults-per-engine); on a shared connection its `threads-per-plugin` | the plugin's [database threads](/docs/modules/database/background#background-work); more than `pool.size` is lowered to it, with a warning | reload |
| `queue-limit`             | 1 or more            | 5000                                    | the [background tasks](/docs/modules/database/background#limits) that may wait for a thread; past it new ones fail at once | reload |
| `query-timeout`           | duration, `0` = the driver's limit | 30s                       | the time limit of each statement; on server engines a silent connection is broken after twice this, at least 2 minutes ([Pool and timeouts](connections.md#pool-and-timeouts)) | reload |
| `slow-query`              | duration, `0` = off  | 250ms                                   | statements slower than this are logged                | reload |
| `main-thread`             | `throw`, `warn`, `allow` | `throw`                             | a blocking call on the [server thread](/docs/modules/database/background#the-server-thread) outside start, reload and stop | reload |
| `log-statements`          | `true`, `false`      | `false`                                 | logs every statement with its values and time         | reload |
| `shutdown-timeout`        | duration             | 20s                                     | how long running work gets at [shutdown](/docs/modules/database/operations#shutdown) before the final save | reload |
| `migrations.backups`      | 0 or more            | 3                                       | the [backups](data.md#backups) of an SQLite or H2 file kept; `0` takes none | reload |
| `migrations.lock-timeout` | duration             | 60s                                     | the wait for [another server migrating](data.md#the-migration-lock) | reload |
| `migrations.future-versions` | `warn`, `fail`    | `warn`                                  | applied versions newer than the JAR: [log and start, or refuse](data.md#plugin-updates) | reload |
| `stores.autosave`         | duration, `0` = off  | 5m                                      | how often [stores](/docs/modules/database/player-stores#saving) write their changes; `0` writes only on quit, evict and stop | reload |
| `stores.idle-expiry`      | duration, `0` = never | 10m                                    | when values nobody holds (keyed stores, offline players) are saved and forgotten | reload |
| `stores.login-timeout`    | duration             | 10s                                     | how long a login waits for its data before it is refused | reload |
| `stores.lock-timeout`     | duration             | 30s                                     | how long a save, load or store transaction [waits for a key](/docs/modules/database/stores#lock-waits) another one holds | reload |
| `stores.save-failure.action` | `kick`, `warn`, `shutdown` | `kick`                         | what follows a value that has failed to save for `stores.save-failure.after`: [kick its player, log, or stop the server](operations.md#player-data) | reload |
| `stores.save-failure.after` | duration           | 1m                                      | how long a value may fail to save before `stores.save-failure.action` applies; failed values are retried every 15 s | reload |
| `stores.save-failure.keep-in-file` | `true`, `false` | `true`                                | values the final save at a stop cannot write are [kept in a file](/docs/modules/database/player-stores#unsaved-values-at-a-stop) and written at the next start | reload |
| `messages.load-failed`    | MiniMessage          | `<red>Your data could not be loaded. Please try again in a moment.` | the text of a login refused because its data could not be loaded | reload |
| `messages.closing`        | MiniMessage          | `<red>The server is restarting. Please try again in a moment.` | the text of a login refused while the database closes | reload |
| `messages.save-failed`    | MiniMessage          | `<red>Your data could not be saved, so you cannot play right now. Please try again in a few minutes.` | the text of a player kicked, or a login refused, under `stores.save-failure.action: kick` | reload |
| `import-from`             | section              | none                                    | a database to [copy the tables from](data.md#changing-the-database) at the next start: `connection`, or the keys `engine` (required) to `properties` without `pool`; plus `table-prefix`, the tables' prefix there when it differs | restart |

Each of the keys from `queue-limit` to `messages.save-failed` (all soft keys but `threads`) comes from
the plugin's `database.yml` when it is there, else from the module's [`defaults`](connections.md#configyml), else
from the default above. The file the module writes at the first open sets only the target and the
prefix, so `pool` and `threads` follow the engine, or a shared connection's `pool` and
`threads-per-plugin`, until the plugin's `database.yml` sets them.

A duration is a number with a unit, `ms`, `s`, `m`, `h` or `d`, alone or combined (`1h 30m`), or
ISO-8601 (`PT5M`); `0` alone is zero.

#### Secrets in the file {/* #secrets-in-the-file */}

`host`, `database`, `username`, `password` and the text values of `properties` may name where a
value is instead of holding it, as [secrets](/admin/configuration-files#secrets) in other files do:
`${env:NAME}` is the server process's environment variable, `${file:PATH}` the content of a file
without its trailing line breaks (a relative path starts at the server folder, an absolute one is
taken as it is) and `${pluginfile:PATH}` the same for a file in the plugin's folder (in
`plugins/Shop/database.yml`, `${pluginfile:db-password.txt}` reads `plugins/Shop/db-password.txt`;
in `connections.yml`, the Database module's folder). They may appear
anywhere in the value and more than once (`${env:DB_USER}_shop`); they are resolved at every start
and reload, so a password rotated in its file applies at `/versatia reload <plugin>`. In any other
key they are plain text.

```yaml title="plugins/Shop/database.yml: credentials from the environment and from a file"
engine: postgresql
host: ${env:SHOP_DB_HOST}
username: shop
password: ${file:/run/secrets/shop_db_password}   # Docker and Kubernetes secrets are files
# password: ${pluginfile:db-password.txt}         # or plugins/Shop/db-password.txt
properties:
  sslpassword: ${env:SHOP_DB_KEY_PASSWORD}          # a driver property holding a secret
```

Text keys take text: write a value YAML would read as a number, a boolean or a date in quotes,
`password: '0123'`, `database: '2024'`, since YAML reads an unquoted `0123` as the number 83; such a
value is an error naming the key (for `password` never the value). Driver `properties` take numbers
and booleans as they are (`connectTimeout: 5000`).

#### Defaults per engine {/* #defaults-per-engine */}

| Engine                | `port` | `pool.size` | `pool.min-idle` | `pool.connection-timeout` | `pool.max-lifetime` | `threads` |
|-----------------------|--------|-------------|-----------------|---------------------------|---------------------|-----------|
| `sqlite`              | none   | 1, always   | 1               | 10s                       | unlimited           | 1         |
| `h2`                  | none   | 4           | 1               | 5s                        | unlimited           | 4         |
| `mysql`, `mariadb`    | 3306   | 4           | 1               | 5s                        | 30m                 | 4         |
| `postgresql`          | 5432   | 4           | 1               | 5s                        | 30m                 | 4         |

`threads` follows the pool: the pool size up to 4 (`pool.size: 2` gives 2 threads), and on a
shared connection its `threads-per-plugin` when that is set.

#### Examples {/* #database-yml-examples */}

The SQLite default needs no file: the one the module writes, shown above, records it. Anything
else takes a few keys; what is left out keeps its default.

```yaml title="plugins/Shop/database.yml: its own MySQL database"
engine: mysql
host: db.example.net
# port: 3306                       # the default of mysql
database: survival                 # must exist: CREATE DATABASE survival CHARACTER SET utf8mb4
username: shop
password: ${env:SHOP_DB_PASSWORD}  # read from the environment at every start and reload; or ${file:...}
ssl: required
pool:
  size: 6
threads: 3
query-timeout: 10s
```

```yaml title="plugins/Shop/database.yml: the shared connection main"
connection: main                   # engine, host, credentials and pool come from connections.yml
threads: 2                         # at most the pool size of main
```

```yaml title="plugins/Shop/database.yml: PostgreSQL, in a schema of its own"
engine: postgresql
host: 10.0.0.12
database: minecraft
schema: shop                       # must exist: CREATE SCHEMA shop AUTHORIZATION shop
username: shop
password: ${env:SHOP_DB_PASSWORD}
ssl: verify
```

### Reading rules {/* #reading-rules */}

The file is read strictly, so a typo never passes as a default:

| In the file                         | Result                                                     |
|-------------------------------------|------------------------------------------------------------|
| an unknown key                      | `Plugin Shop: database.yml has unknown key "pool.sise"; did you mean "pool.size"?`, or the keys known at that level |
| a duration                          | a number with a unit, `ms`, `s`, `m`, `h` or `d`, combined as `1h 30m`; `0` is zero; any other bare number fails with `Plugin Shop: database.yml: value at "slow-query" is not a duration such as "30s", "5m" or "1h 30m" (units d, h, m, s, ms; must not be negative): "250"` |
| `${env:NAME}`, `${file:PATH}` or `${pluginfile:PATH}` in `host`, `database`, `username`, `password` or a text value of `properties` | the environment variable or the file's content; one that is not set or cannot be read fails with `Plugin Shop: database.yml: value at "password" uses ${env:SHOP_DB_PASSWORD}, which is not set; set that environment variable for the server, or write the value instead`, or `... uses ${file:secrets/db.txt}, but /srv/mc/secrets/db.txt does not exist` |
| any other `${...}` in those keys    | `Plugin Shop: database.yml: value at "password" uses ${DB_PASSWORD}, which is none of ${env:NAME}, ${file:PATH} and ${pluginfile:PATH}; did you mean ${env:DB_PASSWORD}?` |
| an unquoted number, boolean or date in a text key | `Plugin Shop: database.yml: value at "database" is read as a number (2024), not text; quote it, ...`; for `password` `... is read as a number, not text; put the secret in quotes, ...`, without the value |
| `connection:` with keys of its own  | `Plugin Shop: database.yml sets connection: main and also engine, pool; those belong to the connection in connections.yml, remove them` |
| an unknown connection               | `Plugin Shop: database.yml names connection "mian" at connection, which connections.yml does not define; defined: main` |
| `pool.size` above 1 on SQLite       | a warning, and 1                                           |
| `threads` above `pool.size`         | a warning, and `pool.size`                                 |
| a number out of range               | `Plugin Shop: database.yml sets port: 70000; use 1 to 65535`, or `use 1 or more`, `use 0 or more` |
| a prefix with other characters      | `Plugin Shop: database.yml sets table-prefix: "Shop_"; use lower-case letters, digits and _ only` |
| an inline `import-from` without `engine` | `Plugin Shop: database.yml has no import-from.engine; set one of sqlite, h2, mysql, mariadb, postgresql` |

A broken file fails the start; at a reload it fails the reload and the running settings stay.

### The table prefix {/* #the-table-prefix */}

`{prefix}` expands to the plugin's table prefix, and builders and stores add it to the table names
they get. The prefix is lower-case letters, digits and `_`, and is:

1. `table-prefix` in the plugin's `database.yml`; `table-prefix: ''` is no prefix;
2. otherwise the plugin's [friendly name](/docs/lifecycle/reload#friendly-names) in snake_case plus
   `_`: `market` gives `market_`, `MyShop` gives `my_shop_`, so a migration's
   `CREATE TABLE {prefix}profiles` creates `market_profiles`.

Every plugin thus has its own tables even in a shared database. The module writes the prefix it
used into `database.yml` at the first open, so a plugin keeps its tables whatever its friendly name
becomes later. One safety remains for a `database.yml` without `table-prefix`: when the plugin's
history lives only without a prefix (a `table-prefix: ''` line was removed), it keeps those tables,
rather than starting on new empty ones, and logs at every open:

```text
its existing tables have no table prefix and keep it, although plugins/Shop/database.yml sets no table-prefix, which defaults to shop_; to keep them, set table-prefix: '' there; to move them, set table-prefix: shop_ and add import-from naming this same database, with table-prefix: ''
```

Plugins sharing a database and a prefix also share `{prefix}schema_history`, whose rows are kept
per plugin. A non-empty prefix belongs to the plugin that first applied migrations under it, so two
plugins with the same friendly name in one database cannot take the same one by accident:

```text
Plugin Shop: table prefix "shop_" is already used by plugin Bank in this database; set another table-prefix in plugins/Shop/database.yml (or, if Shop was renamed, update the plugin column of shop_schema_history)
```

Plugins with `table-prefix: ''` share the unprefixed `schema_history`, which records the tables each
plugin's migrations leave behind. A migration that would create a table another of them owns stops
before anything runs, `IF NOT EXISTS` included, so two plugins never write into one table:

```text
Plugin Bank: table "profiles" already exists and belongs to plugin Shop; set table-prefix in plugins/Bank/database.yml
```

```yaml title="Wrong: both plugins on main give up their prefix, and both create profiles"
connection: main
# error-next-line
table-prefix: ''
```

```yaml title="Right: Bank keeps a prefix: its default bank_ (no table-prefix line), or one of its own"
connection: main
# fix-next-line
table-prefix: bank_
```

## Corner cases {/* #corner-cases */}

- **A non-empty prefix belongs to one plugin**: a second plugin under the same prefix (two plugins
  with one friendly name) fails the start. Plugins with `table-prefix: ''` share `schema_history`,
  each with its own rows, and a migration creating a table another of them owns fails before it
  runs, naming the owner. Tables recorded before the module kept that list, or created outside
  migrations, are not known to belong to anyone: the `CREATE TABLE` itself fails then.
- **`${env:NAME}`, `${file:PATH}` and `${pluginfile:PATH}` work in `host`, `database`, `username`, `password` and the
  text values of `properties` only**; anywhere else they are plain text. In those keys any other
  `${...}` is an error, so a password that really contains `${` goes into a file or a variable,
  whose content is taken as written. A number or a boolean in `properties` (`connectTimeout: 5000`)
  stays as written.
- **Text keys refuse what YAML did not read as text**: an unquoted `0123`, `yes` or `2024-01-01` in
  `password`, `database` or any other text key is something else to YAML, so it is refused (for
  `password` without the value in the message) instead of being used changed; quote it. Driver
  `properties` are the exception: their numbers and booleans pass as written by YAML.
- **A key the engine does not use is ignored**: `schema` outside PostgreSQL, `file` on a server
  engine, `host` and the rest on SQLite and H2; none is an error.
- **`threads` and `pool` follow the engine and the connection** unless a plugin's `database.yml`
  sets them: the file the module writes at the first open sets neither, so a changed
  `threads-per-plugin` or connection pool reaches every plugin on it at `/versatia reload database`.
