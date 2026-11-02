---
title: Engines and tokens
counterpart: /admin/database/configuration
description: The engines, MySQL and MariaDB, the tokens, and the database.yml a plugin may ship.
---

# Engines and tokens

import Audience from '@site/src/components/Audience';
import TwinEngines from '@site/src/components/TwinEngines';

A plugin's code never names an engine: it writes SQL with tokens, and the server admin picks where
the data lives. Without any configuration that is a SQLite file in the plugin's data folder.

:::admin

Where the data lives is set in `database.yml`, `connections.yml` and the module's `config.yml`,
described in [Database configuration](/admin/database/configuration) of the server
admin guide. The tokens and the SQL of a plugin are in its JAR and are not the admin's to edit.


:::

## Engines {/* #engines */}

<div className="table-nowrap">

| Engine       | Data                                                  | Driver                     | Oldest server |
|--------------|-------------------------------------------------------|----------------------------|---------------|
| `sqlite`     | a file in the plugin's folder, `database.db`          | the server's               | SQLite 3.35   |
| `h2`         | a file in the plugin's folder; `file: database.db` is stored as `database.mv.db` | the module's libraries | H2 2.1 |
| `mysql` <TwinEngines /> | a MySQL server, port 3306 by default       | the server's (Connector/J) | MySQL 8.0.19  |
| `mariadb` <TwinEngines /> | a MariaDB server, port 3306 by default   | the module's libraries     | MariaDB 10.3  |
| `postgresql` | a PostgreSQL server, port 5432 by default             | the module's libraries     | PostgreSQL 12 |

</div>

The names are case-insensitive, and `database.engine` tells the plugin which one it runs on. Before the
pool is built the module opens one connection to look at the server, and adapts to what it finds:

- `engine: mysql` means MySQL **or MariaDB**: on a MariaDB server the module speaks MariaDB's SQL,
  with no warning, and the summary line names what it found:
  `MARIADB (engine: mysql) db.example.net:3306/survival, prefix shop_, schema V3`; `database.engine`
  then reports `MARIADB`. `engine: mariadb` is only needed to use the MariaDB driver of the
  module's libraries instead of the server's Connector/J.
- A server **older than the minimum** fails the start: `Plugin Shop: MySQL 5.7.44 is too old; the module needs MySQL 8.0.19 or newer`.
  MySQL 8.0.19 is the first release with the upsert form the module writes; Paper's Connector/J
  supports no MySQL before 8.0 either.

Each engine is set up the same way everywhere: SQLite runs with one connection, write-ahead
logging, foreign keys on and a 10 s busy timeout; H2 folds unquoted names to lower case like the
others do; MySQL and MariaDB sessions run in UTC. Write table and column names in lower-case
snake_case and they mean the same on every engine.

## MySQL and MariaDB {/* #mysql-and-mariadb */}

MySQL and MariaDB are **twin engines**: MariaDB began as a fork of MySQL, speaks its protocol and
most of its SQL, and the module treats the two as one family that shares tokens, quoting, locks
and error handling, with a few differences of its own. Wherever this documentation marks a row
<TwinEngines />, the rule comes from this section.

| What                         | MySQL                                   | MariaDB                                 | Concerns |
|------------------------------|-----------------------------------------|-----------------------------------------|----------|
| `engine:`                    | `mysql`                                 | `mariadb`, or `mysql`, which reaches MariaDB too ([below](#engine-mysql-on-mariadb)) | <Audience who="admin" /> |
| driver                       | the server's Connector/J (`jdbc:mysql:`), tuned by the module: server-side prepared statements, a statement cache, rewritten batches | the MariaDB driver of the module's libraries (`jdbc:mariadb:`), with its own defaults | <Audience who="admin" /> |
| oldest server                | 8.0.19: the first with the row alias of the upsert below (`{now}` as a `DEFAULT` needs 8.0.13) | 10.3 | <Audience who="admin" /> |
| [`ssl:`](/admin/database/configuration#ssl)               | `sslMode` `DISABLED`, `PREFERRED`, `REQUIRED`, `VERIFY_IDENTITY`; `disabled` also allows public key retrieval | `sslMode` `disable`, `trust`, `trust`, `verify-full`: no "TLS if available", so `preferred` asks for TLS | <Audience who="admin" /> |
| idle connections             | the probe reads `@@SESSION.wait_timeout`; `pool.max-lifetime` stays 30 s below it, and idle connections are pinged ([Pool and timeouts](/admin/database/configuration#pool-and-timeouts)) | the same | <Audience who="admin" /> |
| backups                      | none by the module; use the server's own tools | the same | <Audience who="admin" /> |
| [migration lock](/admin/database/data#the-migration-lock) | `GET_LOCK('versatia:<database>:<plugin>:<prefix>', <lock-timeout in seconds>)`, then `RELEASE_LOCK` | the same | <Audience who="admin" /> |
| connect failures             | hints for access denied (`GRANT`), an unknown database (`CREATE DATABASE ... utf8mb4`) and public key retrieval ([Troubleshooting](/admin/database/operations#troubleshooting)) | the same, and a TLS handshake hint instead of public key retrieval | <Audience who="admin" /> |
| session                      | every connection runs `SET time_zone = '+00:00'`, so `{timestamp}` and `{now}` are UTC | the same | <Audience who="developer" /> |
| [engine directories](migrations.md#engine-directories) | `mysql/`, then the generic file | `mariadb/`, then `mysql/`, then the generic file | <Audience who="developer" /> |
| `{text}`, `{bytes}`          | `LONGTEXT`, `LONGBLOB`                  | the same                                | <Audience who="developer" /> |
| `{json}`                     | `JSON`, checked by the server           | `LONGTEXT` (MariaDB's `JSON` is an alias of it) | <Audience who="developer" /> |
| `{uuid}`, `{timestamp}`, `{now}`, `{identity}` | `CHAR(36)`, `DATETIME(3)`, `(UTC_TIMESTAMP(3))`, `BIGINT AUTO_INCREMENT PRIMARY KEY` | the same | <Audience who="developer" /> |
| `{table_options}`            | `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` | the same | <Audience who="developer" /> |
| quoting                      | `"..."` is a string literal, backslashes escape in strings, names are quoted with `` `...` `` ([How tokens expand](#how-tokens-expand)) | the same | <Audience who="developer" /> |
| indexes on `{text}`          | a `LONGTEXT` column is indexed only by a prefix length, `note(64)`, written in a `mysql/` [override](migrations.md#engine-overrides) | the same; the `mysql/` file serves it | <Audience who="developer" /> |
| [`upsert`](statements.md#writing-rows) | `INSERT ... AS new ON DUPLICATE KEY UPDATE c = new.c` | `INSERT ... ON DUPLICATE KEY UPDATE c = VALUES(c)` | <Audience who="developer" /> |
| upsert count                 | an update counts 2; `upsert` returns 1 anyway | the same | <Audience who="developer" /> |
| generated keys               | read from the driver's generated keys, no `RETURNING` | the same | <Audience who="developer" /> |
| batches                      | rewritten into one statement, so a count may be `-2` ([Batches](statements.md#batches)) | the driver's own batching, the same `-2` | <Audience who="developer" /> |
| failure kinds                | from vendor codes: 1062, 1451, 1452, 1048, 3819, 1213, 1205, 3024 ([Failure kinds](operations.md#failure-kinds)) | the same, with 4025 for a violated `CHECK` | <Audience who="developer" /> |
| DDL in migrations            | not transactional: a file runs statement by statement and [resumes](migrations.md#failures-and-resuming) at the statement that failed | the same | <Audience who="developer" /> |

### `engine: mysql` on MariaDB {/* #engine-mysql-on-mariadb */}

Before the pool is built, the module asks the server for `VERSION()` on one connection. When the
product name or the version names MariaDB (`10.11.6-MariaDB`, also behind MariaDB's `5.5.5-`
prefix), `engine: mysql` runs as MariaDB:

| With `engine: mysql` on a MariaDB server | Follows                                               |
|------------------------------------------|-------------------------------------------------------|
| the SQL: tokens, upsert, failure kinds   | MariaDB                                               |
| the engine directories                   | MariaDB's chain: `mariadb/`, `mysql/`, generic        |
| the oldest server                        | MariaDB's: `MariaDB 10.2.44 is too old; the module needs MariaDB 10.3 or newer` |
| the driver, its tuning and the `ssl:` mapping | MySQL's: Connector/J, as configured             |
| the summary line and `database.engine`   | MariaDB, with the configured engine: `MARIADB (engine: mysql) db.example.net:3306/survival, prefix shop_, schema V3`; `database.engine` is `MARIADB` |

There is no warning: a MariaDB server behind `engine: mysql` is a supported set-up, not a mistake.
`engine: mariadb` is needed only to use the MariaDB driver instead of Connector/J.

:::developer

Write one migration and one query for both twins. When MySQL needs other SQL, the override goes
into `mysql/`, and MariaDB runs it as well; a `mariadb/` file is only for what MariaDB alone needs,
and it then wins over `mysql/` on MariaDB.

:::

## Tokens <Audience who="developer" /> {/* #tokens */}

Tokens make one SQL text right for every engine. They expand in inline SQL, migrations and named
queries:

<div className="table-nowrap">

| Token             | SQLite | H2 | MySQL <TwinEngines /> | MariaDB <TwinEngines /> | PostgreSQL |
|-------------------|--------|----|-------|---------|------------|
| `{prefix}`        | the plugin's [table prefix](/admin/database/configuration#the-table-prefix) | the same | the same | the same | the same |
| `{uuid}`          | `TEXT` | `UUID` | `CHAR(36)` | `CHAR(36)` | `UUID` |
| `{bool}`          | `INTEGER` | `BOOLEAN` | `BOOLEAN` | `BOOLEAN` | `BOOLEAN` |
| `{text}`          | `TEXT` | `CHARACTER VARYING` | `LONGTEXT` | `LONGTEXT` | `TEXT` |
| `{json}`          | `TEXT` | `CHARACTER VARYING` | `JSON` | `LONGTEXT` | `JSONB` |
| `{bytes}`         | `BLOB` | `BLOB` | `LONGBLOB` | `LONGBLOB` | `BYTEA` |
| `{timestamp}`     | `INTEGER` (epoch milliseconds, UTC) | `TIMESTAMP(3) WITH TIME ZONE` | `DATETIME(3)` (UTC) | `DATETIME(3)` (UTC) | `TIMESTAMPTZ(3)` |
| `{now}`           | the current time in epoch milliseconds | `(CURRENT_TIMESTAMP(3))` | `(UTC_TIMESTAMP(3))` | `(UTC_TIMESTAMP(3))` | `(CURRENT_TIMESTAMP(3))` |
| `{identity}`      | `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY` | `BIGINT AUTO_INCREMENT PRIMARY KEY` | the same as MySQL | the same as H2 |
| `{table_options}` | nothing | nothing | `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` | the same as MySQL | nothing |
| `{for-update}`    | nothing | `FOR UPDATE` | `FOR UPDATE` | `FOR UPDATE` | `FOR UPDATE` |

</div>

These eleven are every token there is. Any other `{word}` is an error, while the JDBC escapes
(`{fn ...}`, `{d '...'}`, `{ts '...'}`, `{call ...}`, `{oj ...}`) are not tokens: they reach the
driver as written, next to the tokens of the same statement.

```sql title="src/main/resources/database/queries/payments.sql"
-- name: payments-since
SELECT {fn UCASE(note)} AS note, coins
FROM {prefix}payments
WHERE paid_at >= {ts '2026-01-01 00:00:00'}
ORDER BY paid_at DESC
```

| In the query                        | Is                                  | On MySQL with the prefix `shop_`  |
|-------------------------------------|-------------------------------------|-----------------------------------|
| `{prefix}`                          | a token                             | `shop_`                           |
| `{fn UCASE(note)}`                  | a JDBC escape: a space after `fn`   | unchanged; the driver turns it into `UCASE(note)` |
| `{ts '2026-01-01 00:00:00'}`        | a JDBC escape: a space after `ts`   | unchanged; the driver turns it into a timestamp literal |

What tells them apart is the rule [below](#how-tokens-expand): a token has no space between its
braces.

`{now}` is valid as a column `DEFAULT`, which is what it is for: `paid_at {timestamp} NOT NULL DEFAULT {now}`.
Many types need no token, since every engine reads them alike: `BIGINT`, `INTEGER`,
`VARCHAR(n)`, `DOUBLE PRECISION`, `DECIMAL(p,s)`, `TRUE` and `FALSE`, `LIMIT`, `ON DELETE CASCADE`,
`CHECK`. `{text}` is `LONGTEXT` on MySQL and MariaDB, which those engines index only by a prefix:
an [engine override](migrations.md#engine-overrides) writes `note(64)` for them.

### How tokens expand {/* #how-tokens-expand */}

A statement text is expanded once for the engine in use, before it is prepared: an inline
statement when `sql(...)` makes it (the parsed text is kept, so the next statement with the same
text skips this), a migration or a named query when the plugin starts. Step by step:

1. The module's SQL reader walks the text and knows where each literal ends, the way the engine
   in use reads it: string literals `'...'` (`''` is a quote inside one; `E'...'` takes backslash
   escapes, and so does every string on MySQL and MariaDB), quoted identifiers `"..."` and
   `` `...` `` (on MySQL and MariaDB `"..."` is a string literal, as their default `sql_mode` reads
   it, and only `` `...` `` quotes a name), line comments `-- ...`, block comments `/* ... */` and
   PostgreSQL dollar-quoted bodies `$$ ... $$` or `$tag$ ... $tag$`.
2. Outside all of these, `{name}` is a token: a `{`, a letter or `_`, then letters, digits, `_` and
   `-`, and a `}` with no space anywhere. It is replaced by the engine's text from the
   [table above](#tokens), `{prefix}` by the [table prefix](/admin/database/configuration#the-table-prefix).
3. Inside a quoted identifier tokens expand too, so `"{prefix}profiles"` names the prefixed table.
   Inside a dollar-quoted body they expand as outside, so a function body can name
   `{prefix}profiles`; the string literals and comments inside the body stay as written. Inside a
   string literal or a comment nothing expands.
4. `{{` writes `{` and `}}` writes `}`, outside literals, inside quoted identifiers and inside
   dollar-quoted bodies.
5. A `{` that does not start a token (a JDBC escape such as `{fn UCASE(name)}`, `{d '2026-10-25'}`
   or `{call refresh()}`, all with a space after the keyword) stays as written, for the driver.
6. Any other `{word}` is an error. Nothing else of the text changes; `:name` parameters are
   turned into `?` in the same pass (see [Parameters](statements.md#parameters)).

| Written                                         | On MySQL with the prefix `shop_`                  |
|-------------------------------------------------|---------------------------------------------------|
| `CREATE TABLE {prefix}profiles (uuid {uuid} NOT NULL) {table_options}` | `CREATE TABLE shop_profiles (uuid CHAR(36) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` |
| `` SELECT * FROM `{prefix}profiles` ``          | `` SELECT * FROM `shop_profiles` ``               |
| `SELECT '{prefix}profiles'`                     | unchanged: a string literal                       |
| `SELECT "{prefix}profiles"`                     | unchanged: a string literal on MySQL and MariaDB  |
| `-- {uuid} column`                              | unchanged: a comment                              |
| `SELECT '{"coins": 1}'`                         | unchanged: braces in a literal need no escape     |
| `` SELECT `{{raw}}` ``                          | `` SELECT `{raw}` ``                              |
| `SELECT {fn UCASE(name)} FROM {prefix}profiles` | `SELECT {fn UCASE(name)} FROM shop_profiles`      |

An unknown token names itself, shows the text around it and lists the known ones. In inline SQL
it is a `SqlTemplateException` from `sql(...)`; in a migration or a named query it fails the start,
with the file and line:

```text
Plugin Shop: unknown placeholder {uid} in "SELECT {uid} FROM {prefix}profiles"; known: {prefix}, {uuid}, {bool}, {text}, {json}, {bytes}, {timestamp}, {now}, {identity}, {table_options}, {for-update}
```

```text
Plugin Shop: database/migrations/V2__create_payments.sql:2: unknown placeholder {idenity} in "…E TABLE {prefix}payments ( id {idenity}, payer {uuid} NOT NULL, payee…"; known: {prefix}, {uuid}, {bool}, {text}, {json}, {bytes}, {timestamp}, {now}, {identity}, {table_options}, {for-update}
```

A PostgreSQL function body in `$$ ... $$` expands its tokens, so it names the plugin's tables with
`{prefix}` like any statement. A string literal inside the body stays as written, so SQL the body
builds as text (for `EXECUTE`) never gets the prefix; write that SQL as a statement of the body:

```sql title="Wrong: postgresql/V5__reset_cache.sql, {prefix} inside the EXECUTE string is not expanded"
CREATE FUNCTION {prefix}reset_cache() RETURNS void AS $$
BEGIN
    -- error-next-line
    EXECUTE 'TRUNCATE {prefix}cache';
END $$ LANGUAGE plpgsql;
```

```sql title="Right: a plain statement of the body, whose {prefix} expands"
CREATE FUNCTION {prefix}reset_cache() RETURNS void AS $$
BEGIN
    -- fix-next-line
    TRUNCATE {prefix}cache;
END $$ LANGUAGE plpgsql;
```

### Where tokens work {/* #where-tokens-work */}

| Text                                                      | Tokens | Checked                                  |
|-----------------------------------------------------------|--------|------------------------------------------|
| `sql(...)`, anywhere: `async`, `transaction`, store transactions | yes | when the statement is made        |
| [named queries](migrations.md#named-queries)              | yes    | at start, every file of every engine directory |
| [migrations](migrations.md#migration-files)               | yes    | at start, every file of every engine directory |
| table names of `insert`, `insertAndGetKey`, `insertReturning`, `upsert`, `store` and `playerStore` | no: a plain table name, to which the prefix is added | — |
| values bound to parameters                                | no: a value is never SQL | —                              |
| SQL you pass to JDBC in `connection { }`                  | no: it goes to the driver as written; build names from `database.tablePrefix` | — |

### The `{prefix}` token {/* #the-prefix-token */}

`{prefix}` expands to the plugin's [table prefix](/admin/database/configuration#the-table-prefix) exactly, with nothing added,
so it is written right before a name: `{prefix}profiles`. The prefix is the plugin's friendly name
in snake_case plus `_` by default, so `{prefix}profiles` is `shop_profiles` for `Shop`, unless
`table-prefix` in `database.yml` sets another one, or `''` for none. Give every name the plugin creates
the prefix, indexes, triggers and functions included: PostgreSQL and SQLite want index names
unique in the whole schema, not per table.

## The plugin's database.yml {/* #database-yml */}

The server admin sets where a plugin's data lives in `plugins/<Plugin>/database.yml`, which the
module writes at the first open. Every key, `connections.yml` and the module's `config.yml` are in
[Database configuration](/admin/database/configuration) of the server admin guide.

:::developer

A plugin may ship its own copy as `src/main/resources/resources/database.yml`;
[resource extraction](/docs/resources) puts it in place on the first start, and the module then
writes none.

:::
