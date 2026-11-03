---
title: Stores
description: Write-behind caches of rows, keyed stores, what a save writes, references, store transactions and the table.
---
# Stores

import Audience from '@site/src/components/Audience';

<Audience who="developer" below />

A **store** is a write-behind cache of rows: values are immutable instances of a class, read and
replaced in memory on any thread, and written to the database in the background, column by
column, only where they changed. A **player store** is a store keyed by player UUID that follows
the players: loaded before a player joins, saved when they quit.

| Store operation                                     | Touches                                                 |
|-----------------------------------------------------|---------------------------------------------------------|
| `get`, `getValue`, `set`, `update`, `tryUpdate`, `contains`, `keys` | memory only; safe from any thread, the server thread included |
| `load`, `save`, `saveAll`, `evict`, `delete`, `transaction` | the database, on your plugin's database threads; they return a [`DatabaseFuture`](background.md#background-work) |

How a player store is declared, loaded at the login and saved, and what happens when a save fails,
is on [Player stores](player-stores.md).

## Keyed stores {/* #keyed-stores */}

`database.store(table, key) { create }` is a store of any key, loaded on demand:

```kotlin
import dev.versatia.database.store

data class Guild(val id: Long, val name: String = "", val bank: Long = 0)

@LocalBean
class Guilds(database: Database) : KeyedStore<Long, Guild> by database.store("guilds", Guild::id) { Guild(it) }
```

| On a store                    | Does                                                              |
|-------------------------------|-------------------------------------------------------------------|
| `load(key)`                   | the cached value, or the row, or `create(key)` when there is none; cached from then on |
| `store[key]`, `getValue(key)` | the cached value; null, or an `EntryNotLoadedException`, when it is not loaded |
| `update(key) { }`, `tryUpdate(key) { }` | replaces a loaded value with its change; `tryUpdate` lets the change refuse by returning null |
| `store[key] = value`          | replaces the value; a key that is not loaded becomes a new value, written as an upsert at the next save |
| `save(key)`, `saveAll()`      | writes the change of one key, or of every key (returning how many were written) |
| `evict(key)`                  | saves the key if it changed, then forgets it, unless it changed again meanwhile |
| `delete(key)`                 | deletes the row and forgets the key, with the rows that [extend it](#stores-that-reference-each-other) |

A value made by `create` is written only once it is changed: looking a guild up never inserts it.
Values nobody touched for `stores.idle-expiry` are saved and forgotten, and loaded again by the
next `load`. `update` and `tryUpdate` of a key that is not loaded fail with
`Plugin Shop: guilds has not loaded 7; load it first with guilds.load(key)`:

```kotlin title="Wrong: the guild may not be cached"
// error-next-line
guilds.update(id) { it.copy(bank = it.bank + amount) }
```

```kotlin title="Right"
// fix-next-line
guilds.load(id).thenSync { guilds.update(id) { it.copy(bank = it.bank + amount) } }
```

## What a save writes {/* #what-a-save-writes */}

A store compares each changed value with the value last written:

| The value                          | Statement                                                    |
|------------------------------------|--------------------------------------------------------------|
| never written (created, or set for a key not loaded) | an upsert of every column                  |
| changed since it was written       | `UPDATE profiles SET coins = ? WHERE uuid = ?`, only the columns that differ; an upsert when the row is gone |
| set to an equal value              | nothing                                                      |

Values whose changed columns are the same go into one JDBC batch, and loading the online players
at start reads them in chunks of 500. Saves write absolute values, so a save retried after a lost
acknowledgement writes the same thing twice and never adds twice.

Since a save is a diff of whole values, values must be **immutable**: change them with `copy`, never
by mutating a property of the cached instance, which the store would neither see nor save.

## Stores that reference each other {/* #stores-that-reference-each-other */}

A table may point to another store's table with a foreign key, as statistics kept apart from the
profile they belong to:

```sql title="V2__create_statistics.sql"
CREATE TABLE {prefix}statistics (
    uuid  {uuid} NOT NULL PRIMARY KEY REFERENCES {prefix}profiles (uuid),
    kills BIGINT NOT NULL DEFAULT 0
) {table_options};
```

The stores read the foreign keys between their tables when the database opens and keep to them,
whatever order your beans make the stores in:

| When                  | What the stores do                                                     |
|-----------------------|------------------------------------------------------------------------|
| every save            | `profiles` rows before `statistics` rows, so a new player's profile exists before the row that points to it |
| a player quits        | both values of the player go in one transaction: both are written, or neither |
| a save fails          | the other keys are still written; the values of the failing key stay changed in both stores, for the next save |
| `statistics.save(key)`, `saveAll()`, `evict(key)`, `statistics.transaction(...)` | write the never-written values of `profiles` first, so new players need no autosave before them |
| `profiles.delete(uuid)` | deletes the `statistics` row of the same `uuid` first, in the same transaction, and forgets both values |
| `statistics.delete(uuid)` | deletes the `statistics` row only                                  |

A delete takes along only the rows that extend a row one to one: those of stores whose key column
references the deleted store's key column, as `statistics.uuid` does. Rows that point to a row
from another column (`members.guild REFERENCES guilds (id)`) are left to the database: without
`ON DELETE` it refuses the delete while they exist ([Corner cases](#corner-cases)).

A table that extends another store's row this way is a [best practice](best-practices.md#extension-references-key):
the stores then write and delete the two together.

## Store transactions {/* #store-transactions */}

`store.transaction(keys) { }` changes several values and runs SQL in **one database transaction**,
for online and offline players alike; the cached values change only if it commits:

```kotlin
import dev.versatia.database.store.get
import dev.versatia.database.store.update

data class Payment(val id: Long = 0, val payer: UUID, val payee: UUID, val coins: Long, val note: String)

fun payBounty(victim: Player, killer: Player): DatabaseFuture<Payment?> = profiles.transaction(victim, killer, retries = 2) {
    val bounty = this[victim].coins / 10
    if (bounty == 0L) return@transaction null
    update(victim) { it.copy(coins = it.coins - bounty) }
    update(killer) { it.copy(coins = it.coins + bounty) }
    insertReturning("payments", Payment(payer = victim.uniqueId, payee = killer.uniqueId, coins = bounty, note = "bounty"))
}
```

- The transaction **holds** its keys: two transactions on the same key run one after the other,
  and saves skip a held key until it is released.
- `this[key]` is the value as the transaction found it; a key that is not cached is loaded, or
  created, and stays cached afterwards. `this[key] = value` is written at once, in the transaction,
  and `update(key) { ... }` does both in one call, returning the new value. In a player store, a
  `Player` or `OfflinePlayer` stands for its UUID in all three (imports from
  `dev.versatia.database.store`).
- The receiver runs SQL like any [transaction](background.md#transactions) (`sql`, `insert`,
  `afterCommit`, ...), all in the same database transaction.
- **On commit** the written values become the cached ones. Changes made meanwhile on the server
  thread, a kill reward through `update`, are applied again on top of them, so none is lost or
  counted twice; `get` sees such a change at once.
- **On rollback** the cached values keep those changes and nothing of the transaction.
- While a key is held, `tryUpdate` refuses (returns null): a change that may refuse cannot be
  re-applied on top of a result that is not known yet. Retry it a moment later.
- With `retries`, a deadlock reruns the block from the values as they were when the keys were taken.

Every key the block uses must be passed to `transaction(...)`:

```kotlin title="Wrong: fails with this profiles.transaction does not hold ...; pass every key it uses to transaction(...)"
// error-next-line
profiles.transaction(buyer) {
    this[buyer.uniqueId] = this[buyer.uniqueId].let { it.copy(coins = it.coins - price) }
    this[seller.uniqueId] = this[seller.uniqueId].let { it.copy(coins = it.coins + price) }
}
```

```kotlin title="Right"
// fix-next-line
profiles.transaction(buyer, seller) {
    this[buyer.uniqueId] = this[buyer.uniqueId].let { it.copy(coins = it.coins - price) }
    this[seller.uniqueId] = this[seller.uniqueId].let { it.copy(coins = it.coins + price) }
}
```

## Raw SQL and cached rows {/* #raw-sql-and-cached-rows */}

A store owns the rows it has cached: the next save writes its value over whatever SQL changed in
the meantime. Change cached rows through the store (`update`, `set`, `transaction`), never with raw
SQL; raw SQL on rows that are not loaded is fine, and reading is always fine.

```kotlin title="Wrong: the next save of Steve's profile writes the old coins back"
// error-next-line
database.async { sql("UPDATE {prefix}profiles SET coins = coins + 10 WHERE uuid = :uuid", "uuid" to steve.uniqueId).update() }
```

```kotlin title="Right"
// fix-next-line
profiles.update(steve) { it.copy(coins = it.coins + 10) }
```

For the same reason a store operation that reaches the database is refused inside your own
`transaction { }`; a [store transaction](#store-transactions) is the transaction that may hold store
values.

## The table {/* #the-table */}

A store of a class keeps it in the table named by its first argument, under your prefix. The class
needs a primary constructor whose parameters are all properties (`val`), the key among them; each
property is a column, named as in [mapping](rows.md#reading-rows) and stored as its
[type](rows.md#types) says. The store checks this, and the table itself, when the database
opens, so a missing migration fails the start instead of the first save:

| Problem                                    | Message                                                    |
|--------------------------------------------|------------------------------------------------------------|
| no table                                   | `Plugin Shop: table profiles does not exist, but store profiles keeps its Profile rows there; add a migration that creates it` |
| a property without a column                | `Plugin Shop: table profiles has no column for Profile.lastSeen (looked for last_seen); add a migration` |
| the key column not unique                  | `Plugin Shop: column uuid of table profiles is neither its primary key nor a unique key, so store profiles cannot find rows by Profile.uuid; add a migration that makes it the primary key` |
| a constructor parameter that is no property | `Plugin Shop: Profile.rank is a constructor parameter but not a property; make it a val` |
| a `var` property                           | `Plugin Shop: store profiles keeps Profile, whose property coins is a var; make it a val and change values with profiles.update(key) { it.copy(coins = ...) }, since store values must be immutable` |
| a mutable collection type                  | `Plugin Shop: store profiles keeps Profile, whose property homes has the mutable type MutableList; declare it as List and change values with profiles.update(key) { it.copy(homes = ...) }, since store values must be immutable` |

Once checked, the store names the table and its columns as the database stores them, so
`@Column(name = "lastSeen")` reaches a column created as `lastSeen`, which PostgreSQL and H2 keep as
`lastseen`.

Each store has its own table: a second store of the same name fails with
`Plugin Shop: a store named profiles already exists; give each store its own table (or StoreSchema.name)`.

Stores are made in bean constructors, so they exist before the database opens; the database opens
at start whenever a store exists. A store made later, in a `PLUGIN_START_ONLY` function for
example, is checked and starts at once, loading the players already online (without `onJoin`). Its other operations
(`load`, `save`, `transaction`...) need the open database and fail in a constructor with
`Plugin Shop: its stores are used before its database opened; use them from a PLUGIN_RELOAD_OR_START function or later`.

## Your own layout {/* #your-own-layout */}

When one table per class does not fit (a value spread over several tables, a custom format), a
`StoreSchema` says how values are read and written, and `database.store(schema)` or
`database.playerStore(schema, onJoin, onLeave)` makes the store. Its functions run on the database
threads, inside the store's transactions:

```kotlin
import dev.versatia.database.store.StoreSchema

object Wallets : StoreSchema<UUID, Wallet> {
    override val name = "wallets"
    override fun load(sql: SqlScope, key: UUID) =
        sql.sql("SELECT currency, amount FROM {prefix}wallet_entries WHERE owner = :owner", "owner" to key)
            .list { row -> row.string("currency") to row.long("amount") }
            .takeIf { it.isNotEmpty() }?.let { Wallet(key, it.toMap()) }
    override fun create(key: UUID) = Wallet(key, emptyMap())
    override fun save(sql: SqlScope, key: UUID, value: Wallet, previous: Wallet?) {
        sql.sql("DELETE FROM {prefix}wallet_entries WHERE owner = :owner", "owner" to key).update()
        value.amounts.forEach { (currency, amount) -> sql.insert("wallet_entries", mapOf("owner" to key, "currency" to currency, "amount" to amount)) }
    }
}
```

`previous` is the value last written (null when it never was), for partial updates; `loadAll` and
`saveAll` may be overridden to read and write many keys at once, and `delete` to support
`store.delete(key)`, which fails otherwise.

## Lock waits {/* #lock-waits */}

Operations on the same key take turns. A save, a load or a store transaction that waits longer than
`stores.lock-timeout` (30 s) for a key fails with
`Plugin Shop: profiles could not lock 069a79f4-... within 30s; a store transaction or save holds it (stores.lock-timeout in database.yml)`.
A login waits at most `stores.login-timeout` (10 s), since the player is waiting, and is refused
after it. Autosave and the minute's cleanup never wait: they skip a busy key until their next run.

## Corner cases {/* #corner-cases */}

- **`store[key] = value` for a key that is not loaded** writes the whole value as an upsert at the
  next save, over a row that may exist. To change a stored row, `load` it first and `update` it.
- **A keyed store does not insert what `create` made** until it is changed; a player store writes new
  players at the next save.
- **Values are immutable.** A table store refuses at activation a class with a `var` property or a
  mutable collection type (`MutableList`, `MutableMap`, `ArrayList`, ...); a [`StoreSchema`](#your-own-layout)
  store is not checked, and a property changed inside its cached instance is neither seen nor
  saved. Replace the value with `copy`.
- **`tryUpdate` returns null while a store transaction holds the key**, even when the change itself
  would succeed.
- **Two timeouts bound the waits for a key**: `stores.login-timeout` a login's, and
  `stores.lock-timeout` every other (saves, loads, store transactions); the final save at stop
  waits only as long as `shutdown-timeout` leaves.
- **Offline players loaded by a store transaction** stay cached until `stores.idle-expiry`; with
  `idle-expiry: 0` nothing a keyed store loaded is ever forgotten.
- **Stores follow the foreign keys between their tables** ([Stores that reference each other](#stores-that-reference-each-other)).
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
