---
title: Database module
sidebar_label: Overview
pagination_label: Database module
description: A database per plugin, injected and ready, with migrations, background work and write-behind caches of rows.
---

# Database module

import ExampleCard from '@site/src/components/ExampleCard';
import Audience from '@site/src/components/Audience';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

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

The table comes from a migration in the JAR, `src/main/resources/database/migrations/`.
`{prefix}` and `{uuid}` are [tokens](tokens.md): the table prefix of your plugin and the UUID
column type of whatever engine the admin picks.

A row is an immutable data class, mapped by its constructor parameter names (`lastSeen` is the
column `last_seen`). A [player store](player-stores.md) keeps one row per player: loaded
before the player joins, changed in memory, saved on quit, by autosave and when the plugin stops.
Changing a value touches memory only, so it is safe in any event handler (`Rewards`). Anything that
reaches the database blocks, so outside start, reload and stop it runs on the plugin's database
threads and comes back to the server thread with `thenSync` (`Leaderboard`). At the first start the
log shows the migrations and one summary line.

<CodeCards spares="the pool, the `CREATE TABLE`, loading each player at login with a refusal when it fails, the name and `last_seen` upkeep, the autosave and the final save, the hops between threads (and the module also retries failed saves, writes only changed columns and runs on any engine the admin picks)">
<CodeCard title="Profiles.kt">

```kotlin
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

</CodeCard>
<CodeCard title="Rewards.kt">

```kotlin
class Rewards(private val profiles: Profiles) : Listener {
    @EventHandler
    fun onKill(event: EntityDeathEvent) {
        event.entity.killer?.let { profiles.give(it, 1) }
    }
}
```

</CodeCard>
<CodeCard title="Leaderboard.kt">

```kotlin
data class TopEntry(val name: String, val coins: Long)

@LocalBean
class Leaderboard(private val database: Database) {
    fun show(sender: CommandSender) = database.async { sql("SELECT name, coins FROM {prefix}profiles ORDER BY coins DESC LIMIT 10").list<TopEntry>() }
        .thenSync { top -> top.forEachIndexed { i, entry -> sender.sendMessage("${i + 1}. ${entry.name}: ${entry.coins}") } }
}
```

</CodeCard>
<CodeCard title="V1__create_profiles.sql">

```sql
CREATE TABLE {prefix}profiles (
    uuid      {uuid} NOT NULL PRIMARY KEY,
    name      VARCHAR(16) NOT NULL DEFAULT '',
    coins     BIGINT NOT NULL DEFAULT 0,
    last_seen {timestamp}
) {table_options};
```

</CodeCard>
<CodeCard title="Console" output>

```text
[Shop] Applying V1__create_profiles.sql
[Shop] SQLITE database.db, prefix shop_, schema V1 (applied V1 in 12 ms)
```

</CodeCard>
<CodeCard title="ShopPlugin.java" bukkit>

```java
public final class ShopPlugin extends JavaPlugin {
    private HikariDataSource dataSource;
    private Profiles profiles;
    private Leaderboard leaderboard;

    @Override
    public void onEnable() {
        getDataFolder().mkdirs();
        var config = new HikariConfig();
        config.setJdbcUrl("jdbc:sqlite:" + new File(getDataFolder(), "database.db"));
        config.setMaximumPoolSize(1);
        dataSource = new HikariDataSource(config);
        profiles = new Profiles(this, dataSource);
        try {
            createTable();
            profiles.loadOnline();
        } catch (SQLException e) {
            getLogger().log(Level.SEVERE, "Could not open database.db", e);
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        leaderboard = new Leaderboard(this, dataSource);
        getServer().getPluginManager().registerEvents(profiles, this);
        getServer().getPluginManager().registerEvents(new Rewards(profiles), this);
        getServer().getScheduler().runTaskTimerAsynchronously(
                this, profiles::saveChanged, 5 * 60 * 20, 5 * 60 * 20);
        getLogger().info("Opened database.db");
    }

    @Override
    public void onDisable() {
        if (profiles != null) profiles.saveOnStop();
        if (dataSource != null) dataSource.close();
    }

    public Leaderboard leaderboard() {
        return leaderboard;
    }

    private void createTable() throws SQLException {
        try (var connection = dataSource.getConnection();
             var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS shop_profiles (
                        uuid      TEXT NOT NULL PRIMARY KEY,
                        name      VARCHAR(16) NOT NULL DEFAULT '',
                        coins     BIGINT NOT NULL DEFAULT 0,
                        last_seen TIMESTAMP
                    )""");
        }
    }
}
```

</CodeCard>
<CodeCard title="Profiles.java" bukkit>

```java
record Profile(UUID uuid, String name, long coins, Instant lastSeen) {
    Profile withName(String name) {
        return new Profile(uuid, name, coins, lastSeen);
    }

    Profile withCoins(long coins) {
        return new Profile(uuid, name, coins, lastSeen);
    }

    Profile withLastSeen(Instant lastSeen) {
        return new Profile(uuid, name, coins, lastSeen);
    }
}

final class Profiles implements Listener {
    private static final String UPSERT = """
            INSERT INTO shop_profiles (uuid, name, coins, last_seen) VALUES (?, ?, ?, ?)
            ON CONFLICT (uuid) DO UPDATE SET name = excluded.name,
                coins = excluded.coins, last_seen = excluded.last_seen""";

    private final JavaPlugin plugin;
    private final DataSource dataSource;
    private final Map<UUID, Profile> profiles = new ConcurrentHashMap<>();
    private final Set<UUID> changed = ConcurrentHashMap.newKeySet();

    Profiles(JavaPlugin plugin, DataSource dataSource) {
        this.plugin = plugin;
        this.dataSource = dataSource;
    }

    void give(Player player, long coins) {
        update(player.getUniqueId(), profile -> profile.withCoins(profile.coins() + coins));
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onPreLogin(AsyncPlayerPreLoginEvent event) {
        if (event.getLoginResult() != AsyncPlayerPreLoginEvent.Result.ALLOWED) return;
        try {
            profiles.put(event.getUniqueId(), load(event.getUniqueId()));
        } catch (SQLException e) {
            plugin.getLogger().log(Level.WARNING, "Could not load " + event.getName(), e);
            event.disallow(AsyncPlayerPreLoginEvent.Result.KICK_OTHER,
                    text("Your data could not be loaded; try again later", RED));
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onLogin(PlayerLoginEvent event) {
        if (event.getResult() != PlayerLoginEvent.Result.ALLOWED)
            profiles.remove(event.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.LOWEST)
    public void onJoin(PlayerJoinEvent event) {
        var player = event.getPlayer();
        update(player.getUniqueId(), profile -> profile.withName(player.getName()));
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        var uuid = event.getPlayer().getUniqueId();
        changed.remove(uuid);
        var profile = profiles.remove(uuid).withLastSeen(Instant.now());
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> save(List.of(profile)));
    }

    void loadOnline() throws SQLException {
        for (var player : plugin.getServer().getOnlinePlayers())
            profiles.put(player.getUniqueId(), load(player.getUniqueId()).withName(player.getName()));
    }

    void saveChanged() {
        var batch = new ArrayList<Profile>();
        for (var iterator = changed.iterator(); iterator.hasNext(); ) {
            var profile = profiles.get(iterator.next());
            iterator.remove();
            if (profile != null) batch.add(profile);
        }
        if (!batch.isEmpty()) save(batch);
    }

    void saveOnStop() {
        var now = Instant.now();
        profiles.replaceAll((uuid, profile) -> profile.withLastSeen(now));
        save(profiles.values());
    }

    private void update(UUID uuid, UnaryOperator<Profile> change) {
        if (profiles.computeIfPresent(uuid, (key, profile) -> change.apply(profile)) != null)
            changed.add(uuid);
    }

    private Profile load(UUID uuid) throws SQLException {
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement(
                     "SELECT name, coins, last_seen FROM shop_profiles WHERE uuid = ?")) {
            statement.setString(1, uuid.toString());
            try (var result = statement.executeQuery()) {
                if (!result.next()) return new Profile(uuid, "", 0, null);
                var lastSeen = result.getTimestamp("last_seen");
                return new Profile(uuid, result.getString("name"), result.getLong("coins"),
                        lastSeen == null ? null : lastSeen.toInstant());
            }
        }
    }

    private void save(Collection<Profile> batch) {
        try (var connection = dataSource.getConnection();
             var statement = connection.prepareStatement(UPSERT)) {
            for (var profile : batch) {
                var lastSeen = profile.lastSeen();
                statement.setString(1, profile.uuid().toString());
                statement.setString(2, profile.name());
                statement.setLong(3, profile.coins());
                statement.setTimestamp(4, lastSeen == null ? null : Timestamp.from(lastSeen));
                statement.addBatch();
            }
            statement.executeBatch();
        } catch (SQLException e) {
            plugin.getLogger().log(Level.SEVERE, "Could not save " + batch.size() + " profiles", e);
        }
    }
}
```

</CodeCard>
<CodeCard title="Rewards.java" bukkit>

```java
final class Rewards implements Listener {
    private final Profiles profiles;

    Rewards(Profiles profiles) {
        this.profiles = profiles;
    }

    @EventHandler
    public void onKill(EntityDeathEvent event) {
        var killer = event.getEntity().getKiller();
        if (killer != null) profiles.give(killer, 1);
    }
}
```

</CodeCard>
<CodeCard title="Leaderboard.java" bukkit>

```java
public final class Leaderboard {
    private final JavaPlugin plugin;
    private final DataSource dataSource;

    Leaderboard(JavaPlugin plugin, DataSource dataSource) {
        this.plugin = plugin;
        this.dataSource = dataSource;
    }

    public void show(CommandSender sender) {
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            var lines = new ArrayList<String>();
            try (var connection = dataSource.getConnection();
                 var statement = connection.prepareStatement(
                         "SELECT name, coins FROM shop_profiles ORDER BY coins DESC LIMIT 10");
                 var result = statement.executeQuery()) {
                while (result.next())
                    lines.add((lines.size() + 1) + ". " + result.getString("name") + ": " + result.getLong("coins"));
            } catch (SQLException e) {
                plugin.getLogger().log(Level.SEVERE, "Could not read the leaderboard", e);
                return;
            }
            plugin.getServer().getScheduler().runTask(plugin, () -> lines.forEach(sender::sendMessage));
        });
    }
}
```

</CodeCard>
<CodeCard title="plugin.yml" bukkit>

```yaml
name: Shop
version: 1.0.0
main: com.example.shop.ShopPlugin
api-version: '1.21'
libraries:
  - com.zaxxer:HikariCP:7.1.0
```

</CodeCard>
<CodeCard title="Console" output bukkit>

```text
[Shop] Opened database.db
```

</CodeCard>
</CodeCards>

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
