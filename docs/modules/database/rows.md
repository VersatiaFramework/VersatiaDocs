# Rows and types

import Audience from '@site/src/components/Audience';

<Audience who="developer" below />

A [statement](statements.md) maps rows to Kotlin types both ways: it reads a row into a column type
or a class, a builder writes a class as a row, and codecs store types of your own.

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
import dev.versatia.database.get

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
import dev.versatia.database.mapping.ColumnCodec

object BlockPosText : ColumnCodec<BlockPos, String> {
    override val storedAs = String::class
    override fun encode(value: BlockPos) = "${value.x},${value.y},${value.z}"
    override fun decode(stored: String) = stored.split(',').map(String::toInt).let { (x, y, z) -> BlockPos(x, y, z) }
}
```

Use it for one property with `@Column(codec = ...)`, or for every statement, row and store of your
plugin with `database.registerType`, called in a bean constructor so that it applies before the first use:

```kotlin
import dev.versatia.database.mapping.Column
import dev.versatia.database.registerType

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

## Corner cases {/* #corner-cases */}

- **Table names of builders and stores, and the keys of a `Map` row, are SQL**: they are written
  into the statement as names, not bound, so they never come from a player. Each must be a plain
  name once prefixed, letters, digits and `_` not starting with a digit (`[A-Za-z_][A-Za-z0-9_]*`);
  any other fails with a `SqlTemplateException` naming it, before any SQL runs:
  `Plugin Shop: column name "coins total" is not allowed; names written into SQL by builders and stores are letters, digits and _, not starting with a digit ([A-Za-z_][A-Za-z0-9_]*)`.
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
