---
title: Database module
sidebar_label: Overview
pagination_label: Database module
description: A database per plugin, injected and ready, with migrations, background work and write-behind caches of rows.
---

# Database module

import ExampleCard from '@site/src/components/ExampleCard';
import Audience from '@site/src/components/Audience';

VersatiaModule-Database gives every plugin **its own database, injected and ready**. Without any
configuration a plugin gets a SQLite file in its data folder with the migrations from its JAR
already applied; the server admin moves it to H2, MySQL, MariaDB or PostgreSQL by editing
`database.yml`, and the module takes care of the pool, the SQL differences between engines, the
threads, the reload and the shutdown. You write SQL; the module runs it where and when it is safe.

<ExampleCard repo="VersatiaExample-Modules-Database" file="src/main/kotlin/dev/versatia/example/database/Profiles.kt">
Player coins with no setup: three migrations, a player store loaded at login and saved on quit, a transaction that moves coins between two players, and a leaderboard read in the background.
</ExampleCard>

Set-up follows every [module](/docs/modules#using-a-module):
[VersatiaStarter](/docs/getting-started/installation#in-your-build) brings the API,
`VersatiaModule-Database` goes under `depend:`, and the module's JAR on the server. At its first start Paper downloads the
libraries the module lists in its `plugin.yml` (HikariCP and the H2, MariaDB and PostgreSQL
drivers) into the server's `libraries/` folder; the SQLite and MySQL drivers are the server's own.

A build that depends on `VersatiaAPI` alone adds
`compileOnly("dev.versatia:VersatiaModule-Database:0.0.1")` (`libs.versatia.database`).

:::admin

The server admin installs the module, and moves, configures and watches every plugin's database
without code; the [Database module](/admin/database) part of the server admin guide
is the page to send them to.


:::

:::developer

The plugin's SQL goes into its JAR, under `src/main/resources/database/`: `migrations/` for the
tables ([Migrations](migrations.md)), `queries/` for [named queries](queries.md),
both written with [`{prefix}` and the other tokens](tokens.md). The code injects
`Database` and works through statements, [stores](stores.md) and their
[events](player-stores.md#autosave-events).

:::

```yaml title="plugin.yml"
name: Shop
main: com.example.shop.ShopPlugin
depend:
  - VersatiaCore
  - VersatiaModule-Database
```

The module gives your plugin one bean, and two packages hold what you write around it:

| Inject     | Package                                         | What it is                                                     |
|------------|-------------------------------------------------|----------------------------------------------------------------|
| `Database` | `dev.versatia.database`         | your plugin's database: [statements](statements.md), [transactions](background.md#transactions), [background work](background.md#background-work), its engine, prefix and status |
|            | `dev.versatia.database.store`   | [stores](stores.md): `KeyedStore`, `PlayerStore`, `StoreSchema`, made by `database.store(...)` and `database.playerStore(...)` |
|            | `dev.versatia.database.mapping` | `Column` and `ColumnCodec`, for [columns whose name or type needs help](rows.md#your-own-types) |

## A first plugin {/* #a-first-plugin */}

The table comes from a migration in the JAR. `{prefix}` and `{uuid}` are
[tokens](tokens.md): the table prefix of your plugin and the UUID column type of
whatever engine the admin picks.

```sql title="src/main/resources/database/migrations/V1__create_profiles.sql"
CREATE TABLE {prefix}profiles (
    uuid      {uuid} NOT NULL PRIMARY KEY,
    name      VARCHAR(16) NOT NULL DEFAULT '',
    coins     BIGINT NOT NULL DEFAULT 0,
    last_seen {timestamp}
) {table_options};
```

A row is an immutable data class, mapped by its constructor parameter names (`lastSeen` is the
column `last_seen`). A [player store](player-stores.md) keeps one row per player: loaded
before the player joins, changed in memory, saved on quit, by autosave and when the plugin stops.

```kotlin
import dev.versatia.database.Database
import dev.versatia.database.playerStore
import dev.versatia.database.store.PlayerStore
import dev.versatia.di.LocalBean

data class Profile(val uuid: UUID, val name: String = "", val coins: Long = 0, val lastSeen: Instant? = null)

@LocalBean
class Profiles(database: Database) : PlayerStore<Profile> by database.playerStore(
    "profiles", Profile::uuid,
    onJoin = { player, profile -> profile.copy(name = player.name) },
    onLeave = { _, profile -> profile.copy(lastSeen = Instant.now()) },
    create = { Profile(it) },
) {
    fun give(player: Player, coins: Long) = update(player) { it.copy(coins = it.coins + coins) }
}
```

Changing a value touches memory only, so it is safe in any event handler:

```kotlin
class Rewards(private val profiles: Profiles) : Listener {
    @EventHandler
    fun onKill(event: EntityDeathEvent) {
        event.entity.killer?.let { profiles.give(it, 1) }
    }
}
```

Anything that reaches the database blocks, so outside start, reload and stop it runs on the
plugin's database threads and comes back to the server thread with `thenSync`:

```kotlin
import dev.versatia.database.list

data class TopEntry(val name: String, val coins: Long)

@LocalBean
class Leaderboard(private val database: Database) {
    fun show(sender: CommandSender) = database.async { sql("SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT 10").list<TopEntry>() }
        .thenSync { top -> top.forEachIndexed { i, entry -> sender.sendMessage("${i + 1}. ${entry.name}: ${entry.coins}") } }
}
```

At the first start the log shows the migrations and one summary line:

```text
[Shop] Applying V1__create_profiles.sql
[Shop] SQLITE database.db, prefix shop_, schema V1 (applied V1 in 12 ms)
```

Every plugin's tables carry its own prefix, its friendly name in snake_case plus `_`, so the table
here is `shop_profiles`. Later starts show `schema V1` alone. The module has also written
`plugins/Shop/database.yml`, three lines recording where the data is and its prefix, which the
admin edits to [move the plugin to another engine](/admin/database/data#changing-the-database).

What the plugin did not write: loading each player at login with a refusal when that fails, the
name and `last_seen` upkeep (players still online at shutdown included), the autosave that writes
only the changed columns, the final save, the pool, the thread rules and the start-up check that
`profiles` has a column for every property of `Profile`.

## The pages of this module {/* #the-pages-of-this-module */}

| Page                                             | What it covers                                                     | Mostly for |
|--------------------------------------------------|--------------------------------------------------------------------|------------|
| [Statements](statements.md)                      | `database.sql`, parameters, tokens in SQL, batches, timeouts, raw JDBC | <Audience who="developer" /> |
| [Rows and types](rows.md)                        | reading rows into classes, `insert` and `upsert`, types and codecs | <Audience who="developer" /> |
| [Threads, background work and transactions](background.md) | what blocks, the server-thread guard, `database.async` and its futures, failures, transactions | <Audience who="developer" /> |
| [Stores](stores.md)                              | write-behind caches of rows, keyed stores, what a save writes, store transactions | <Audience who="developer" /> |
| [Player stores](player-stores.md)                | the login of a player, saving, failed saves, values kept at a stop | <Audience who="developer" /> |
| [Migrations](migrations.md)                      | the SQL files of the JAR, history, resuming, backups               | <Audience who="developer" /> |
| [Engine overrides](engine-overrides.md)          | SQL one engine needs in another form, engine directories           | <Audience who="developer" /> |
| [Named queries](queries.md)                      | `named(...)`, query files and their overrides                      | <Audience who="developer" /> |
| [Engines](configuration.md)                      | the engines, [MySQL and MariaDB](configuration.md#mysql-and-mariadb), the `database.yml` a plugin ships | <Audience who="developer" /> |
| [Tokens](tokens.md)                              | `{prefix}` and the other tokens, how and where they expand         | <Audience who="developer" /> |
| [Opening, shutdown and errors](operations.md)    | when the database opens, the shutdown, `database.status`, the exceptions | <Audience who="developer" /> |
| [Server admin guide: Database](/admin/database) | `database.yml`, `connections.yml`, `config.yml`, moving data, backups, `/versatiadb status`, logs, troubleshooting | <Audience who="admin" /> |
| [Best practices](best-practices.md)              | `{prefix}` everywhere, extension tables pointing to their row, memory-only state in beans | <Audience who="developer" /> |

## One instance per plugin {/* #one-instance-per-plugin */}

`Database` is a [module prototype](/docs/modules#one-instance-per-plugin): the instance you inject
is your plugin's own, with its own settings, pool (or share of a pool), threads, tables and stores.
Two plugins never see each other's statements or caches. Two plugins sharing one MySQL database
keep their own migration history there, and their [table prefixes](/admin/database/configuration#the-table-prefix),
the friendly names by default, keep their tables apart.

The database is a [`Reloadable` bean](/docs/lifecycle/reload#reloadable-beans) of your plugin. At
start it reads its settings and SQL files, opens and migrates **after your beans are built and
before your `@AutoInvoke` functions run**, so a `PLUGIN_START_ONLY` or `PLUGIN_RELOAD_OR_START`
function finds the tables ready. It closes after your `PLUGIN_STOP` functions, which may still use
it. A bean constructor may only register stores and types (`database.playerStore`, `database.store`,
`database.registerType`); anything else there fails with
`Plugin Shop: its database is used before the plugin started; use it from a PLUGIN_RELOAD_OR_START function or later`.
