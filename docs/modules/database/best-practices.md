---
title: Best practices
description: Conventions for plugins using the Database module, each with a wrong and a right snippet.
---

# Best practices

import Audience from '@site/src/components/Audience';

The conventions of the Database module, on top of the framework's [Best practices](/docs/reference/best-practices).

## Always write `{prefix}` <Audience who="developer" /> {/* #always-write-prefix */}

Every table name in SQL the plugin writes, in migrations, query files and inline statements alike,
starts with [`{prefix}`](tokens.md#the-prefix-token), and so does every other name the
plugin creates (indexes, triggers, functions):

```sql title="Wrong: src/main/resources/database/migrations/V1__create_profiles.sql"
-- error-next-line
CREATE TABLE profiles (
    uuid  {uuid} NOT NULL PRIMARY KEY,
    coins BIGINT NOT NULL DEFAULT 0
) {table_options};
```

```sql title="Right: src/main/resources/database/migrations/V1__create_profiles.sql"
-- fix-next-line
CREATE TABLE {prefix}profiles (
    uuid  {uuid} NOT NULL PRIMARY KEY,
    coins BIGINT NOT NULL DEFAULT 0
) {table_options};
```

```kotlin title="Wrong"
// error-next-line
sql("SELECT coins FROM profiles WHERE uuid = :uuid", "uuid" to uuid).singleOrNull<Long>()
```

```kotlin title="Right"
// fix-next-line
sql("SELECT coins FROM {prefix}profiles WHERE uuid = :uuid", "uuid" to uuid).singleOrNull<Long>()
```

The prefix is **always on**: it is never something the plugin decides, so the SQL never assumes
one or none.

| Where the prefix comes from                                     | `{prefix}profiles` becomes |
|-----------------------------------------------------------------|----------------------------|
| the default: the plugin's [friendly name](/docs/lifecycle/reload#friendly-names) in snake_case plus `_` (`Shop`) | `shop_profiles` |
| `table-prefix: eco_` in the plugin's [`database.yml`](/admin/database/configuration#the-table-prefix), set by the admin | `eco_profiles` |
| `table-prefix: ''`, allowed, also set by the admin              | `profiles`                 |

A name written without `{prefix}` works on the admin's server only while the prefix happens to be
empty. With the default prefix the stores and builders, which add the prefix themselves, use
`shop_profiles` while the bare SQL reads and writes a table `profiles` that the migrations never
created, or that belongs to another plugin in a shared database. Written with `{prefix}`, the same
SQL is right under every prefix, `''` included. Only the table names of
[builders and stores](tokens.md#where-tokens-work) go without it, since they add it
themselves.

## A table that extends a row points to its key <Audience who="developer" /> {/* #extension-references-key */}

A table that keeps more about another store's row, one row for one row (the statistics of a
profile, the settings of a guild), has the same key and points to that store's key with a foreign
key:

```sql title="Wrong: src/main/resources/database/migrations/V2__create_statistics.sql"
CREATE TABLE {prefix}statistics (
    -- error-next-line
    uuid  {uuid} NOT NULL PRIMARY KEY,
    kills BIGINT NOT NULL DEFAULT 0
) {table_options};
```

```sql title="Right: src/main/resources/database/migrations/V2__create_statistics.sql"
CREATE TABLE {prefix}statistics (
    -- fix-next-line
    uuid  {uuid} NOT NULL PRIMARY KEY REFERENCES {prefix}profiles (uuid),
    kills BIGINT NOT NULL DEFAULT 0
) {table_options};
```

```kotlin title="Wrong: the plugin keeps the two tables in step"
fun reset(uuid: UUID) {
    // error-next-line
    statistics.delete(uuid)            // forgotten in one place, and the row stays behind
    profiles.delete(uuid)
}
```

```kotlin title="Right"
fun reset(uuid: UUID) {
    // fix-next-line
    profiles.delete(uuid)              // deletes the statistics row first, in the same transaction
}
```

With the foreign key the stores keep the two tables in step themselves
([Stores that reference each other](stores.md#stores-that-reference-each-other)):

- **Written in order.** A new player's profile is written before the statistics row that points
  to it, at every save, whatever order the beans make the stores in; at a quit both values of the
  player go in one transaction.
- **Deleted together.** `profiles.delete(uuid)` deletes the statistics row of the same key first,
  in one transaction, and forgets both values; nothing is left for a later `reset` to forget.
- **Guarded by the database.** A statistics row without its profile cannot exist, whatever SQL
  writes the table.

Both keys are of the same type (`UUID` here), and the key column itself carries the reference. A
table with many rows for one row, such as payments of a player, points to it from a column of its
own (`player {uuid} NOT NULL REFERENCES {prefix}profiles (uuid)`): its rows are still written after
the profile, but a delete of the profile does not take them along.

## State that lives only in memory stays out of the row class <Audience who="developer" /> {/* #transient-state-in-a-bean */}

A row class holds what its table stores. State that only lives while the server runs, a combat
tag, an open menu, a pending teleport request, goes into a bean of its own:

```kotlin title="Wrong"
data class Profile(
    val uuid: UUID,
    val coins: Long = 0,
    // error-next-line
    val combatUntil: Instant? = null,
)
```

```kotlin title="Right"
data class Profile(val uuid: UUID, val coins: Long = 0)

@LocalBean
class Combat(scope: PluginScope) {
    // fix-next-line
    private val tags = scope.perPlayer<Instant>()

    fun tag(player: Player) {
        tags[player] = Instant.now().plusSeconds(15)
    }

    fun isTagged(player: Player) = tags[player]?.isAfter(Instant.now()) == true
}
```

- **It does not start.** Every constructor property of a row class is a column, so the wrong
  `Profile` fails the start with `Plugin Shop: table profiles has no column for
  Profile.combatUntil (looked for combat_until); add a migration`.
- **It lives differently.** A store keeps a value until the save after the player quits, so state
  tied to it would vanish or survive a quit depending on when that save runs. A
  [`scope.perPlayer`](/docs/tasks/coroutines#per-player-state) lives exactly as long as the code says: until the
  quit here, or `keepAfterQuit` past it when a combat log-out should be punished.
- **Saves stay quiet.** Changing a store value marks it for the next save, which would write and
  report a row in which nothing stored changed.
- **The code says what it is.** `combat.isTagged(player)` is state of the running server;
  `profiles[player].combatUntil` reads like data kept in the database.

A value computed from stored ones may stay in the row class as a property of its body, which is
no column: `val level get() = (xp / 100).toInt()`.
