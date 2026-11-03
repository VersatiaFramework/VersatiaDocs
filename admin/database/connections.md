# Connections and defaults

import TwinEngines from '@site/src/components/TwinEngines';

Two files of the module apply to many plugins at once: `connections.yml` holds connections several
plugins share, `config.yml` the defaults for every plugin whose
[`database.yml`](configuration.md#database-yml) leaves a key out. The `ssl` modes and the connection
pool follow.

## connections.yml {/* #connectionsyml */}

`plugins/VersatiaModule-Database/connections.yml` defines connections that several plugins share:
**one pool per connection**, while each plugin keeps its own tables, prefix and threads.

```yaml title="plugins/VersatiaModule-Database/connections.yml"
# Plugins opening their database for the first time without a database.yml use this connection;
# '' leaves each of them on its own SQLite file.
default-connection: main

connections:
  main:                                     # the name plugins write as connection: main
    engine: mysql                           # required in this file
    host: db.example.net
    port: 3306
    database: survival
    username: survival
    password: ${env:SURVIVAL_DB_PASSWORD}
    ssl: required
    properties: {}
    pool:                                   # ONE pool, shared by every plugin naming main
      size: 8
      min-idle: 1
      connection-timeout: 5s
      max-lifetime: 30m
      leak-warning: 0s
    threads-per-plugin: 2                   # the default threads of each plugin on main
  local:
    engine: h2
    file: shared.db                         # in plugins/VersatiaModule-Database/, as shared.mv.db
```

A plugin uses a connection with `connection: main` in its `database.yml`. The module ships the
file with `connections: {}` and the example above commented out, so nothing is shared until an
admin defines a connection.

| Key                               | Type     | Default            | What it does                                          | Applies |
|-----------------------------------|----------|--------------------|-------------------------------------------------------|---------|
| `default-connection`              | name     | `''`               | the connection of plugins that open their database for the first time (no `database.yml`, no `database.db`); `''` is SQLite per plugin | `/versatia reload database`, for plugins opening later |
| `connections.<name>`              | section  | none               | one shared connection; the name is any YAML key       | added: `/versatia reload database`; removed: a warning, the plugins using it keep it until a restart |
| `connections.<name>.engine`       | engine   | none, required     | as in [database.yml](configuration.md#every-key)                      | restart |
| `connections.<name>.file`         | path     | `database.db`      | relative to the module's folder, not a plugin's       | restart |
| `connections.<name>.host`, `port`, `database`, `schema` | as in [database.yml](configuration.md#every-key) | the same | as in `database.yml` | restart |
| `connections.<name>.username`, `password`, `ssl`, `properties` | as in [database.yml](configuration.md#every-key) | the same | as in `database.yml`, for every plugin of the pool | `/versatia reload database` |
| `connections.<name>.pool.*`       | as in [database.yml](configuration.md#every-key) | [per engine](configuration.md#defaults-per-engine) | the one pool of the connection | `/versatia reload database` |
| `connections.<name>.threads-per-plugin` | 1 or more | the plugin's own default | the `threads` of each plugin on this connection whose `database.yml` sets none | `/versatia reload database` |

The connection keys are read as strictly as `database.yml`'s, with the same messages, naming the
full path (`connections.yml has no connections.main.engine; set one of sqlite, h2, mysql, mariadb, postgresql`).
A broken `connections.yml` fails the start of the module, and at `/versatia reload database` the
reload, keeping what runs.

`default-connection` never moves a plugin that has data: one that already has a `database.db` stays
on it, with a warning naming both files; one that has a `database.yml` keeps what it says.

`/versatia reload database` re-reads the file. Pool sizes, timeouts, credentials, `ssl` and
`properties` of the connections in use apply at once, and open connections are replaced as they
come back; a connection that now points to another server, or was removed, keeps working until a
restart, with a warning naming the plugins using it.

## config.yml {/* #configyml */}

`plugins/VersatiaModule-Database/config.yml` holds what applies to every plugin's database: the
`defaults` section, the server's policy for every plugin whose `database.yml` leaves a key out.

```yaml title="plugins/VersatiaModule-Database/config.yml"
defaults:
  main-thread: warn
  stores:
    autosave: 2m
```

For each key a plugin's `database.yml` wins, then `defaults`, then the module's own default (the
[Every key](configuration.md#every-key) table). `defaults` takes the soft keys of `database.yml`: `queue-limit`,
`query-timeout`, `slow-query`, `main-thread`, `log-statements`, `shutdown-timeout`, `migrations.*`,
`stores.*` and `messages.*`. Where a plugin's data lives (`connection`, `engine`, `file`, `host`,
`port`, `database`, `schema`, `username`, `password`, `ssl`, `properties`, `table-prefix`,
`import-from`) is never a server-wide default, and neither are `pool` and `threads`, which each
engine and connection bounds differently.

`defaults` is read as strictly as `database.yml`, and `defaults: {}` (as shipped) sets nothing:

| In the file                    | Result |
|--------------------------------|--------|
| an unknown key                 | `config.yml has unknown key "defaults.stores.autosav"; did you mean "defaults.stores.autosave"?` |
| a key that is not a default    | `config.yml sets defaults.host, which only a plugin's database.yml (or a connection) sets; defaults takes queue-limit, query-timeout, slow-query, main-thread, log-statements, shutdown-timeout, migrations, stores, messages` |
| a value out of range           | `config.yml sets defaults.queue-limit: 0; use 1 or more` |

`/versatia reload database` re-reads it, and every open database then reads its settings again as
its own reload would: a changed default applies at once wherever no `database.yml` sets that key.
A plugin whose `database.yml` fails at that moment keeps its running settings, with a warning.

## SSL {/* #ssl */}

| `ssl:`      | MySQL <TwinEngines /> | MariaDB <TwinEngines /> | PostgreSQL    |
|-------------|-------------------|----------------|---------------|
| `disabled`  | `DISABLED`        | `disable`      | `disable`     |
| `preferred` | `PREFERRED`       | `trust`        | `prefer`      |
| `required`  | `REQUIRED`        | `trust`        | `require`     |
| `verify`    | `VERIFY_IDENTITY` | `verify-full`  | `verify-full` |

The MariaDB driver has no "TLS if available", so `preferred` asks for TLS there: a MariaDB server
without TLS needs `ssl: disabled`, which the connect error suggests. On MySQL, `ssl: disabled`
also allows the public key retrieval that password logins without TLS need.

## Pool and timeouts {/* #pool-and-timeouts */}

The pool is HikariCP, built after the module has looked at the server:

- `pool.max-lifetime` is lowered to 30 s below the server's idle timeout (MySQL and MariaDB
  `wait_timeout`, PostgreSQL 14+ `idle_session_timeout`), never under 30 s, so the server never
  drops a connection the pool still hands out; idle connections are pinged every half of that
  timeout (between 30 s and 2 minutes) when that comes before their replacement.
- On MySQL, MariaDB and PostgreSQL a connection that stops answering is broken after twice
  `query-timeout`, and at least after 2 minutes, so no thread waits on a dead socket forever. That
  holds with `query-timeout: 0` and `timeout(Duration.ZERO)` too: `0` means the driver's limit,
  120 s, not no limit at all.
- `properties` go to the driver after the module's own tuning and win over it.

## Corner cases {/* #corner-cases */}

- **The module's `defaults` never reach `threads`, `pool` or where the data lives**, and a key a
  plugin's `database.yml` sets, even to the built-in value, is never overridden by them.
- **`pool.connection-timeout` under 250 ms is 250 ms**, `0` included, at the start and at a reload
  alike; the validation timeout follows it, up to 5 s.
- **An `h2` or `sqlite` connection of `connections.yml`** keeps its file in the module's folder, a
  plugin's own in the plugin's folder; an inline `import-from` reads files from the plugin's folder.
- **`default-connection` never moves a plugin that has data**: a plugin with a `database.db` and no
  `database.yml` stays on SQLite, with a warning.
