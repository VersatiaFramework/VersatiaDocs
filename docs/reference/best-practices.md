# Best practices

The rules that keep a plugin built on Versatia, or an extension of the framework, working with it
rather than around it. Each links to the page with the details.

## Writing a plugin {/* #writing-a-plugin */}

### Beans {/* #beans */}

- **Inject through the primary constructor**, and keep beans, constructors and members as private
  as you like: the generated code reaches them without wider visibility.
- **Inject `logger` when you only log**, not the plugin; a `ComponentLogger` is `componentLogger`.
  See [Beans every plugin has](../dependency-injection/index.md#beans-every-plugin-has).
- **An optional dependency is a default value**, `class PriceList(format: PriceFormat = PlainFormat)`,
  never a nullable parameter or a lookup. See [Optional dependencies](../dependency-injection/index.md#optional-dependencies).
- **An integration is a conditional bean**: `@ConditionalOnPlugin("Vault")`, with `@Primary` over a
  fallback, never an `isPluginEnabled` check. See [Conditional beans](../optional-plugins.md#conditional-beans).

### Configuration and reload {/* #reloadable-plugins */}

- **Configuration is [`@Value` properties](../configuration.md)**; the default is in the shipped
  file, not in the code.
- **What derives from a value is never computed in a constructor**: read it in a getter, rebuild it
  in a `PLUGIN_RELOAD_OR_START` function, or react with [`PreviousValueTracking`](../configuration.md#reacting-to-a-change).
  The same holds for what derives from another plugin's beans. See
  [Designing for reload](../lifecycle/reload.md#designing-for-reload).
- **Listeners and coroutines read the beans' current state** instead of copying values when they
  start; a reload does not restart them.
- **`Reloadable` is for module prototypes only**; a plugin's own bean gets its values from `@Value`.

### Secrets {/* #secrets */}

A password, a token or an API key is a [`Secret`](../configuration.md#secrets), never a `String`;
`reveal()` only in the call that hands it over. The shipped file holds `''`, which switches the
feature off.

```kotlin title="Wrong"
@Value("discord.token")
// error-next-line
lateinit var token: String
```

```kotlin title="Right"
@Value("discord.token")
// fix-next-line
var token = Secret.EMPTY

@AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
fun connect() {
    if (token.isEmpty()) return logger.info("Discord bridge off: discord.token is empty")
    client.login(token.reveal())
}
```

### Tasks and threads {/* #tasks-and-threads */}

- **Work as long as the plugin runs is a [`BackgroundTask`](../tasks.md#background-tasks)**, never
  a timer started in a start or reload function.
- **Work something starts is launched from the injected `scope`**; one job per player goes into
  `scope.keyedJobs<K>()`. Cancel your jobs, never the scope.
- **Waiting for a state is a [`Condition`](../tasks.md#conditions)**, never a polling loop. One made
  for a single task is `condition(...)` inside its coroutine; a `scope.condition(...)` made for a
  player or a request is closed with `close()` when that ends.
- **The server thread is never blocked**: blocking I/O goes into `withContext(Dispatchers.IO) { }`.
  See [Threads](../tasks.md#threads).
- **Periods from configuration are `Duration`s** (`30s`, `5m`), not numbers of ticks.

```kotlin title="Wrong: one plugin-long listener more per /home"
fun teleportHome(player: Player, home: Location) {
    val start = player.location.block
    // error-next-line
    val standsStill = scope.condition(recheckOn<PlayerMoveEvent>(player)) { player.location.block == start }
    scope.launch { if (runOnceWhile(standsStill) { delay(5.seconds) }) player.teleport(home) }
}
```

```kotlin title="Right: the listener goes with the coroutine"
fun teleportHome(player: Player, home: Location) {
    val start = player.location.block
    scope.launch {
        // fix-next-line
        val standsStill = condition(recheckOn<PlayerMoveEvent>(player)) { player.location.block == start }
        if (runOnceWhile(standsStill) { delay(5.seconds) }) player.teleport(home)
    }
}
```

### Naming {/* #naming */}

| What                       | Convention                                         | Example                       |
|----------------------------|----------------------------------------------------|-------------------------------|
| a `BackgroundTask`         | what it does plus `Task`, in the package of the feature it serves | `AutoBroadcastTask` |
| a `Condition`              | the state it describes, without `is`               | `standsStill`, `anyoneOnline` |
| a `KeyedJobs`              | the plural of one job                              | `teleports`, `combatTags`     |
| an injected `PluginScope`  | `scope`                                            | `class Teleports(scope: PluginScope)` |

### Commands {/* #commands */}

Commands are written with the [CommandAPI](https://commandapi.dev/) Kotlin DSL in a `command`
subpackage, registered at `PLUGIN_START_ONLY` under `@ConditionalOnPlugin("CommandAPI")`, and
guarded by `versatia.<plugin>.command.<command>`. See [Commands](../commands.md).

### Server-wide calls {/* #entry-points */}

Work with no receiver starts at `VersatiaEngine` (`VersatiaEngine.playerOrNull(name)`,
`loadService<Economy>()`, `reload("shop")`); work on an object you hold is a call on that object
(`plugin.runTaskLater(20) { }`). Never `ServicesManager`, a cast or a reflective lookup for
everyday work. See [Utilities](../utilities/index.md#start-with-versatiaengine).

### Plugin builds {/* #plugin-builds */}

A plugin depends on `VersatiaStarter` and `VersatiaAPI-ksp`, and its JAR carries nothing the
server provides: no VersatiaAPI, Kotlin, `kotlinx.coroutines`, Paper API or module API, and no
coroutine library for Bukkit. A second copy breaks class loading. See
[plugin.yml](../getting-started/installation.md#pluginyml).

## Extending Versatia {/* #extending-versatia */}

For authors of scopes, enhancements and modules.

### Definitions and processors {/* #extending-the-framework */}

- **A feature is annotations in the API plus an [enhancement processor](../internals/enhancements.md)**;
  the loader and the descriptor stay untouched. What a feature needs is recorded as an attribute
  and interpreted in its processor.
- **A feature every plugin needs is an annotation on `VersatiaPlugin`**, switched off through
  `@DisableVersatiaFeatures`, never a special case in the build or the runtime.
- **A processor is stateless**: a no-argument class or an `object`; what it remembers goes into
  `context.state` (per plugin) or `context.runtimeState`, and resources there implement
  `AutoCloseable`, closed on disable.
- **It depends on another feature through that feature's API contract** (`context.state[BeanResolver.KEY]`),
  defers whole-plugin work with `context.onPluginEnhanced { }`, reads facts from the element rather
  than by reflection, and reports with `context.failure(message)`.
- **Names**: `<Feature>EnhancementProcessor`, its class name held in a `<Feature>Processors` object;
  an enhancement annotation says what it does (`@LocalBean`), an attribute the fact it records
  (`@Qualifier`).

### Internal plumbing {/* #internal-plumbing */}

Declarations marked `@VersatiaInternalApi` (an opt-in warning) are public only so that the
compile-time step, the descriptor and VersatiaCore can reach them. A plugin or a custom processor
never opts in: the warning means the code reaches into wiring that may change without notice.

### Modules {/* #modules */}

- **The entry point is an `@ExposePrototype` behind an interface**, so each consumer gets its own
  instance; one that reads the consumer's files implements `Reloadable`.
- **Everything belongs to the consumer**: the module keeps nothing in its own plugin and takes the
  consumer's plugin, logger and `PluginScope` as constructor parameters.
- **API and implementation are separate**: `VersatiaModule-<Name>` (public, compiled against) and
  `VersatiaModule-<Name>Impl` (`internal`, its JAR carries the API classes).

See [Modules](../modules/index.md).
