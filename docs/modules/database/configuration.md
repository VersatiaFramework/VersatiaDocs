---
title: Engines
counterpart: /admin/database/configuration
description: The engines, MySQL and MariaDB, and the database.yml a plugin may ship.
---
# Engines

import Audience from '@site/src/components/Audience';
import TwinEngines from '@site/src/components/TwinEngines';

A plugin's code never names an engine: it writes SQL with tokens, and the server admin picks where
the data lives. Without any configuration that is a SQLite file in the plugin's data folder.

:::admin

Where the data lives is set in `database.yml`, `connections.yml` and the module's `config.yml`,
described in [Database configuration](/admin/database/configuration) and
[Connections and defaults](/admin/database/connections) of the server admin guide. The tokens and the SQL of a plugin are in its JAR and are not the admin's to edit.


:::

The tokens that make one SQL text right for every engine are on [Tokens](tokens.md).

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
| [`ssl:`](/admin/database/connections#ssl)               | `sslMode` `DISABLED`, `PREFERRED`, `REQUIRED`, `VERIFY_IDENTITY`; `disabled` also allows public key retrieval | `sslMode` `disable`, `trust`, `trust`, `verify-full`: no "TLS if available", so `preferred` asks for TLS | <Audience who="admin" /> |
| idle connections             | the probe reads `@@SESSION.wait_timeout`; `pool.max-lifetime` stays 30 s below it, and idle connections are pinged ([Pool and timeouts](/admin/database/connections#pool-and-timeouts)) | the same | <Audience who="admin" /> |
| backups                      | none by the module; use the server's own tools | the same | <Audience who="admin" /> |
| [migration lock](/admin/database/data#the-migration-lock) | `GET_LOCK('versatia:<database>:<plugin>:<prefix>', <lock-timeout in seconds>)`, then `RELEASE_LOCK` | the same | <Audience who="admin" /> |
| connect failures             | hints for access denied (`GRANT`), an unknown database (`CREATE DATABASE ... utf8mb4`) and public key retrieval ([Troubleshooting](/admin/database/operations#troubleshooting)) | the same, and a TLS handshake hint instead of public key retrieval | <Audience who="admin" /> |
| session                      | every connection runs `SET time_zone = '+00:00'`, so `{timestamp}` and `{now}` are UTC | the same | <Audience who="developer" /> |
| [engine directories](engine-overrides.md#engine-directories) | `mysql/`, then the generic file | `mariadb/`, then `mysql/`, then the generic file | <Audience who="developer" /> |
| `{text}`, `{bytes}`          | `LONGTEXT`, `LONGBLOB`                  | the same                                | <Audience who="developer" /> |
| `{json}`                     | `JSON`, checked by the server           | `LONGTEXT` (MariaDB's `JSON` is an alias of it) | <Audience who="developer" /> |
| `{uuid}`, `{timestamp}`, `{now}`, `{identity}` | `CHAR(36)`, `DATETIME(3)`, `(UTC_TIMESTAMP(3))`, `BIGINT AUTO_INCREMENT PRIMARY KEY` | the same | <Audience who="developer" /> |
| `{table_options}`            | `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` | the same | <Audience who="developer" /> |
| quoting                      | `"..."` is a string literal, backslashes escape in strings, names are quoted with `` `...` `` ([How tokens expand](tokens.md#how-tokens-expand)) | the same | <Audience who="developer" /> |
| indexes on `{text}`          | a `LONGTEXT` column is indexed only by a prefix length, `note(64)`, written in a `mysql/` [override](engine-overrides.md) | the same; the `mysql/` file serves it | <Audience who="developer" /> |
| [`upsert`](rows.md#writing-rows) | `INSERT ... AS new ON DUPLICATE KEY UPDATE c = new.c` | `INSERT ... ON DUPLICATE KEY UPDATE c = VALUES(c)` | <Audience who="developer" /> |
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

## The plugin's database.yml {/* #database-yml */}

The server admin sets where a plugin's data lives in `plugins/<Plugin>/database.yml`, which the
module writes at the first open. Every key is in [Database configuration](/admin/database/configuration),
`connections.yml` and the module's `config.yml` in [Connections and defaults](/admin/database/connections),
both in the server admin guide.

:::developer

A plugin may ship its own copy as `src/main/resources/resources/database.yml`;
[resource extraction](/docs/resources) puts it in place on the first start, and the module then
writes none.

:::

## Corner cases {/* #corner-cases */}

- **`engine: mysql` reaching MariaDB** <TwinEngines /> runs MariaDB's SQL and uses the `mariadb/` overrides, through
  the MySQL driver, without a warning; only the summary line, `MARIADB (engine: mysql) ...`, tells.
