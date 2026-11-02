---
title: Opening, shutdown and errors
counterpart: /admin/database/operations
description: When the database opens, what a reload re-reads, the shutdown sequence, database.status and the exceptions.
---

# Opening, shutdown and errors

import Audience from '@site/src/components/Audience';
import TwinEngines from '@site/src/components/TwinEngines';

## When the database opens {/* #when-the-database-opens */}

The database reads its `database.yml` and the SQL files of the JAR when the plugin starts, after
its beans are built and before its `@AutoInvoke` functions. It **opens at once** when the JAR has
migrations, a store exists or `import-from` is set: the pool, the [migrations](migrations.md#how-migrations-run),
the import, the `database.yml` it writes, the [check of the stores' tables](stores.md#the-table),
the players already online (loaded without `onJoin`), then the summary line. Any failure there fails the start of the plugin.

A plugin with none of these opens its database at the first call that needs a connection, on the
calling thread; one that never touches it opens nothing and writes no file. An open that failed is
remembered for 5 seconds: calls in that time fail at once with the same exception instead of each
waiting for the server.

## Reloading and status {/* #reloading-and-status */}

`/versatia reload <plugin>`, or `VersatiaEngine.reload`, re-reads `database.yml` before the plugin's
reload functions run; the SQL files are code and are not read again. What each key does at a
reload, `/versatiadb status` and the logs are described for the server admin in
[Running the database](/admin/database/operations).

The plugin sees the figures of `/versatiadb status` in `database.status`, a `DatabaseStatus`: its
friendly name, engine, target (a file, or `host:port/database`, never credentials), whether it is
open, the schema version (`0` without migrations or before the first open), the pool
(`Versatia-main` for a shared connection), the tasks and every store, with `lastSaveFailed` when its
last save did not go through. Reading it never touches the database.

## Shutdown {/* #shutdown */}

Your `PLUGIN_STOP` functions run first, with the database fully usable and blocking allowed: write
what you need there with direct calls, since `thenSync` steps no longer run. Then the database closes:

1. New work is refused: `database.async` and store operations fail with
   `Plugin Shop: its database is closed`, and players logging in meanwhile are refused with
   `messages.closing`.
2. The autosave and the other timers stop.
3. Running and queued work finishes, quit saves and your tasks included, for at most
   `shutdown-timeout` (20 s), with a line every 5 s: `Waiting for 3 database tasks (UPDATE {prefix}profiles SET ...)`.
   Work still running then is interrupted and listed:
   `1 database task did not finish within 20s and was interrupted: SELECT ... (submitted at com.example.shop.Reports.weekly(Reports.kt:40))`.
4. `onLeave` is applied to every player still online: they get no quit event before the plugin stops.
5. Every changed store value is written, in one transaction per store, then one by one while the
   rest of `shutdown-timeout` lasts. Values that still cannot be written are logged with their key
   and value, so nothing is lost silently:

   ```text
   [Shop] 1 entry of profiles could not be saved (Connection refused):
     069a79f4-44e9-4726-a5be-fca90e38aaf5=Profile(uuid=069a79f4-44e9-4726-a5be-fca90e38aaf5, name=Steve, coins=120, lastSeen=2026-10-25T14:30:00Z)
   ```

6. Server-thread steps still waiting are dropped; their futures fail.
7. The pool is released: the plugin's own pool closes, a shared one when its last plugin lets go.

A failure in any step is thrown at the end, after the others ran, and reported as the plugin's
failure to close.

### The module disabled first {/* #the-module-disabled-first */}

When VersatiaModule-Database itself is disabled while plugins using it still run (a plugin manager
unloading it), it closes every database as above, then its pools, and unregisters the drivers it
brought. Calls of the plugins still running fail from then on with
`Plugin Shop: VersatiaModule-Database was disabled; restart the server`.

## Errors <Audience who="developer" /> {/* #errors */}

Every failure is a `DatabaseException` (package `com.github.marcoral.versatia.database`) whose
message starts with `Plugin <name>:` and says what to do:

| Exception                     | When                                                             |
|-------------------------------|------------------------------------------------------------------|
| `DatabaseConfigException`     | `database.yml` or `connections.yml` is invalid, an SQL file of the JAR is malformed, a prefix belongs to another plugin, or the server is older than the module supports |
| `DatabaseUnavailableException`| no connection could be made, or none borrowed within `pool.connection-timeout`; the message carries the fix |
| `DatabaseBusyException`       | more background tasks wait than `queue-limit` allows             |
| `DatabaseClosedException`     | the plugin, or the module, is stopping or stopped                |
| `MainThreadException`         | a blocking call on the server thread with `main-thread: throw`   |
| `SqlTemplateException`        | an unknown `{token}`, an unknown or unbound `:name`, an empty collection, mixed `?` and `:names` |
| `UnknownQueryException`       | `named(...)` with a name no query file defines; lists the close ones |
| `MappingException`            | a row cannot become the type asked for, a single-row call found none or several, a type cannot be stored |
| `MigrationException`          | a migration or an import failed, an applied migration changed, the migration lock timed out, or a store's table does not match its class |
| `QueryException`              | the database rejected a statement; `sql` (as written, without values), `sqlState`, `errorCode` and `kind` say how |
| `DuplicateKeyException`       | a `QueryException` for a violated primary key or unique constraint, recognised the same way on every engine |
| `EntryNotLoadedException`     | a store value was read or updated before its key was loaded (package `store`) |

A `QueryException` reads:

```text
Plugin Shop: query failed: Duplicate entry '069a79f4-44e9-4726-a5be-fca90e38aaf5' for key 'profiles.PRIMARY' (MySQL 1062, SQLState 23000)
SQL: INSERT INTO `profiles` (`uuid`, `name`, `coins`, `last_seen`) VALUES (?, ?, ?, ?)
Parameters: uuid, name, coins, last_seen
```

### Failure kinds {/* #failure-kinds */}

`QueryException.kind` classifies the failure the same way on every engine, so code can react
without knowing vendor codes:

| `FailureKind`   | Retried by `transaction(retries = n)` | For example                                         |
|-----------------|---------------------------------------|-----------------------------------------------------|
| `DUPLICATE_KEY` | no                                    | a second row with the same primary or unique key    |
| `FOREIGN_KEY`   | no                                    | a reference to a missing row, or a delete of a referenced one |
| `NOT_NULL`      | no                                    | NULL into a `NOT NULL` column                       |
| `CHECK`         | no                                    | a violated `CHECK` constraint                       |
| `DEADLOCK`      | yes                                   | two transactions waiting for each other             |
| `LOCK_TIMEOUT`  | yes                                   | a lock not granted in time; SQLite's "database is busy" |
| `TIMEOUT`       | no                                    | the statement ran past its timeout                  |
| `CONNECTION`    | no                                    | the connection broke; a write may or may not have happened |
| `OTHER`         | no                                    | anything else                                        |

```kotlin
database.async { insert("profiles", profile) }
    .onFailureSync { error -> if ((error as? QueryException)?.kind == FailureKind.DUPLICATE_KEY) sender.sendMessage("That profile exists already") }
```

