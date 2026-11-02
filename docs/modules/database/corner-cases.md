---
title: Corner cases
description: The edge rules of the Database module, part by part.
---

# Corner cases

import TwinEngines from '@site/src/components/TwinEngines';

The edge rules of the Database module, grouped like its pages.

## Statements and mapping {/* #statements-and-mapping */}

- **Tokens do not expand inside string literals.** `'{prefix}profiles'` stays as written; pass a
  table name as a value built from `database.tablePrefix`:

  ```kotlin title="Wrong: looks for a table literally named {prefix}profiles"
  // error-next-line
  sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '{prefix}profiles'").single<Long>()
  ```

  ```kotlin title="Right"
  // fix-next-line
  sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = :table", "table" to database.tablePrefix + "profiles").single<Long>()
  ```

- **Tokens expand inside a dollar-quoted body** (`$$ ... $$`), but not inside the string literals
  and comments of that body: SQL a PostgreSQL function builds as text for `EXECUTE` keeps `{prefix}`
  as written ([example](configuration.md#how-tokens-expand)).
- **`"..."` is a string literal on MySQL and MariaDB** <TwinEngines />, as their default `sql_mode` reads it, so
  nothing expands inside it there; quote names with `` `...` ``. On SQLite, H2 and PostgreSQL
  `"..."` is a quoted identifier, inside which tokens expand.
- **`ORDER BY :column` does not sort**: it binds a constant, the same for every row. Choose the
  column from texts you wrote ([Dynamic identifiers](statements.md#dynamic-identifiers)).
- **Table names of builders and stores, and the keys of a `Map` row, are SQL**: they are written
  into the statement as names, not bound, so they never come from a player. Each must be a plain
  name once prefixed, letters, digits and `_` not starting with a digit (`[A-Za-z_][A-Za-z0-9_]*`);
  any other fails with a `SqlTemplateException` naming it, before any SQL runs:
  `Plugin Shop: column name "coins total" is not allowed; names written into SQL by builders and stores are letters, digits and _, not starting with a digit ([A-Za-z_][A-Za-z0-9_]*)`.
- **Every `?` outside literals and comments is a positional parameter.** A statement using
  PostgreSQL's JSONB operators `?`, `?|` and `?&` therefore cannot also have `:named` parameters;
  use the functions `jsonb_exists`, `jsonb_exists_any` and `jsonb_exists_all` there.
- **A null bound through a pair has no type**: `"owner" to null` is bound as an untyped NULL.
  `bind("owner", owner)` keeps the declared type of `owner`, which engines that check parameter types
  (PostgreSQL) may need.
- **A `ByteArray` is one value**, never a collection to expand.
- **`singleOrNull` is about rows, not values.** It returns null when there is no row; a row whose
  only column is NULL needs a nullable type: `single<Long?>()`.
- **Columns are matched ignoring case**; of two columns with the same label, the first counts.
- **A store names its table and columns as the database stores them**, so `@Column(name = "lastSeen")`
  reaches a column created as `lastSeen`, which PostgreSQL and H2 keep as `lastseen`. Builders quote
  the names you give them, which makes them case-sensitive on those two engines: keep table and
  column names in lower case.
- **`Instant` keeps milliseconds.** It is truncated when written, so a value read back equals the
  written one only to the millisecond.
- **Builders write every constructor property**, defaults included. A column whose database
  `DEFAULT` should apply (`paid_at ... DEFAULT {now}`) must not be a property of the row class, or
  the Kotlin value is written instead; only the key of `insertAndGetKey` is left out, when it is `0`
  or null.
- **`upsert` returns 1** for an insert and for an update alike; MySQL itself counts an update as 2.
- **Enums are stored by name.** Renaming a constant makes old rows unreadable
  (`"GOLD" is not a Rank; known: MEMBER, VIP`); migrate the rows in the same release.
- **Several registered supertypes of one class**: the nearest wins, the one no other matching
  registered type extends. Two equally near (a class and an interface it implements, say) fail with
  `Plugin Shop: GoldCoin matches the codecs registered for com.example.Coin and com.example.Shiny equally closely; register a codec for GoldCoin itself`.
  A value class wrapping another value class is not a column type.
- **`insertReturning` needs the key as a property** of the row class, named after the key column,
  holding a `Long`, an `Int` or a type stored as one of them; it is checked before the insert.

## Threads and transactions {/* #threads-and-transactions */}

- **`join()` of a future that is done returns at once anywhere**, the server thread included; one
  that is not done is guarded like any blocking call. Continue with `thenSync` instead of joining.
- **`database.async { }` on a database thread runs inline**, on that thread, not in parallel.
- **`onFailureSync` leaves the future failed**, so a `thenSync` after it never runs; put the
  failure branch last.
- **Only the outermost transaction retries**: the `retries` of a nested `transaction { }` are ignored.
- **`setRollbackOnly()` in a nested transaction** rolls back the outermost one, all of it.
- **An exception from an `afterCommit` action** is thrown out of `transaction { }` after the commit:
  the data is written, and the transaction is not retried.
- **A broken connection is never retried**: a write whose acknowledgement was lost may have been
  committed.
- **`connection { }` ends in auto-commit**: if the block turned auto-commit off, what it left
  uncommitted is rolled back.
- **`0` means the driver's limit, not no limit**: on MySQL, MariaDB and PostgreSQL a connection
  that waits longer than twice `query-timeout` (at least 2 minutes) for the server is broken, so
  with `timeout(Duration.ZERO)` or `query-timeout: 0` a statement running longer than 120 s still
  fails, as a broken connection. Raise `query-timeout` for long work.

## Stores {/* #stores */}

- **`store[key] = value` for a key that is not loaded** writes the whole value as an upsert at the
  next save, over a row that may exist. To change a stored row, `load` it first and `update` it.
- **A keyed store does not insert what `create` made** until it is changed; a player store writes new
  players at the next save.
- **Values are immutable.** A table store refuses at activation a class with a `var` property or a
  mutable collection type (`MutableList`, `MutableMap`, `ArrayList`, ...); a [`StoreSchema`](stores.md#your-own-layout)
  store is not checked, and a property changed inside its cached instance is neither seen nor
  saved. Replace the value with `copy`.
- **`tryUpdate` returns null while a store transaction holds the key**, even when the change itself
  would succeed.
- **Two timeouts bound the waits for a key**: `stores.login-timeout` a login's, and
  `stores.lock-timeout` every other (saves, loads, store transactions); the final save at stop
  waits only as long as `shutdown-timeout` leaves.
- **Before `HIGH`, a player's value is not loaded.** An `AsyncPlayerPreLoginEvent` handler at
  `LOWEST`, `LOW` or `NORMAL` runs before the store; read the value from `PlayerJoinEvent` on.
- **Your quit handlers see the value before `onLeave`**, which the store applies at `MONITOR`.
- **The autosave events fire only for changed entries**: an autosave with nothing to write fires
  neither; the counts of the start event are those of the moment it fires, and a change made in
  between is written but not counted. The end event of a run never comes once the plugin is
  disabled, and an autosave the queue refuses ends at once with `saved` 0 and the refusal as `failure`.
- **An NPC has no value**: `profiles[npc]` fails; `profiles[npc.uniqueId]` is null.
- **Offline players loaded by a store transaction** stay cached until `stores.idle-expiry`; with
  `idle-expiry: 0` nothing a keyed store loaded is ever forgotten.
- **A failed quit save keeps the values** of the player in every player store cached and changed;
  the autosave writes them later and then forgets them.
- **Stores follow the foreign keys between their tables** ([Stores that reference each other](stores.md#stores-that-reference-each-other)).
  Tables that reference each other in a cycle are written in the order the stores were made, with
  one warning at start:
  `the tables of stores eggs, hens reference each other through foreign keys, so no order writes them safely; they are written in the order they were made, and a new row the database refuses is retried at the next save`.
- **`delete` takes along only the rows that extend the row**: those of stores whose key column
  references the store's key column, with a key of the same class. A reference from another column
  (`members.guild REFERENCES guilds (id)`) is the database's: without `ON DELETE` the delete fails
  with `FOREIGN_KEY`; with `ON DELETE CASCADE` the database deletes rows that the referencing store
  may still cache, and its next save of them fails. Change or evict the referencing values first.
- **A table that is no store's and references a store's table** (`payments.payer REFERENCES
  profiles (uuid)`) sees a new player's row only once a save wrote it. Insert into it in a
  transaction of that store after changing the player's value, which writes the row first, or after
  `profiles.save(player)`.
- **`evict` keeps a key that changed again** while it was being saved: the new change stays cached
  for the next save.
- **`delete` of a store over your own `StoreSchema`** fails unless the schema overrides `delete`.
- **`stores.save-failure.after` counts from the first failure since the last successful write** of a value; a
  change made meanwhile does not restart it, and a successful write of the value ends it. A value
  that saves again lets its player log in at once, even after a kick.
- **`kick` concerns player stores only**: a failing value of a keyed store (a guild, say) is logged
  and retried, but kicks nobody, since no player owns it. `shutdown` counts values of every store.
- **A player kicked under `kick` keeps their data in memory**: the quit that follows does not
  forget the unsaved values, which are written once the database takes them and then forgotten.
- **`shutdown` stops the server once**, however many values keep failing, and only after
  `stores.save-failure.after`: a database restart shorter than `stores.save-failure.after` stops nothing.
- **A kept value is checked row by row**: when the database changed any column the value changes,
  the whole value goes to `unsaved/conflicts/`, also the columns that did not clash, so a row never
  mixes the two servers' changes. A value the database refuses at the start (a constraint) goes
  there too, with the database's message; the others are written.
- **A kept file waits for its database**: a file kept for another engine, location or table prefix
  stays untouched, with a warning at every start, until the plugin uses that database again.
- **A value of a store not made yet at the start** (a store made later than in a bean constructor)
  stays in the file for the next start.

## Migrations {/* #migrations */}

- **Line endings and a byte-order mark do not change the checksum**; any other edit does, a
  comment or a trailing space included.
- **`V01` and `V1` are the same version**, so both in one JAR are a duplicate.
- **A file with only comments, or an empty one, is a migration with no statements**: it is
  recorded in the history like any other, with `applied_statements` 0. This is the generic file of
  a step [only one engine needs](migrations.md#migration-overrides).
- **Adding or removing an engine override of an applied version** changes the file that version
  resolves to on that engine, so its checksum no longer matches and the start fails as for an edit.
- **Every engine directory is checked on every engine**: a broken `postgresql/` file fails the
  start on SQLite too, each file with the rules of its own engine.
- **A query override replaces queries by name, not files by name**: `postgresql/ranks.sql` may
  redefine a query of `profiles.sql`; the queries it leaves out keep their generic text.
- **A `-- name:` line inside a block comment or a multi-line string is not a marker**: markers are
  found by the same SQL reader that expands tokens, so only a line comment standing alone on its
  line starts a query.
- **Directives count only at the top** of a file, before its first statement.
- **Only `CREATE TRIGGER`, `PROCEDURE`, `FUNCTION` and `EVENT` bodies are kept whole**; any other
  body containing `;` needs `-- versatia: single-statement`, or a `$tag$` quote on PostgreSQL.
- **Positional `?` pass through migrations untouched**, for PostgreSQL's operators; `:name` is a
  problem, since migrations take no parameters.
- **A renamed plugin** (`name:` in `plugin.yml`) no longer finds its history rows: update the
  `plugin` column of its history table. With a prefix the message says so; without one the plugin
  starts as new and its first migration fails on the existing tables.
- **Backups are taken only of SQLite and H2 files that already have a history**, so the very first
  start makes none; two in the same second get `-2`, `-3`.

## Configuration {/* #configuration */}

- **The friendly-name prefix is the default** and is recorded in `database.yml` at the first open,
  so a later change of the friendly name renames nothing.
- **A non-empty prefix belongs to one plugin**: a second plugin under the same prefix (two plugins
  with one friendly name) fails the start. Plugins with `table-prefix: ''` share `schema_history`,
  each with its own rows, and a migration creating a table another of them owns fails before it
  runs, naming the owner. Tables recorded before the module kept that list, or created outside
  migrations, are not known to belong to anyone: the `CREATE TABLE` itself fails then.
- **`import-from` copies what the migrations create**: the tables of `CREATE TABLE` statements,
  followed through `ALTER TABLE ... RENAME TO`, `RENAME TABLE` and `DROP TABLE`. A table made by a
  procedure or by other SQL is not copied; other tables of the source database never are.
- **`import-from.table-prefix` renames on the way**: the source's tables under that prefix fill
  this plugin's tables under its own; without it the source is read under this plugin's prefix.
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
- **A `database.yml` without `table-prefix`** (written by hand, or shipped in the plugin's JAR)
  gets the friendly-name prefix, unless the plugin's history lives only without a prefix: then it
  keeps `''`, with a warning at every open. Until the database opens, `database.tablePrefix` is the
  friendly-name prefix. An explicit `table-prefix`, `''` included, always wins.
- **The module's `defaults` never reach `threads`, `pool` or where the data lives**, and a key a
  plugin's `database.yml` sets, even to the built-in value, is never overridden by them.
- **`pool.connection-timeout` under 250 ms is 250 ms**, `0` included, at the start and at a reload
  alike; the validation timeout follows it, up to 5 s.
- **The import runs once per target**: the `IMPORT` row of version 0 in the target's history skips
  it from then on; delete that row, with the copied rows, to import again.
- **An `h2` or `sqlite` connection of `connections.yml`** keeps its file in the module's folder, a
  plugin's own in the plugin's folder; an inline `import-from` reads files from the plugin's folder.
- **`engine: mysql` reaching MariaDB** <TwinEngines /> runs MariaDB's SQL and uses the `mariadb/` overrides, through
  the MySQL driver, without a warning; only the summary line, `MARIADB (engine: mysql) ...`, tells.
- **`default-connection` never moves a plugin that has data**: a plugin with a `database.db` and no
  `database.yml` stays on SQLite, with a warning.

## Shutdown and status {/* #shutdown-and-status */}

- **`thenSync` and `onFailureSync` steps are dropped once the plugin is disabled**; their futures fail.
- **A plugin enabled on a running server** (a plugin manager) loads and claims the players already
  online, but does not apply `onJoin` to them: they did not join now. See
  [Players already online](stores.md#players-already-online).
- **`/versatiadb status` lists a plugin under its friendly name**; messages and log lines use the
  `name:` of its `plugin.yml`.
- **A failed open is remembered for 5 seconds**: calls in that time fail with the same exception
  without trying again.
