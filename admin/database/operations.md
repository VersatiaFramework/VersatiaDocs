---
title: Running the database
counterpart: /docs/modules/database/operations
---

# Running the database

import TwinEngines from '@site/src/components/TwinEngines';

## Reloading {/* #reloading */}

`/versatia reload Shop` re-reads `database.yml`; the SQL
files are part of the plugin's JAR and are not read again.

| Changed in `database.yml`                                                        | At the reload                                             |
|----------------------------------------------------------------------------------|-----------------------------------------------------------|
| `connection`, `engine`, `file`, `host`, `port`, `database`, `schema`, `table-prefix`, `import-from` | nothing; a warning says it waits for a restart: `database.yml now points to MYSQL db2.example.net:3306/shop; this takes effect after a restart (current: SQLITE database.db). To copy the data, add import-from.` |
| `username`, `password`, `ssl`, `properties`, `pool.*` of the plugin's own pool   | applied to the running pool; open connections are replaced as they come back |
| `threads`                                                                        | the database threads are resized                           |
| `queue-limit`, `query-timeout`, `slow-query`, `main-thread`, `log-statements`, `shutdown-timeout`, `migrations.*`, `stores.*`, `messages.*` | applied at once; the autosave is rescheduled |

A broken file fails the reload and the running settings stay. The shared connections are
`connections.yml`'s, applied by [`/versatia reload database`](configuration.md#connectionsyml),
which also re-reads the module's [`defaults`](configuration.md#configyml) and has every open
database read its settings again as above, so a changed default applies at once wherever no
`database.yml` sets that key.

| Edited                                                   | Then run                          |
|----------------------------------------------------------|-----------------------------------|
| `plugins/<Plugin>/database.yml`                          | `/versatia reload <plugin>`, or restart for a different database |
| `plugins/VersatiaModule-Database/connections.yml` or `config.yml` | `/versatia reload database`  |


## Status {/* #status */}

With [CommandAPI](https://commandapi.jorel.dev) on the server, `/versatiadb status [plugin]` (or
`/vdb`) shows every open database, or one plugin's, to holders of
`versatia.database.command.status` (operators by default):

```text
Shop: SQLITE database.db, open, schema V3
  pool Shop-db (private): 0 active, 1 idle, 0 waiting, at most 1
  tasks: 0 queued, 0 running, 2 failed; 1 slow statements
  store profiles: 14 loaded, 3 changed
```

Each database is headed by its plugin's [friendly name](/docs/lifecycle/reload#friendly-names);
when the `plugin.yml` name, which the logs and errors show, differs, it follows in brackets:
`market (VersatiaExample-Modules-Database): SQLITE database.db, open, schema V3`. Either name
selects the plugin in `/versatiadb status <plugin>`.

## Logs {/* #logs */}

| Setting                | Logs                                                                |
|------------------------|---------------------------------------------------------------------|
| `slow-query: 250ms`    | each statement slower than that, as written: `Slow statement (412 ms): SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC …` |
| `log-statements: true` | every statement with its values and time: `SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT :limit [:limit = 10] (3 ms)` |
| `pool.leak-warning: 10s` | a connection held longer than that, with the stack of who borrowed it |

Values appear only with `log-statements`; failure messages otherwise name the parameters without
their values. The module logs under the name of the plugin whose database it is, so each line starts with
`[Shop]`; exception messages, which travel further, start with `Plugin Shop:`.


## Player data {/* #player-data */}

A plugin that keeps players' data in the database loads it at login and saves changes in the
background. The `stores.*` keys of [`database.yml`](configuration.md#every-key), or of
`defaults:` in the module's `config.yml` for every plugin, set the timings:

| Key                            | Default | What it changes                                                   |
|--------------------------------|---------|-------------------------------------------------------------------|
| `stores.autosave`              | 5m      | how often changes are written; shorter writes sooner and more often |
| `stores.login-timeout`         | 10s     | how long a login waits for its data before it is refused with `messages.load-failed` |
| `stores.save-failure.action`   | `kick`  | what follows a player's data failing to save for `stores.save-failure.after` (1m) |
| `stores.save-failure.keep-in-file` | `true` | data the final save at a stop cannot write is kept in a file and written at the next start |

Choose `stores.save-failure.action: shutdown` only when a restart fixes your failures, as with a
host that restarts the server and the database together; `kick` keeps the server up and the data
in memory until the database is back, and `warn` only logs.

`main-thread` decides what happens when a plugin makes the server wait for the database: `throw`
(the default) fails the call, `warn` lets it run and logs the line to report to the plugin's
author, `allow` stays silent.

## Troubleshooting {/* #troubleshooting */}

| The log says                                         | What to do                                                  |
|------------------------------------------------------|-------------------------------------------------------------|
| `cannot reach MySQL at db.example.net:3306 (Connection refused); is the server running and the port open? (connection in plugins/Shop/database.yml)` | start the database server, open the port, check `host` and `port` |
| `... check username and password, and that the user may connect from this host (GRANT ... TO 'shop'@'<this host>')` <TwinEngines /> | MySQL or MariaDB refused the login: fix the credentials or the user's host |
| `... create it first: CREATE DATABASE survival CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` <TwinEngines /> | the database does not exist on the server; the module never creates databases, only tables |
| `... set ssl: required, or add properties: { allowPublicKeyRetrieval: true }` <TwinEngines /> | MySQL 8 password login without TLS                         |
| `... the TLS handshake failed; set ssl: disabled when the server has no TLS, or fix its certificate` <TwinEngines /> | MariaDB with `ssl: preferred` or `required` against a server without TLS |
| `... add a pg_hba.conf entry that lets shop connect to survival from this host` | PostgreSQL refused the connection by its access rules |
| `cannot open the SQLite database ... the SQLite native library could not load; start the server with -Dorg.sqlite.tmpdir=<a folder that allows executables>, or use engine: h2` | the host's temporary folder does not allow native code |
| `cannot open the H2 database ... the file is in use by another process` | another server or a database tool holds the file open |
| `cannot get a database connection (...); check that the database is reachable` | the database went away after the start, or the pool stayed exhausted for `pool.connection-timeout`; look for slow statements or connections held in long `connection { }` blocks |
| `Statement.list blocks the server thread; run it inside database.async { }` | the plugin makes the server wait for the database; report the line to its author, or set `main-thread: warn` ([Player data](#player-data)) |
| `5000 database tasks are waiting; the database is too slow or unreachable` | the database cannot keep up or is down; look at the failures logged before |
| `migration V1__create_profiles.sql was changed after it was applied` | restore the file, put the change in a new migration ([why](data.md#plugin-updates)) |
| `table prefix "shop_" is already used by plugin Bank in this database` | give one of the plugins its own `table-prefix`            |
| `table "profiles" already exists and belongs to plugin Shop; set table-prefix in plugins/Bank/database.yml` | two plugins with `table-prefix: ''` share a database and a table name; give one of them its prefix back |
| `V1__create_profiles.sql failed at statement 1 ...: Table 'profiles' already exists` | the table was made outside this plugin's migrations (by hand, or by a plugin whose history predates `owned_tables`); give this plugin a `table-prefix`, or drop the stray table |
| `another server has held the migration lock for the shop_ tables for 60 s` | another server is migrating the same tables, or a stuck session holds the lock |
| `Refused the login of Steve (...): profiles could not be loaded (...)`, and players see *Your data could not be loaded* | the database is unreachable or slower than `stores.login-timeout`; the cause in brackets says which |
| `profiles could not lock 069a79f4-... within 30s; a store transaction or save holds it (stores.lock-timeout in database.yml)` | a store transaction held the key that long; shorten it, or raise `stores.lock-timeout` |
| `Kicked Steve (069a79f4-...): their profiles could not be saved for 1m; ...` | the database refused or did not answer the saves of that player for `stores.save-failure.after`; the `Saving profiles failed` line before names why. Once it saves, the player may log in again ([When a save fails](operations.md#player-data)) |

The module's libraries are downloaded by Paper at the module's first start; a server without
access to Maven Central at that moment cannot load the module.
