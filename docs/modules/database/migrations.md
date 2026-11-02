---
counterpart: /admin/database/data
title: Migrations and named queries
description: The SQL files of a plugin JAR, engine overrides, the schema history, resuming, backups, locks and named queries.
---

# Migrations and named queries

import Audience from '@site/src/components/Audience';
import TwinEngines from '@site/src/components/TwinEngines';

SQL is code, so it ships **in the JAR**, next to the classes that use it, and is never copied to
the data folder for admins to edit. Two directories of `src/main/resources/database/` hold it:

```text
src/main/resources/database/
  migrations/
    V1__create_profiles.sql
    V2__create_payments.sql
    V3__index_payments_by_note.sql
    mysql/V3__index_payments_by_note.sql      MySQL, and MariaDB unless mariadb/ has its own
  queries/
    profiles.sql                              -- name: blocks, called with named(...)
    postgresql/profiles.sql                   replaces the blocks it names, on PostgreSQL only
```

:::developer

Migrations and named queries are part of the plugin's code: write them under
`src/main/resources/database/`, change an applied migration never, and ship every change as a new
version.

:::

:::admin

Nothing of this page is edited on the server. What a server admin meets, the `Applying ...` lines,
moving data, backups and the migration lock, is in
[Moving and backing up data](/admin/database/data) of the server admin guide.


:::

Every file is read and checked for the configured engine **when the plugin starts, before the
database is touched**, and every problem of every file is reported at once, each with its file and
line:

```text
Plugin Shop: 2 problems in the SQL files of the JAR:
  database/migrations/V2__create_payments.sql:2: unknown placeholder {idenity} in "…E TABLE {prefix}payments ( id {idenity}, payer {uuid} NOT NULL, payee…"; known: {prefix}, {uuid}, {bool}, {text}, {json}, {bytes}, {timestamp}, {now}, {identity}, {table_options}, {for-update}
  database/queries/profiles.sql:7: query "top-coins" is already defined at database/queries/ranks.sql:1; names are unique across all query files
```

Anything else under `database/` is a problem too: a file elsewhere than `migrations/` or `queries/`,
a file that is not `.sql`, a directory deeper than one engine directory, or an unknown engine
directory (`unknown engine directory "postgres"; did you mean "postgresql"?`); [Mistakes in the tree](#mistakes-in-the-tree) lists the messages.

## Migration files <Audience who="developer" /> {/* #migration-files */}

A migration is `V<n>__<words>.sql`: a version from 1 up, two underscores, and words of letters,
digits and `_` (`V1__create_profiles.sql`). Versions run in numeric order and may leave gaps;
`V01` and `V1` are the same version, so both at once are a duplicate, and `V0` is reserved. The
words, with `_` as spaces, are the description the history keeps.

A file holds any number of statements separated by `;`. A `;` inside a string, a quoted identifier,
a comment or a `$tag$` body does not end a statement, nor does one inside the `BEGIN ... END` of a
`CREATE TRIGGER`, `PROCEDURE`, `FUNCTION` or `EVENT`. Statements are written with
[tokens](configuration.md#tokens), so one file serves every engine:

```sql title="src/main/resources/database/migrations/V2__create_payments.sql"
CREATE TABLE {prefix}payments (
    id      {identity},
    payer   {uuid} NOT NULL,
    payee   {uuid} NOT NULL,
    coins   BIGINT NOT NULL,
    note    {text} NOT NULL,
    paid_at {timestamp} NOT NULL DEFAULT {now}
) {table_options};
```

Migrations take no parameters: a `:name` in one is reported as
`migrations take no parameters, but "..." has :name; write the values into the SQL`.

Comment lines at the very top of a file can change how it runs:

| Directive                         | Does                                                              |
|-----------------------------------|-------------------------------------------------------------------|
| `-- versatia: no-transaction`     | runs the statements one by one outside a transaction, for statements an engine refuses inside one (PostgreSQL's `CREATE INDEX CONCURRENTLY`) |
| `-- versatia: single-statement`   | sends the whole file as one statement, for a body the splitter cannot cut |

Any other `-- versatia:` line is a problem listing the two.

## Engine overrides <Audience who="developer" /> {/* #engine-overrides */}

When one engine needs other SQL, a file in its **engine directory** replaces the generic file on
that engine:

```sql title="src/main/resources/database/migrations/mysql/V3__index_payments_by_note.sql"
-- MySQL and MariaDB can index a LONGTEXT column only by a prefix
CREATE INDEX {prefix}payments_note ON {prefix}payments (note(64));
```

### Engine directories {/* #engine-directories */}

- They are named exactly `sqlite`, `h2`, `mysql`, `mariadb` and `postgresql`, in lower case, as
  `engine:` writes the engines; any other name is a problem.
- They sit directly in `database/migrations/` and `database/queries/`, one level deep:
  `database/migrations/mysql/V3__index_payments_by_note.sql`. A directory inside an engine
  directory, or an engine directory anywhere else, is a problem.
- They hold `.sql` files only, like their parents.

The engine in use looks for each file along a chain and takes the first it finds:

| Engine in use                                        | Looks in                                  |
|------------------------------------------------------|-------------------------------------------|
| `sqlite`                                             | `sqlite/`, then the generic file          |
| `h2`                                                 | `h2/`, then the generic file              |
| `mysql` <TwinEngines />                              | `mysql/`, then the generic file           |
| `mariadb`, also `engine: mysql` reaching a MariaDB server <TwinEngines /> | `mariadb/`, then `mysql/`, then the generic file |
| `postgresql`                                         | `postgresql/`, then the generic file      |

The engine in use is the one the module finds when it connects, so a MariaDB server configured as
`engine: mysql` runs the MariaDB chain. Every file is still checked at start with the rules of its
own directory's engine (its tokens, backslash escapes in MySQL strings), whichever engine the
server uses: a broken `postgresql/` file fails the start on SQLite too.

### Migration overrides {/* #migration-overrides */}

- An override has **exactly the name of a generic file**, version and words alike:
  `mysql/V3__index_payments_by_note.sql` replaces `V3__index_payments_by_note.sql`.
- The generic file must exist: it fixes the version's place in the order and is what every other
  engine runs.
- When only one engine needs a step, the generic file holds **only a comment**. A file with no
  statement (a comment, or nothing at all) is a valid migration: on the engines that run it,
  nothing is executed and the version is recorded in the history like any other, with
  `applied_statements` 0.

```sql title="src/main/resources/database/migrations/V4__tune_payments.sql"
-- Only PostgreSQL needs this step: see postgresql/V4__tune_payments.sql
```

```sql title="src/main/resources/database/migrations/postgresql/V4__tune_payments.sql"
ALTER TABLE {prefix}payments SET (autovacuum_vacuum_scale_factor = 0.02);
```

A complete tree, with what each engine runs:

```text
src/main/resources/database/
  migrations/
    V1__create_profiles.sql
    V2__create_payments.sql
    V3__index_payments_by_note.sql      SQLite, H2, PostgreSQL
    V4__tune_payments.sql               a comment: SQLite, H2, MySQL, MariaDB record V4 and run nothing
    mysql/
      V3__index_payments_by_note.sql    MySQL and MariaDB
    postgresql/
      V4__tune_payments.sql             PostgreSQL
  queries/
    profiles.sql                        top-coins, rank-of
    postgresql/
      ranks.sql                         rank-of again, for PostgreSQL only
```

The history's `script` column records the file that ran, with its engine directory, and messages
name an override with its variant:

| Engine             | `script` of V3                          | `script` of V4                    |
|--------------------|-----------------------------------------|-----------------------------------|
| SQLite, H2         | `V3__index_payments_by_note.sql`        | `V4__tune_payments.sql`           |
| MySQL, MariaDB     | `mysql/V3__index_payments_by_note.sql`  | `V4__tune_payments.sql`           |
| PostgreSQL         | `V3__index_payments_by_note.sql`        | `postgresql/V4__tune_payments.sql` |

```text
[Shop] Applying V3__index_payments_by_note.sql (variant mysql)
```

The checksum the history keeps is that of the file that ran. So adding, removing or editing an
override of a version a database has already applied changes what that version is there, and fails
the start like any [edit of an applied migration](#an-applied-migration-never-changes); put the
change in a new version.

### Mistakes in the tree {/* #mistakes-in-the-tree */}

| Mistake                                         | Message                                                  |
|-------------------------------------------------|----------------------------------------------------------|
| a misspelled engine directory                   | `Plugin Shop: database/migrations/postgres/V4__tune_payments.sql: unknown engine directory "postgres"; did you mean "postgresql"? Known: sqlite, h2, mysql, mariadb, postgresql` (without a close name: `unknown engine directory "pg"; known: ...`) |
| an engine directory in upper case (`MySQL/`)    | the same: `unknown engine directory "MySQL"; did you mean "mysql"? ...` |
| an override named differently                   | `Plugin Shop: database/migrations/mysql/V3__index_note.sql: replaces database/migrations/V3__index_payments_by_note.sql but is named differently; give it the same name` |
| an override without a generic file              | `Plugin Shop: database/migrations/postgresql/V4__tune_payments.sql: replaces no generic migration; add a V4__<words>.sql to database/migrations/ (it may hold only a comment)` |
| a directory inside an engine directory          | `Plugin Shop: database/migrations/mysql/old/V3__index.sql: is nested too deep; only the engine directories sqlite/, h2/, mysql/, mariadb/, postgresql/ may sit below migrations/` |
| a file outside `migrations/` and `queries/`     | `Plugin Shop: database/sql/V1__create_profiles.sql: unknown location; SQL files go to database/migrations/ or database/queries/` |
| a file that is not `.sql`                       | `Plugin Shop: database/migrations/notes.txt: is not an .sql file; only .sql files belong in database/migrations/` |
| a misnamed migration                            | `Plugin Shop: database/migrations/V3_index.sql: is not named V<n>__<words>.sql, such as V1__create_profiles.sql` |
| a query override of a name no generic file has  | `Plugin Shop: database/queries/postgresql/ranks.sql:1: query "rank-off" replaces no query of database/queries/; define it in a generic file first, or fix the name` |

With several problems, the message lists them all, one per line, as at the top of this page.

## How migrations run {/* #how-migrations-run */}

When the plugin starts and its JAR has migrations, the database opens at once and, before any of
your `@AutoInvoke` functions:

1. takes the [migration lock](/admin/database/data#the-migration-lock), so two servers sharing a database never
   migrate the same tables at once;
2. creates `{prefix}schema_history`, the history of these tables, if it is missing; plugins
   sharing a database and a prefix (or having none) share it, each with its own rows;
3. checks that a non-empty prefix is this plugin's (see [The table prefix](/admin/database/configuration#the-table-prefix));
4. compares the history with the JAR;
5. checks that no pending `CREATE TABLE` names a table another plugin of the same history owns
   (plugins sharing `table-prefix: ''`): `Plugin Bank: table "profiles" already exists and belongs to plugin Shop; set table-prefix in plugins/Bank/database.yml`;
6. backs the file up, for SQLite and H2 with data already in it;
7. applies what is pending, logging each file, and records with each version the tables the
   migrations leave behind up to it (`owned_tables`); then logs the summary.

```text
[Shop] Applying V2__create_payments.sql
[Shop] Applying V3__index_payments_by_note.sql
[Shop] SQLITE database.db, prefix shop_, schema V3 (applied V2, V3 in 41 ms)
```

Migrations run on a connection of their own, with no statement timeout, so a long one is never cut
short; any failure fails the start of the plugin.

### The history {/* #the-history */}

One row per plugin and applied version, in `{prefix}schema_history`:

| Column                 | Holds                                                           |
|------------------------|-----------------------------------------------------------------|
| `version`              | the version; `0` is the [import](/admin/database/data#changing-the-database) marker |
| `description`, `script`| the words of the file name; the file, with its engine directory (`mysql/V3__index_payments_by_note.sql`) |
| `checksum`             | the CRC32 of the file                                           |
| `applied_statements`, `prefix_checksum`, `success` | how far a file got, for [resuming](#failures-and-resuming) |
| `plugin`, `plugin_version`, `server` | who applied it: the `plugin.yml` name (with `version`, the key of the row) and version, and the server's `ip:port` |
| `installed_at`, `execution_ms` | when, and how long it took                              |
| `owned_tables`         | the tables the plugin's migrations up to this version leave behind |

#### The table {/* #the-history-table */}

The module creates the table itself, before the first migration, with the same tokens a migration
uses, so its column types follow the engine:

```sql title="What the module runs: CREATE TABLE of the history"
CREATE TABLE IF NOT EXISTS {prefix}schema_history (
    plugin             VARCHAR(64) NOT NULL,
    version            INTEGER NOT NULL,
    description        VARCHAR(200) NOT NULL,
    script             VARCHAR(255) NOT NULL,
    checksum           BIGINT NOT NULL,
    applied_statements INTEGER NOT NULL,
    prefix_checksum    BIGINT NOT NULL,
    success            {bool} NOT NULL,
    plugin_version     VARCHAR(64) NOT NULL,
    server             VARCHAR(255) NOT NULL,
    installed_at       {timestamp} NOT NULL,
    execution_ms       BIGINT NOT NULL,
    owned_tables       VARCHAR(4000) NOT NULL DEFAULT '',
    PRIMARY KEY (plugin, version)
) {table_options}
```

- **One table per prefix, keyed by plugin and version.** `shop_schema_history` holds the rows of
  `Shop`; plugins with `table-prefix: ''` in one database share the unprefixed `schema_history`,
  and each reads only the rows whose `plugin` is its `plugin.yml` name (cut to 64 characters). A
  row is written by upsert on `(plugin, version)`, so a resumed file updates its own row.
- **A row per applied version**, written in the same transaction as the file on SQLite and
  PostgreSQL. On MySQL, MariaDB and H2 it is written after every statement but the last with
  `success` false and `applied_statements` counting what ran, and `prefix_checksum`, the CRC32 of
  those statements, lets the next start [resume](#failures-and-resuming) only if they are
  unchanged; the last statement writes `success` true.
- **`checksum` is the CRC32 of the file** that ran, its override if one did, with a byte-order mark
  removed and line endings made `\n`; it is compared at every start
  ([An applied migration never changes](#an-applied-migration-never-changes)).
- **`owned_tables`** lists, comma-separated, the tables the migrations up to that version create
  and keep (followed through renames and drops), cut at the last whole name within 4000
  characters. The latest row of each plugin is how plugins sharing one unprefixed history learn
  [whose a table is](/admin/database/configuration#the-table-prefix). A table made before this column existed
  gets it added, empty, at the next open.
- **The schema version** the summary line and `database.status` report is the highest `version`
  above 0 with `success` true.

#### The import row {/* #the-import-row */}

A finished [`import-from`](/admin/database/data#changing-the-database) writes one more row of the
plugin, **version `0`**, into the history of the target database:

| Column                  | In the import row                                           |
|-------------------------|-------------------------------------------------------------|
| `version`               | `0`, a version no migration may have                        |
| `script`                | `IMPORT`                                                    |
| `description`           | the source, as the log names it: `SQLITE database.db`, `MYSQL db.example.net:3306/survival` |
| `applied_statements`    | the number of tables copied                                 |
| `checksum`, `prefix_checksum` | `0`                                                   |
| `success`               | true                                                        |
| `plugin`, `plugin_version`, `server`, `installed_at`, `execution_ms` | who imported, when, and how long the copy took |
| `owned_tables`          | empty: the import owns no table                             |

It is written once the copy has committed and the identity columns continue after the copied
keys, so a failed import leaves no row and the next start tries again. At every later start the
module finds the row before it opens the source and skips the import, logging
`Already imported from SQLITE database.db on 2026-10-25; you may remove import-from`; that is what
makes `import-from` safe to leave in `database.yml`. The row never counts as a schema version, and
no other plugin's ownership check reads it.

:::admin

How to import again is explained to the server admin in
[Importing again](/admin/database/data#importing-again).


:::

### An applied migration never changes {/* #an-applied-migration-never-changes */}

A file that ran is part of every database that applied it, so the history keeps its checksum, a
CRC32 of its text with only a byte-order mark removed and line endings made `\n`. Any other edit,
even to a comment, fails the start:

```text
Plugin Shop: migration V1__create_profiles.sql was changed after it was applied (checksum 81723 != 55120); restore it and put the change in a new migration (during development, delete plugins/Shop/database.db instead)
```

```sql title="Wrong: V1__create_profiles.sql edited after it ran"
CREATE TABLE {prefix}profiles (
    uuid      {uuid} NOT NULL PRIMARY KEY,
    coins     BIGINT NOT NULL DEFAULT 0,
    -- error-next-line
    title     VARCHAR(32) NOT NULL DEFAULT ''
) {table_options};
```

```sql title="Right: V4__add_profile_title.sql"
-- fix-next-line
ALTER TABLE {prefix}profiles ADD COLUMN title VARCHAR(32) NOT NULL DEFAULT '';
```

On MySQL, MariaDB and PostgreSQL the development hint reads `drop the tables of Shop and their schema_history rows instead`.

### Order and versions {/* #order-and-versions */}

| The history and the JAR                         | Result                                                    |
|-------------------------------------------------|-----------------------------------------------------------|
| a new file below the highest applied version    | fails: `migration V2__add_index.sql is new, but the tables of Shop are already at V3; give it a version above V3, since applied versions never go back` |
| an applied version missing from the JAR, below its highest file | fails: `migration V2__create_payments.sql was applied to the tables of Shop but is missing from the JAR; restore it` |
| applied versions above the JAR's highest file   | another server runs a newer version of the plugin: `migrations.future-versions: warn` (the default) logs it and starts, `fail` refuses to start |

`warn` keeps a rolling update across servers sharing one database working: the servers updated
first add `V4`, the others keep running `V3` against the same tables.

### Failures and resuming {/* #failures-and-resuming */}

On **SQLite and PostgreSQL** each file runs in one transaction together with its history row, so a
file that fails leaves nothing behind:

```text
Plugin Shop: V2__create_payments.sql failed at statement 2 of 3 (line 9) on SQLite: [SQLITE_ERROR] SQL error or missing database (near "TABEL": syntax error); nothing of it was applied; fix the file and restart
```

**MySQL, MariaDB and H2** commit every DDL statement on its own, so a file runs statement by
statement and the history records how far it got. The next start, after you fixed the file,
resumes at the statement that failed, provided the statements before it are unchanged:

```text
Plugin Shop: V3__homes.sql failed at statement 2 of 3 (line 5) on MySQL: Duplicate column name 'world'; statement 1 is applied; fix the file and restart to resume at statement 2, or fix the database by hand and delete the V3 row of Shop from schema_history
```

```text
[Shop] Resuming V3__homes.sql at statement 2 of 3
```

On these engines keep to one DDL statement per migration where you can, and prefer
`IF NOT EXISTS` forms, so a half-applied file is easy to reason about. A `no-transaction` file runs
statement by statement on every engine.

## Named queries <Audience who="developer" /> {/* #named-queries */}

Longer queries live in `database/queries/*.sql`, each under a `-- name:` line, and run by name with
`named(name, ...parameters)`, which returns a [statement](statements.md#running-sql) like `sql`:

```sql title="src/main/resources/database/queries/profiles.sql"
-- Queries of the profiles table.

-- name: top-coins
SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT :limit

-- name: rank-of
SELECT COUNT(*) + 1 FROM {prefix}profiles
WHERE coins > (SELECT coins FROM {prefix}profiles WHERE uuid = :uuid);
```

```kotlin
val top = database.named("top-coins", "limit" to 10).list<TopEntry>()
```

### The file format {/* #query-file-format */}

`-- name: <name>` is this module's own convention, and it is an ordinary SQL line comment: a query
file stays plain SQL, which an editor highlights and a database tool opens like any script.

- **The marker** is a line of its own: `--`, `name`, `:` and the name, with optional spaces or tabs
  around each part (`--name:top-coins` works too); `name` is written in lower case. Every other
  comment is only a comment.
- **A query** runs from the line after its marker to the next marker or the end of the file.
  Leading whitespace is dropped, and so are a trailing `;`, trailing comments and trailing
  whitespace; comments inside the query stay in its text, where they do no harm.
- **Before the first marker** only comments and blank lines may stand, such as a header comment.
- **One statement per query**: a block holding two statements, or none, is a problem.
- **Markers are found by the SQL reader**, so a line `-- name: x` inside a block comment or a
  multi-line string is part of the query around it, not a marker.

### Files and names {/* #query-files-and-names */}

- Query files live in `src/main/resources/database/queries/`, under any `.sql` name, as many as you
  like; the file a query sits in only organises them. Like migrations they are code: they ship in
  the JAR, are never copied to the data folder and are not read again at a reload.
- Names are **kebab-case**: words of lower-case letters and digits joined by single `-`, such as
  `top-coins`, `rank-of` or `stats-v2`.
- Names are **unique across all query files** of the plugin; `named` takes only the name.
- A query takes [parameters](statements.md#parameters) and [tokens](configuration.md#how-tokens-expand)
  like inline SQL, bound at the call: `named("rank-of", "uuid" to uuid)`, or `.bind(...)` and
  `.bindProperties(...)` on the statement it returns.

### Engine overrides of queries {/* #query-overrides */}

A file in an [engine directory](#engine-directories) of `queries/` replaces, on that engine, the
queries it defines, **one by one, by name**: its file name does not matter, and the queries it does
not define keep their generic text. Each name it defines must be defined by a generic file too.

```sql title="src/main/resources/database/queries/postgresql/ranks.sql"
-- name: rank-of
SELECT rank FROM (
    SELECT uuid, RANK() OVER (ORDER BY coins DESC) AS rank FROM {prefix}profiles
) ranked WHERE uuid = :uuid
```

### Checked at start {/* #queries-checked-at-start */}

Every query of every file, the engine directories included, is parsed when the plugin starts and
before its database opens, so a mistake fails the start, not the first call:

| Mistake                                   | Message (after `Plugin Shop: database/queries/profiles.sql:<line>: `) |
|-------------------------------------------|-----------------------------------------------------------|
| SQL before the first marker               | `SQL before the first "-- name:" marker; start each query with -- name: <kebab-name>` |
| a name that is not kebab-case             | `query name "top_coins" is not kebab-case; use lowercase letters, digits and -, such as top-coins` |
| a name used twice                         | `query "top-coins" is already defined at database/queries/ranks.sql:1; names are unique across all query files` |
| a block with no SQL                       | `query "top-coins" is empty`                              |
| a block with two statements               | `query "top-coins" holds more than one statement; give each its own -- name: block` |
| an unknown token                          | `unknown placeholder {uid} in "..."; known: {prefix}, ...` |
| `?` and `:names` mixed                    | `"..." mixes positional ? and named :parameters; use only :names` |

### An unknown name {/* #unknown-query-name */}

`named` with a name the JAR does not define throws an `UnknownQueryException` at the call, so a
typo passes the build and fails only when that line runs; a constant holding the name
(`const val TOP_COINS = "top-coins"`) makes it a compile error instead:

| Situation                                           | Message                                               |
|-----------------------------------------------------|-------------------------------------------------------|
| close names exist (at most two edits away, or one name starts with the other) | `Plugin Shop: database/queries defines no query "top-coin"; close names: top-coins` |
| none is close                                       | `Plugin Shop: database/queries defines no query "richest"; its queries: rank-of, top-coins` (the first ten, then `…`) |
| the JAR has no named queries                        | `Plugin Shop: database/queries defines no query "richest"; the JAR has no named queries; add a database/queries/<file>.sql with -- name: richest blocks` |
