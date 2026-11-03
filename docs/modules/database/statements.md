---
title: Statements
description: Running SQL with named parameters, tokens, batches, timeouts and raw JDBC.
---
# Statements

import Audience from '@site/src/components/Audience';
import TwinEngines from '@site/src/components/TwinEngines';

<Audience who="developer" below />

The module is SQL-first: you write the SQL, with `:named` parameters and portable
[`{tokens}`](tokens.md), and Kotlin types come in and out. Every call on this page
that reaches the database **blocks** the calling thread; on the server thread that is allowed only
while the plugin starts, reloads or stops, and anywhere else the call belongs in
[`database.async { }`](background.md#background-work). Building a statement and binding it never block.

Reading rows into classes, writing classes as rows and the types a column may hold are on [Rows and
types](rows.md).

## Running SQL {/* #running-sql */}

`database.sql(sql, ...parameters)` makes a `Statement`; one terminal call runs it:

```kotlin
val top = sql("SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT :limit", "limit" to 10).list<TopEntry>()
val players = sql("SELECT COUNT(*) FROM {prefix}profiles").single<Long>()
val coins = sql("SELECT coins FROM {prefix}profiles WHERE uuid = :uuid", "uuid" to uuid).singleOrNull<Long>()
sql("UPDATE {prefix}profiles SET name = :name WHERE uuid = :uuid", "name" to name, "uuid" to uuid).update()
```

| Terminal                       | Returns                                                            |
|--------------------------------|--------------------------------------------------------------------|
| `list<T>()`, `list { row -> }` | every row, [mapped](rows.md#reading-rows) to `T` or through your function |
| `single<T>()`, `single { }`    | the one row; none or several is a `MappingException`               |
| `singleOrNull<T>()`, `singleOrNull { }` | the only row or null; several is a `MappingException`     |
| `forEach { row -> }`           | nothing; streams the rows without collecting them                  |
| `exists()`                     | true when the query returns at least one row                       |
| `update()`                     | the affected row count of an `INSERT`, `UPDATE` or `DELETE`        |
| `updateAndGetKey("id")`        | the generated key of an `INSERT`, read the engine's way (`RETURNING` on SQLite and PostgreSQL, generated keys elsewhere) |
| `execute()`                    | nothing; for any statement, DDL included                           |
| `batch(items) { }`             | the affected counts of one JDBC [batch](#batches)                  |

A statement is not thread-safe and is meant to be run once: make a new one for every use. `named(name, ...)`
does the same for a query kept in the JAR, see [Named queries](queries.md).

## Parameters {/* #parameters */}

`:name` (a letter or `_`, then letters, digits and `_`) is a parameter wherever it is not inside a
string literal, a quoted identifier, a comment or a `$tag$` body; `::` (a PostgreSQL cast) and `:=`
are left alone. A name used twice binds both places. Values are never written into the SQL text, so
a player's input is always data:

```kotlin title="Wrong: the name becomes SQL"
// error-next-line
sql("SELECT coins FROM {prefix}profiles WHERE name = '$name'").singleOrNull<Long>()
```

```kotlin title="Right"
// fix-next-line
sql("SELECT coins FROM {prefix}profiles WHERE name = :name", "name" to name).singleOrNull<Long>()
```

### Why a parameter is never SQL {/* #why-a-parameter-is-never-sql */}

The statement text and the values travel to the database **separately**. For the right snippet
above the module:

1. expands the [tokens](tokens.md#how-tokens-expand) and turns every `:name` into a JDBC
   `?` placeholder, giving `SELECT coins FROM profiles WHERE name = ?`. This text depends only on
   your code and the settings, never on a value;
2. hands that text to `Connection.prepareStatement`, so it is parsed, and what is a keyword, a
   table, a column or a value is decided, before any value is known;
3. binds each value to its `?` with `PreparedStatement.setString`, `setLong`, `setObject` and the
   like, chosen from the value's Kotlin [type](rows.md#types).

A bound value fills the place of one literal and nothing else. A chat message, a sign line or a
command argument reading `'; DROP TABLE profiles; --` is compared with the names, character by
character, and matches nobody; no quoting or escaping in your code is needed, or wanted.

| Engine     | How the values reach the database                                          |
|------------|----------------------------------------------------------------------------|
| SQLite, H2 | the statement is compiled inside the server's process, then the values are bound to the compiled statement |
| MySQL <TwinEngines /> | server-side prepared statements (the module turns on `useServerPrepStmts`): the text is prepared, the values follow in the binary protocol |
| PostgreSQL | the extended query protocol: the text in one message, the values in another |
| MariaDB <TwinEngines /> | the MariaDB driver sends text and values in one message, each value escaped by the driver itself for its bound type; the value still never becomes SQL, since it is never pasted by your code |

Concatenation also costs speed: each distinct text is parsed again, by the module (which keeps the
512 most recent statement texts of a plugin parsed) and by the driver's cache of prepared
statements, while one parameterised text serves every value.

### What a parameter cannot be {/* #what-a-parameter-cannot-be */}

A `?` stands for one value, so these are never parameters:

| Not a parameter                                 | Because                                          | Instead |
|-------------------------------------------------|--------------------------------------------------|---------|
| a table or column name (`FROM :table`)          | names are decided when the text is parsed; the server rejects a `?` there | write the name into the SQL, chosen from names you wrote ([below](#dynamic-identifiers)) |
| `ORDER BY :column`                              | binds a constant: no error, but every row sorts alike, so the order is arbitrary | the same |
| `ASC` or `DESC`, an operator, any keyword       | syntax, not a value                              | the same |
| a `{token}`                                     | expanded into the text before it is prepared; it comes from the engine and the settings, never from a value, so it is safe | nothing to do |
| `:name` inside `'...'`, `"..."` or a comment    | not a parameter at all: `'Hello :name'` stays that text | bind the whole text: `:greeting` with `"greeting" to "Hello $name"` |
| a list in `IN (...)`                            | one `?` per element, made for you from a `Collection` | bind the collection |

#### Dynamic identifiers {/* #dynamic-identifiers */}

When a player picks a column or an order, map the choice to SQL text you wrote, through a
whitelist (an enum or a `when`), and never paste the choice itself:

```kotlin title="Wrong: the player's choice becomes SQL"
// error-next-line
sql("SELECT name, coins FROM {prefix}profiles ORDER BY $column $direction LIMIT 10").list<TopEntry>()
```

```kotlin title="Right: the choice only selects one of the texts you wrote"
enum class Ranking(val orderBy: String) { RICHEST("coins DESC"), POOREST("coins ASC"), RECENT("last_seen DESC") }

val ranking = Ranking.entries.firstOrNull { it.name.equals(choice, ignoreCase = true) } ?: Ranking.RICHEST
// fix-next-line
sql("SELECT name, coins FROM {prefix}profiles ORDER BY ${ranking.orderBy} LIMIT :limit", "limit" to 10).list<TopEntry>()
```

The same holds for the table names of the [builders](rows.md#writing-rows) and stores and for the keys of
a `Map` row: they are column and table names written into the SQL, so they come from your code,
never from a player, and must be plain names (letters, digits and `_`, not starting with a digit),
or the call fails with a `SqlTemplateException` before any SQL runs.

| Binding                              | Does                                                               |
|--------------------------------------|--------------------------------------------------------------------|
| `sql(text, "a" to 1, "b" to x)`      | binds every pair by the value's runtime type                       |
| `.bind("owner", owner)`              | binds with the static type of the expression, so a null `UUID?` is still bound as a UUID |
| `.bindAll(map)`                      | binds every entry by its runtime type                              |
| `.bindProperties(profile)`           | binds each property of a data class to the parameter named after it, in camelCase, snake_case or its [`@Column`](rows.md#column-names) name; properties without a parameter are skipped, and a `Map` works like `bindAll` |

A `Collection` or an array (but `ByteArray`, which is one value) expands to one placeholder per
element, which is what `IN` takes:

```kotlin
sql("SELECT name FROM {prefix}profiles WHERE uuid IN (:ids)", "ids" to online).list<String>()
```

An empty collection is an error rather than `IN ()`, which some engines reject and `IN (NULL)`,
which turns `NOT IN` upside down:

```kotlin title="Wrong: fails with :ids is an empty collection"
// error-next-line
val names = sql("SELECT name FROM {prefix}profiles WHERE uuid IN (:ids)", "ids" to ids).list<String>()
```

```kotlin title="Right"
// fix-next-line
val names = if (ids.isEmpty()) emptyList() else sql("SELECT name FROM {prefix}profiles WHERE uuid IN (:ids)", "ids" to ids).list<String>()
```

Mistakes fail before anything reaches the database, with the statement and its parameters:

| Mistake                         | Message                                                          |
|---------------------------------|------------------------------------------------------------------|
| an unknown name                 | `Plugin Shop: "SELECT coins FROM {prefix}profiles WHERE uuid = :uuid" has no parameter :id; its parameters: :uuid` |
| a parameter left unbound        | `Plugin Shop: parameter :limit is not bound in "SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT :limit"; its parameters: :limit` |
| an empty collection             | `Plugin Shop: :ids is an empty collection; check for it before running the query` |
| a value of a type the module cannot store | `Plugin Shop: :item is a org.bukkit.inventory.ItemStack, which the module cannot bind; bind Json, or register a codec with database.registerType` |

Positional `?` parameters are accepted only in a statement you do not bind: they reach the driver as
written. Binding one fails with `uses positional ?, which cannot be bound; name its parameters`,
and a statement mixing `?` and `:names` fails with `mixes positional ? and named :parameters; use only :names`.

## Tokens {/* #tokens */}

`{prefix}` expands to your plugin's [table prefix](/admin/database/configuration#the-table-prefix), and
`{uuid}`, `{timestamp}`, `{json}` and the other [tokens](tokens.md) to what the
engine in use needs, in inline SQL, migrations and named queries alike, but never in the table
names of builders and stores, which get the prefix by themselves. A statement with an unknown
token fails when it is made, by `sql(...)`:

```text
Plugin Shop: unknown placeholder {uid} in "SELECT {uid} FROM {prefix}profiles"; known: {prefix}, {uuid}, {bool}, {text}, {json}, {bytes}, {timestamp}, {now}, {identity}, {table_options}, {for-update}
```

[How tokens expand](tokens.md#how-tokens-expand) gives the exact rules: where they expand
and where not, literal braces, JDBC escapes, and where tokens may be written.

## Batches {/* #batches */}

`batch(items)` runs one statement once per item in a single JDBC batch, binding each item's
properties by default:

```kotlin
sql("INSERT INTO {prefix}payments (payer, payee, coins, note) VALUES (:payer, :payee, :coins, :note)").batch(payments)
sql("DELETE FROM {prefix}profiles WHERE uuid = :uuid").batch(gone) { bind("uuid", it) }
```

It returns the affected count of each item; drivers that rewrite a batch into one statement (MySQL,
MariaDB, PostgreSQL) may report `-2`, "succeeded, count unknown", instead. Items whose collections
expand to different sizes cannot share one batch and fail with
`the items of a batch expand collections to different sizes in "..."; run them one by one`.

## Timeouts {/* #timeouts */}

Every statement gets `query-timeout` of [`database.yml`](/admin/database/configuration#database-yml) (30 s by
default); `timeout(...)` overrides it for one statement, and `Duration.ZERO` removes the limit:

```kotlin
sql("DELETE FROM {prefix}payments WHERE paid_at < :before", "before" to cutoff).timeout(5.minutes).update()
```

JDBC counts the timeout in whole seconds, so it is rounded up. A statement that runs out of time
fails with a `QueryException` of [kind](operations.md#failure-kinds) `TIMEOUT`.

## Raw JDBC {/* #raw-jdbc */}

`connection { c -> }` hands over a `java.sql.Connection` for what the API does not cover: the
connection of the current [transaction](background.md#transactions), or one borrowed for the block.
Do not close it and do not change its auto-commit; the module returns it to the pool. Calls through
`database` inside the block join the same connection.

## Corner cases {/* #corner-cases */}

- **`ORDER BY :column` does not sort**: it binds a constant, the same for every row. Choose the
  column from texts you wrote ([Dynamic identifiers](#dynamic-identifiers)).
- **Every `?` outside literals and comments is a positional parameter.** A statement using
  PostgreSQL's JSONB operators `?`, `?|` and `?&` therefore cannot also have `:named` parameters;
  use the functions `jsonb_exists`, `jsonb_exists_any` and `jsonb_exists_all` there.
- **A null bound through a pair has no type**: `"owner" to null` is bound as an untyped NULL.
  `bind("owner", owner)` keeps the declared type of `owner`, which engines that check parameter types
  (PostgreSQL) may need.
- **A `ByteArray` is one value**, never a collection to expand.
- **`0` means the driver's limit, not no limit**: on MySQL, MariaDB and PostgreSQL a connection
  that waits longer than twice `query-timeout` (at least 2 minutes) for the server is broken, so
  with `timeout(Duration.ZERO)` or `query-timeout: 0` a statement running longer than 120 s still
  fails, as a broken connection. Raise `query-timeout` for long work.
- **`connection { }` ends in auto-commit**: if the block turned auto-commit off, what it left
  uncommitted is rolled back.
