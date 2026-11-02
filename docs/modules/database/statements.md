---
title: Statements and mapping
description: Running SQL with named parameters, reading rows into classes, inserting and upserting rows, types and codecs.
---

# Statements and mapping

import Audience from '@site/src/components/Audience';
import TwinEngines from '@site/src/components/TwinEngines';

<Audience who="developer" below />

The module is SQL-first: you write the SQL, with `:named` parameters and portable
[`{tokens}`](configuration.md#tokens), and Kotlin types come in and out. Every call on this page
that reaches the database **blocks** the calling thread; on the server thread that is allowed only
while the plugin starts, reloads or stops, and anywhere else the call belongs in
[`database.async { }`](background.md#background-work). Building a statement and binding it never block.

## Running SQL {/* #running-sql */}

`database.sql(sql, ...parameters)` makes a `Statement`; one terminal call runs it:

```kotlin
import com.github.marcoral.versatia.database.list
import com.github.marcoral.versatia.database.single
import com.github.marcoral.versatia.database.singleOrNull

val top = sql("SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT :limit", "limit" to 10).list<TopEntry>()
val players = sql("SELECT COUNT(*) FROM {prefix}profiles").single<Long>()
val coins = sql("SELECT coins FROM {prefix}profiles WHERE uuid = :uuid", "uuid" to uuid).singleOrNull<Long>()
sql("UPDATE {prefix}profiles SET name = :name WHERE uuid = :uuid", "name" to name, "uuid" to uuid).update()
```

| Terminal                       | Returns                                                            |
|--------------------------------|--------------------------------------------------------------------|
| `list<T>()`, `list { row -> }` | every row, [mapped](#reading-rows) to `T` or through your function |
| `single<T>()`, `single { }`    | the one row; none or several is a `MappingException`               |
| `singleOrNull<T>()`, `singleOrNull { }` | the only row or null; several is a `MappingException`     |
| `forEach { row -> }`           | nothing; streams the rows without collecting them                  |
| `exists()`                     | true when the query returns at least one row                       |
| `update()`                     | the affected row count of an `INSERT`, `UPDATE` or `DELETE`        |
| `updateAndGetKey("id")`        | the generated key of an `INSERT`, read the engine's way (`RETURNING` on SQLite and PostgreSQL, generated keys elsewhere) |
| `execute()`                    | nothing; for any statement, DDL included                           |
| `batch(items) { }`             | the affected counts of one JDBC [batch](#batches)                  |

A statement is not thread-safe and is meant to be run once: make a new one for every use. `named(name, ...)`
does the same for a query kept in the JAR, see [Named queries](migrations.md#named-queries).

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

1. expands the [tokens](configuration.md#how-tokens-expand) and turns every `:name` into a JDBC
   `?` placeholder, giving `SELECT coins FROM profiles WHERE name = ?`. This text depends only on
   your code and the settings, never on a value;
2. hands that text to `Connection.prepareStatement`, so it is parsed, and what is a keyword, a
   table, a column or a value is decided, before any value is known;
3. binds each value to its `?` with `PreparedStatement.setString`, `setLong`, `setObject` and the
   like, chosen from the value's Kotlin [type](#types).

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

The same holds for the table names of the [builders](#writing-rows) and stores and for the keys of
a `Map` row: they are column and table names written into the SQL, so they come from your code,
never from a player, and must be plain names (letters, digits and `_`, not starting with a digit),
or the call fails with a `SqlTemplateException` before any SQL runs.

| Binding                              | Does                                                               |
|--------------------------------------|--------------------------------------------------------------------|
| `sql(text, "a" to 1, "b" to x)`      | binds every pair by the value's runtime type                       |
| `.bind("owner", owner)`              | binds with the static type of the expression, so a null `UUID?` is still bound as a UUID |
| `.bindAll(map)`                      | binds every entry by its runtime type                              |
| `.bindProperties(profile)`           | binds each property of a data class to the parameter named after it, in camelCase, snake_case or its [`@Column`](#column-names) name; properties without a parameter are skipped, and a `Map` works like `bindAll` |

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
`{uuid}`, `{timestamp}`, `{json}` and the other [tokens](configuration.md#tokens) to what the
engine in use needs, in inline SQL, migrations and named queries alike, but never in the table
names of builders and stores, which get the prefix by themselves. A statement with an unknown
token fails when it is made, by `sql(...)`:

```text
Plugin Shop: unknown placeholder {uid} in "SELECT {uid} FROM {prefix}profiles"; known: {prefix}, {uuid}, {bool}, {text}, {json}, {bytes}, {timestamp}, {now}, {identity}, {table_options}, {for-update}
```

[How tokens expand](configuration.md#how-tokens-expand) gives the exact rules: where they expand
and where not, literal braces, JDBC escapes, and where tokens may be written.

## Reading rows {/* #reading-rows */}

`list<T>()`, `single<T>()` and `singleOrNull<T>()` map each row to `T`:

- a **column type** (`Long`, `String`, `UUID`, `Instant`, an enum, a [type with a codec](#your-own-types)...)
  is read from the only column; a result with more columns is an error
  (`the result has 2 columns (name, coins), but Long takes one; select one column or map to a class`);
- **any other class** is built through its primary constructor: each parameter takes the column
  named like it in snake_case (`lastSeen` → `last_seen`), its [`@Column`](#column-names) name, or
  its own name, ignoring case. A column missing from the result leaves a parameter with a default
  value at its default; without a default it is an error naming the property and the column looked for.

Nullability comes from the type: a NULL read into a non-null type fails with
`Plugin Shop: column last_seen is NULL, but Profile.lastSeen (Instant) is not nullable`, so a
nullable column is a nullable property, or `singleOrNull<Long>()` and `list<Long?>()` where a value
may be missing.

For anything else, read the row yourself. A `Row` is the current row of the result, valid only
inside the function it was passed to:

```kotlin
import com.github.marcoral.versatia.database.get

val balances = sql("SELECT uuid, coins, last_seen FROM {prefix}profiles").list { row ->
    val coins: Long = row["coins"]                     // the type, nullability included, comes from the target
    val lastSeen: Instant? = row["last_seen"]
    row.uuid("uuid") to coins
}
```

| On a `Row`                              | Gives                                                       |
|-----------------------------------------|-------------------------------------------------------------|
| `row["column"]`                         | the column as the type it is assigned to                    |
| `string`, `int`, `long`, `double`, `boolean`, `uuid`, `instant`, `bytes` | the column as that type; each has an `...OrNull` twin |
| `row.get("column", codec)`              | the column decoded by a [codec](#your-own-types), null for NULL |
| `row.into<Profile>()`                   | the whole row, mapped as `list<Profile>()` would            |
| `columns`, `"coins" in row`             | the column labels in select order; whether one is there     |

Columns are matched by their label, ignoring case; an unknown one is
`the result has no column coin; its columns: uuid, coins, last_seen`. `uuid()` and `instant()` read
`{uuid}` and `{timestamp}` columns whatever the engine stores (text, a native UUID, epoch
milliseconds or a `DATETIME`).

## Writing rows {/* #writing-rows */}

The builders write a data class, or a `Map` of column names to values, into a table **under your
prefix**: you name the table without it.

```kotlin
data class Payment(val id: Long = 0, val payer: UUID, val payee: UUID, val coins: Long, val note: String)

insert("payments", Payment(payer = a, payee = b, coins = 5, note = "tip"))           // INSERT INTO {prefix}payments ...
val id = insertAndGetKey("payments", Payment(payer = a, payee = b, coins = 5, note = "tip"))
val paid = insertReturning("payments", Payment(payer = a, payee = b, coins = 5, note = "tip")) // paid.id is the generated key
upsert("profiles", profile, "uuid")                                                   // insert, or update the other columns
```

```kotlin title="Wrong: copying the key into the row by hand"
// error-next-line
val payment = Payment(payer = a, payee = b, coins = 5, note = "tip").let { it.copy(id = insertAndGetKey("payments", it)) }
```

```kotlin title="Right"
// fix-next-line
val payment = insertReturning("payments", Payment(payer = a, payee = b, coins = 5, note = "tip"))
```

```kotlin title="Wrong: the builder adds the prefix itself"
// error-next-line
insert("{prefix}payments", payment)
```

```kotlin title="Right"
// fix-next-line
insert("payments", payment)
```

| Builder                                 | Does                                                           |
|-----------------------------------------|----------------------------------------------------------------|
| `insert(table, row)`                    | inserts every primary-constructor property (defaults included, so the table needs a column for each); returns the rows inserted |
| `insertAndGetKey(table, row, "id")`     | inserts and returns the generated key; a key property holding `0` or null is left out of the insert, so the database generates it |
| `insertReturning(table, row, "id")`     | inserts like `insertAndGetKey` and returns a copy of the row with the generated key in its key property (a `Long`, an `Int`, or a type stored as one); a `Map` comes back with the key added |
| `upsert(table, row, "uuid", ...more)`   | inserts, or updates the other columns of the row with the same key columns; always returns 1, whatever the engine counts |

The upsert is written the engine's way (`ON CONFLICT` on SQLite and PostgreSQL, `ON DUPLICATE KEY`
on MySQL and MariaDB, `MERGE` on H2); its key columns need a primary key or a unique index.

## Types {/* #types */}

These Kotlin types map to a column without help:

| Kotlin                                  | Stored as                                                  |
|-----------------------------------------|------------------------------------------------------------|
| `String`, `Int`, `Long`, `Double`, `Boolean`, `BigDecimal`, `ByteArray` | the matching SQL type                   |
| `Short`, `Byte`, `Float`                | an integer or a double                                     |
| `UUID`                                  | a `{uuid}` column: text or a native UUID, per engine       |
| `Instant`                               | a `{timestamp}` column, in UTC, truncated to milliseconds   |
| `LocalDate`, `LocalDateTime`            | a date and a date-time, as given (no time zone)            |
| `java.time.Duration`, `kotlin.time.Duration` | milliseconds, as a `Long`                             |
| `Json`                                  | a `{json}` column: the text, bound so that PostgreSQL's `JSONB` takes it |
| an enum                                 | its name, as text; reading an unknown name fails, listing the known ones |
| a `@JvmInline` value class              | its underlying value; its `init` checks run when it is read |

Collections, `ItemStack`, `Location`, `Component` and your own classes are not columns: store them
as `Json` with the serializer of your choice, or give them a codec.

## Your own types {/* #your-own-types */}

A `ColumnCodec` stores a type as one the module binds itself: `String`, `Int`, `Long`, `Double`,
`Boolean`, `ByteArray`, `UUID`, `Instant` or `Json`. It is an `object` or a class with a no-arg
constructor:

```kotlin
import com.github.marcoral.versatia.database.mapping.ColumnCodec

object BlockPosText : ColumnCodec<BlockPos, String> {
    override val storedAs = String::class
    override fun encode(value: BlockPos) = "${value.x},${value.y},${value.z}"
    override fun decode(stored: String) = stored.split(',').map(String::toInt).let { (x, y, z) -> BlockPos(x, y, z) }
}
```

Use it for one property with `@Column(codec = ...)`, or for every statement, row and store of your
plugin with `database.registerType`, called in a bean constructor so that it applies before the first use:

```kotlin
import com.github.marcoral.versatia.database.mapping.Column
import com.github.marcoral.versatia.database.registerType

data class Home(val owner: UUID, @Column(codec = BlockPosText::class) val position: BlockPos)

@LocalBean
class Homes(database: Database) {
    init {
        database.registerType(BlockPosText)
    }
}
```

The order is `@Column(codec)`, then a registered type (the exact class first, then the nearest
registered supertype; two equally near are an error naming both), then the built-in types, then
enums and value classes. A property of a type with none
of these fails with
`Plugin Shop: Home.position is a BlockPos, which the module cannot store; add @Column(codec = ...) or register a codec with database.registerType`.

### Column names {/* #column-names */}

`@Column(name = "...")` maps a constructor parameter to a column that is not its name in
snake_case, for reading, for the builders, for `bindProperties` and for stores:

```kotlin
data class Account(@Column(name = "player_uuid") val owner: UUID, val balance: Long)
```

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
