---
title: Moving and backing up data
counterpart: /docs/modules/database/migrations
---

# Moving and backing up data

import TwinEngines from '@site/src/components/TwinEngines';

A plugin creates and updates its tables itself, with migrations shipped in its JAR: at every start it
applies the ones the database has not seen yet and logs each one:

```text
[Shop] Applying V2__create_payments.sql
[Shop] SQLITE database.db, prefix shop_, schema V2 (applied V2 in 35 ms)
```

What you do on the server is decide where the tables live, move them, and keep backups.

## Changing the database {/* #changing-the-database */}

A different target (`connection`, `engine`, `file`, `host`, `port`, `database`, `schema`,
`table-prefix`) applies at the next restart; `/versatia reload` only warns that it is waiting. To
take the data along, add `import-from` with the old target, inline or as `connection: <name>`, and
restart:

```yaml title="plugins/Shop/database.yml"
engine: mysql
host: db.example.net
database: survival
username: shop
password: ${env:SHOP_DB_PASSWORD}
import-from:
  engine: sqlite                 # file defaults to database.db
```

```text
[Shop] Applying V1__create_profiles.sql
[Shop] Applying V2__create_payments.sql
[Shop] MYSQL db.example.net:3306/survival, prefix shop_, schema V2 (applied V1, V2 in 210 ms)
[Shop] Imported from SQLITE database.db: shop_payments 5 870 rows, shop_profiles 1 204 (1.9 s)
```

The new tables are created by the migrations first; then the tables those migrations create (and
no other table of the source database) are copied in one transaction, in the order its foreign keys need, converting the values on the way (epoch
milliseconds become `DATETIME(3)`, text UUIDs become `UUID`, `0` and `1` become `BOOLEAN`), and the
identity columns continue after the copied keys. The old database is left as it was, as a backup.

| Situation                                           | Result                                                  |
|-----------------------------------------------------|---------------------------------------------------------|
| the import already ran                              | skipped: `Already imported from SQLITE database.db on 2026-10-25; you may remove import-from` |
| the source is a file that does not exist            | skipped: `Nothing to import from SQLITE database.db, since plugins/Shop/database.db does not exist; you may remove import-from` |
| the source is at an older schema version            | it is migrated first (an SQLite or H2 file is backed up before), then copied |
| the source is at a newer version                    | fails: `cannot import from SQLITE database.db: its tables of Shop are at V4, ahead of this version of Shop (V3); update Shop first, then restart` |
| the source has no tables of this plugin             | fails: `cannot import from SQLITE database.db: it has no schema_history with applied migrations of Shop, so it holds none of the tables of Shop; check import-from and its table-prefix (...)` |
| a table here already has rows                       | fails: `cannot import from SQLITE database.db: table profiles already has rows here; import-from copies only into empty tables, so empty the tables of Shop or remove import-from` |
| a table of the migrations is missing in the source  | fails: `cannot import from SQLITE database.db: table profiles is missing there, although the migrations of Shop create it; check import-from and its table-prefix` |
| a column of the source does not exist here          | fails, naming it: add a migration that creates it, or drop it from the source |
| the copy fails midway                               | fails: `importing from SQLITE database.db failed at table profiles: ...; nothing was imported, so fix the cause and restart to try again` |

The tables keep their names, unless the source keeps them under another prefix: then
`import-from.table-prefix` names that prefix, and `market_profiles` there fills `profiles` here (or
whatever this plugin's prefix makes of it).

```yaml title="plugins/Market/database.yml: from prefixed tables to none"
table-prefix: ''
import-from:
  engine: sqlite
  table-prefix: market_
```

A failed import fails the start of the plugin and leaves the new tables empty, so the next start
tries again. A finished import is recorded in the target's
[`{prefix}schema_history`](data.md#importing-again), as a row of this plugin with version `0`,
`script` `IMPORT`, the source as `description` (`SQLITE database.db`), the number of tables copied
as `applied_statements`, and when and how long. That row is what makes every later start skip the
import, so `import-from` may stay in the file afterwards. To import again, empty the plugin's
tables and delete that row; the schema version the module reports never counts it. To move several plugins onto one shared
server, define the connection in `connections.yml`, give each plugin `connection: main` and
`import-from: { engine: sqlite }`, and restart once; set `default-connection: main` for plugins
installed later.

### Importing again {/* #importing-again */}

A finished import is recorded in the target database as a row of the plugin with `version` 0 in
`{prefix}schema_history`, so every later start skips it. To import again: stop the server, empty
the plugin's tables in the target (or drop them, with the plugin's other history rows, to let the
migrations create them anew), delete that row, and start with `import-from` still set.
`import-from` copies only into empty tables, so a table that still has rows fails the import.

```sql title="Run on the target database: the import marker of Shop"
DELETE FROM shop_schema_history WHERE plugin = 'Shop' AND version = 0;
```

## Backups {/* #backups */}

Before it applies anything to an SQLite or H2 file that already has a history, the module copies
the whole database into `backups/` next to it, as
`database-before-V3-20261025-143000.db` (SQLite) or `.zip` (H2), and keeps the newest
`migrations.backups` copies (3; `0` turns backups off):

```text
[Shop] Backed up database.db to plugins/Shop/backups/database-before-V3-20261025-143000.db
```

MySQL, MariaDB and PostgreSQL are backed up by their own tools.

## The migration lock {/* #the-migration-lock */}

| Engine                | Lock                                                                   |
|-----------------------|------------------------------------------------------------------------|
| SQLite, H2            | a lock inside the server per file, plugin and prefix; the file belongs to one server |
| MySQL, MariaDB <TwinEngines /> | `GET_LOCK('versatia:<database>:<plugin>:<prefix>')`, hashed when the name is longer than 64 characters |
| PostgreSQL            | an advisory lock on a hash of the same name, tried every 500 ms        |

A server that waits `migrations.lock-timeout` (60 s) fails to start with
`Plugin Shop: another server has held the migration lock for the tables of Shop for 60 s; if no other server is starting, look for a stuck session`
(`for the shop_ tables` with a prefix).


## When a plugin updates {/* #plugin-updates */}

An updated plugin may bring new migrations; they run at its next start. Three messages concern you:

| The log says                                                        | What to do                                       |
|---------------------------------------------------------------------|--------------------------------------------------|
| `The tables of Shop have V4 applied, which this version of Shop does not ship (it ends at V3); a newer version of Shop runs on another server (migrations.future-versions: warn)` | another server sharing the database already runs a newer version of the plugin; update this one too. With `migrations.future-versions: fail` the plugin refuses to start instead |
| `migration V1__create_profiles.sql was changed after it was applied` | the plugin's JAR changed a migration that already ran; the plugin does not start. Go back to the previous JAR and tell its author |
| `migration V2__create_payments.sql was applied to the tables of Shop but is missing from the JAR` | the JAR is older than the database; install the newer one |

A migration that fails on MySQL, MariaDB or H2 may leave part of its statements applied; the next
start, after the plugin's author fixed it, resumes where it stopped. On SQLite and PostgreSQL a
failed migration leaves nothing behind.
