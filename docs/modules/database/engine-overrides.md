# Engine overrides

import Audience from '@site/src/components/Audience';
import TwinEngines from '@site/src/components/TwinEngines';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

<Audience who="developer" below />

The [migrations](migrations.md) and [named queries](queries.md) of a JAR are written once for every
engine, in portable SQL with [tokens](tokens.md).

When one engine needs other SQL, a file in its **engine directory** replaces the generic file on
that engine:

```sql title="src/main/resources/database/migrations/mysql/V3__index_payments_by_note.sql"
-- MySQL and MariaDB can index a LONGTEXT column only by a prefix
CREATE INDEX {prefix}payments_note ON {prefix}payments (note(64));
```

## Engine directories {/* #engine-directories */}

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

## Migration overrides {/* #migration-overrides */}

- An override has **exactly the name of a generic file**, version and words alike:
  `mysql/V3__index_payments_by_note.sql` replaces `V3__index_payments_by_note.sql`.
- The generic file must exist: it fixes the version's place in the order and is what every other
  engine runs.
- When only one engine needs a step, the generic file holds **only a comment**. A file with no
  statement (a comment, or nothing at all) is a valid migration: on the engines that run it,
  nothing is executed and the version is recorded in the history like any other, with
  `applied_statements` 0.

<CodeCards>
<CodeCard title="V4__tune_payments.sql">

```sql
-- Only PostgreSQL needs this step: see postgresql/V4__tune_payments.sql
```

</CodeCard>
<CodeCard title="postgresql/V4__tune_payments.sql">

```sql
ALTER TABLE {prefix}payments SET (autovacuum_vacuum_scale_factor = 0.02);
```

</CodeCard>
</CodeCards>

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
the start like any [edit of an applied migration](migrations.md#an-applied-migration-never-changes); put the
change in a new version.

## Mistakes in the tree {/* #mistakes-in-the-tree */}

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

## Corner cases {/* #corner-cases */}

- **Adding or removing an engine override of an applied version** changes the file that version
  resolves to on that engine, so its checksum no longer matches and the start fails as for an edit.
- **Every engine directory is checked on every engine**: a broken `postgresql/` file fails the
  start on SQLite too, each file with the rules of its own engine.
