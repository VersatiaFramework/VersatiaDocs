---
title: Threads, background work and transactions
sidebar_label: Threads and transactions
description: What blocks, the server-thread guard, database.async and its futures, failure logging and transactions.
---

# Threads, background work and transactions

import Audience from '@site/src/components/Audience';

<Audience who="developer" below />

The API has **one threading rule**: every call that reaches the database blocks the calling
thread, and `database.async { }` is the way into the background. There are no `suspend` or `Async`
variants of each call; a block of ordinary blocking calls runs on your plugin's database threads,
and its result comes back to the server thread when you ask for it.

## What blocks {/* #what-blocks */}

| Never blocks: memory only, any thread                       | Blocks: reaches the database                       |
|-------------------------------------------------------------|----------------------------------------------------|
| `database.async { }`, `database.sql(...)`, `database.named(...)`, binding      | the [terminals](statements.md#running-sql) of a statement: `list`, `single`, `update`... |
| a store's `get`, `set`, `update`, `tryUpdate`, `contains`, `keys` | `insert`, `insertAndGetKey`, `insertReturning`, `upsert` |
| a store's `load`, `save`, `saveAll`, `evict`, `delete`, `transaction`: they return futures | `transaction { }`, `connection { }` |
| `then`, `thenSync`, `onFailureSync` of a future, `join()` of a future that is done, `database.status`, `database.engine`, `database.tablePrefix` | `join()` of a future that is not done |

## The server thread {/* #the-server-thread */}

A blocking call on the server thread would freeze the server for as long as the database takes, so
by default it fails at once instead:

```text
Plugin Shop: Statement.list blocks the server thread; run it inside database.async { } (main-thread: throw in plugins/Shop/database.yml)
```

```kotlin title="Wrong: a query in an event handler stops the server until it returns"
@EventHandler
fun onJoin(event: PlayerJoinEvent) {
    // error-next-line
    val rank = database.named("rank-of", "uuid" to event.player.uniqueId).single<Long>()
    event.player.sendMessage("You are number $rank")
}
```

```kotlin title="Right"
@EventHandler
fun onJoin(event: PlayerJoinEvent) {
    val player = event.player
    // fix-next-line
    database.async { named("rank-of", "uuid" to player.uniqueId).single<Long>() }.thenSync { rank -> player.sendMessage("You are number $rank") }
}
```

Blocking on the server thread is allowed, and needs no `async`, while nothing is ticking anyway:

- while your plugin **starts or reloads**: from the moment its database reads its settings until
  the next server tick, which covers your `@AutoInvoke` functions of `PLUGIN_START_ONLY`,
  `PLUGIN_RELOAD_ONLY` and `PLUGIN_RELOAD_OR_START`;
- while your plugin **stops**: Bukkit has marked it disabled before its `PLUGIN_STOP` functions run;
- while the database itself closes.

`main-thread` in [`database.yml`](/admin/database/configuration#database-yml) changes the rule: `throw` (the
default) fails, `warn` logs the same text with `; called at com.example.shop.Ranks.onJoin(Ranks.kt:21)`
at most once a minute per calling line and lets the call run, `allow` lets every call run.

:::admin

For the server admin, `main-thread` is described in
[Player data](/admin/database/operations#player-data) of the server admin guide.


:::

## Background work {/* #background-work */}

`database.async { }` runs its block on your plugin's database threads, with the database as receiver, and
returns a `DatabaseFuture`:

```kotlin
import com.github.marcoral.versatia.database.list

database.async { named("top-coins", "limit" to 10).list<TopEntry>() }
    .thenSync { top -> show(sender, top) }
    .onFailureSync { sender.sendMessage(text("The leaderboard is unavailable right now.", NamedTextColor.RED)) }
```

| On a `DatabaseFuture`        | Does                                                                |
|------------------------------|---------------------------------------------------------------------|
| `then { value -> }`          | continues on the database threads, with the database as receiver   |
| `thenSync { value -> }`      | continues on the server thread (at once when the work finished there, otherwise at the next tick); skipped when an earlier step failed |
| `onFailureSync { error -> }` | runs on the server thread with the failure of this or an earlier step, unwrapped, and marks it handled; the future stays failed, so a `thenSync` after it does not run |
| `join()`                     | waits for the result; a blocking call like any other while the future is not done, and then refused on a database thread (`join() on a database thread would deadlock; chain with then { }`); a done future returns at once anywhere |
| `toCompletableFuture()`      | the same result as a `CompletableFuture`, for APIs that take one    |
| `await()`                    | suspends a coroutine until the result is there, without blocking its thread |
| `isDone`                     | whether the result, or the failure, is there                        |

In a coroutine of your [plugin scope or a background task](/docs/tasks#your-own-coroutines),
`await()` reads like sequential code and continues on the thread the coroutine runs on:

```kotlin
import com.github.marcoral.versatia.database.await

class LeaderboardTask(private val profiles: Profiles) : BackgroundTask {
    override suspend fun run() {
        every(period = 5.minutes) {
            val top = profiles.saveAll().then { named("top-coins", "limit" to 3).list<TopEntry>() }.await()
            if (top.isNotEmpty()) VersatiaEngine.broadcast(text("Richest: ${top.joinToString { it.name }}"))
        }
    }
}
```

The database threads are named `<Plugin>-db-<n>`; there are `threads` of them (one on SQLite). A
call that is already on one of them runs inline: `database.async { }` inside `database.async { }`, a store
operation inside `then { }`, so nothing waits for a thread it occupies itself.

### Failures {/* #failures */}

A failure that no `onFailureSync` handles is logged at SEVERE one tick later, with the line that
submitted the work, its [kind](operations.md#failure-kinds) and the statement:

```text
[Shop] A database task submitted at com.example.shop.Leaderboard.show(Leaderboard.kt:14) failed (TIMEOUT)
com.github.marcoral.versatia.database.QueryException: Plugin Shop: query failed: ERROR: canceling statement due to statement timeout (PostgreSQL 0, SQLState 57014)
SQL: SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT :limit
Parameters: :limit
```

`join()`, `await()` and `toCompletableFuture()` hand the failure to you, so it counts as handled
too. When the database is down every task fails the same way; the first failure of each kind is
logged in full, the next ones of that minute as one line:
`37 more database tasks failed in the last minute: Connection refused`.

### Limits {/* #limits */}

At most `queue-limit` tasks (5000 by default) wait for a thread. Past it, `database.async` throws at once
instead of piling up work for a database that does not answer:

```text
Plugin Shop: 5000 database tasks are waiting; the database is too slow or unreachable (queue-limit in database.yml)
```

Once your plugin is disabled, `thenSync` and `onFailureSync` steps are dropped (Bukkit runs nothing
more for it) and their futures fail with
`Plugin Shop: it is disabled, so server-thread steps of database tasks are dropped`. In
`PLUGIN_STOP` functions call the database directly, which blocking allows there.

## Transactions {/* #transactions */}

`transaction { }` runs its block on one connection: committed when the block returns, rolled back
when it throws. The block's receiver is a `Transaction`, which runs SQL like the database does:

```kotlin
database.transaction {
    sql("UPDATE {prefix}profiles SET coins = coins - :price WHERE uuid = :buyer", "price" to price, "buyer" to buyer).update()
    insertAndGetKey("purchases", Purchase(buyer = buyer, item = item, price = price))
}
```

| Inside `transaction { }`         | Does                                                            |
|----------------------------------|-----------------------------------------------------------------|
| `transaction { }` again          | a savepoint: its failure rolls back only its own work, if the outer block catches it |
| `afterCommit { }`                | runs on this thread once the outermost transaction committed; never after a rollback, never twice when it is retried |
| `setRollbackOnly()`              | rolls everything back when the outermost block returns, without an exception; the block's result is still returned |
| `{for-update}` in a `SELECT`     | locks the selected rows until the end of the transaction (`FOR UPDATE`; nothing on SQLite, which locks the whole file for a writer) |

`transaction(retries = 2) { }` reruns the outermost block after a deadlock or a lock timeout (the
[kinds](operations.md#failure-kinds) marked retryable), up to that many times, waiting about 10, 50
and 200 ms in between. Every other failure, and a failure after the commit, is thrown at once. A
block that may run twice must have no effect outside the database, which is what `afterCommit` is for:

```kotlin title="Wrong: a retried block sends the message twice"
database.transaction(retries = 2) {
    sql("UPDATE {prefix}profiles SET coins = coins + :amount WHERE uuid = :uuid", "amount" to amount, "uuid" to uuid).update()
    // error-next-line
    player.sendMessage("You received $amount coins")
}
```

```kotlin title="Right"
database.transaction(retries = 2) {
    sql("UPDATE {prefix}profiles SET coins = coins + :amount WHERE uuid = :uuid", "amount" to amount, "uuid" to uuid).update()
    // fix-next-line
    afterCommit { player.sendMessage("You received $amount coins") }
}
```

(Coins of a [player store](stores.md#player-stores) change through the store, never through raw SQL:
see [Raw SQL and cached rows](stores.md#raw-sql-and-cached-rows).)

### One connection per thread {/* #one-connection-per-thread */}

Outside a transaction each statement borrows a connection, runs in auto-commit and gives it back,
so a long `database.async { }` that also does other work never holds a connection while it does. Inside
`transaction { }` or [`connection { }`](statements.md#raw-jdbc) the connection is bound to the
thread: every call of the same database on that thread joins it, through the transaction's
receiver, through `database`, through a bean that injects `database` and runs a statement, or through a nested
`database.async { }` on a database thread. Nothing borrows a second connection, which is why SQLite's single
connection never deadlocks against itself.

Work handed to another thread does not join: a `database.async { }` submitted from the server thread
inside a transaction gets a connection of its own, and on SQLite waits for the transaction to end.
A store operation that reaches the database is refused inside your own `transaction { }`, because
stores take their key locks before a connection and this order keeps them deadlock-free:
`Plugin Shop: profiles.save cannot run inside transaction { }; use profiles.transaction(...)`. A
[store transaction](stores.md#store-transactions) is the transaction that holds store entries.
