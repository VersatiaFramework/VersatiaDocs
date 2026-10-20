# The runtime

VersatiaCore interprets descriptors. This page follows a plugin from `onEnable` to its beans and
functions, and lists the rules the runtime applies.

The runtime is deliberately simple: it reads the descriptor, loads the processors it names, hands
each one its slice of elements and keeps the state those processors build for the plugin. Every
feature lives in its processors; the pipeline knows none of them.

## From `onEnable` to processors {/* #from-onenable-to-processors */}

```mermaid
sequenceDiagram
    participant P as MyPlugin (VersatiaPlugin)
    participant E as VersatiaEngine (VersatiaCore)
    participant L as DescriptorLoader
    participant X as PluginEnhancer
    participant B as Bean processors
    participant A as AutoInvoke processor
    P->>E: enhance(this)
    E->>L: load descriptor of MyPlugin
    L-->>E: elements (format checked)
    E->>X: enhance(elements, START)
    X->>X: load every processor named for START
    X->>B: ClassTargets and the PluginTarget
    X->>A: FunctionTargets applying to START
    X->>B: completion: instantiate beans depth-first
    X->>A: completion: call functions with injected arguments
```

1. `VersatiaCore.onEnable` registers the runtime in Bukkit's `ServicesManager` under the
   `VersatiaEngine` interface from VersatiaAPI (`VersatiaEngine.instance` looks it up), then
   enhances VersatiaCore itself: the runtime has
   a descriptor like any plugin, which is how its own `/versatia` command is hooked in. The
   interface is the only link between a plugin and the runtime; plugins never compile against
   VersatiaCore.
2. A plugin's main class extends `VersatiaPlugin`. Its final `onEnable` looks the engine up and
   calls `enhance(this)`; `onDisable` calls `disable(this)`. If the engine is missing, the plugin
   fails with `VersatiaCore is not running. Add it to depend: in plugin.yml.`
3. The runtime derives the descriptor class name from the plugin's main class
   (`<package>.VersatiaDescriptor`), loads it through the plugin's class loader, reads the Kotlin
   `object` instance and checks its format version. Nothing is scanned. The class must come from
   the plugin's own class loader, not from a plugin it can see.
4. The enhancer keeps the elements whose phase applies to the current event and whose
   [`@ConditionalOnPlugin`](../optional-plugins.md) plugins are enabled, groups them by processor
   class, loads every one of those classes (a missing one fails the plugin before anything ran),
   hands each group to its processor in the order of the group's first element in the descriptor,
   and finally runs the completion actions the processors registered, in registration order; an
   action registered by another action runs after those already queued.
5. Once the start event went through, the runtime registers the plugin under its friendly name:
   `@FriendlyName` recorded on the main class, or the plugin's name. The registry is a
   `PluginRegistry` (VersatiaAPI), reachable as `VersatiaEngine.registry` and exposed by
   VersatiaCore as a bean; `/versatia reload` addresses plugins by that name and runs the `RELOAD`
   event for them, as does `VersatiaPlugin.versatiaReload()` for the plugin itself; see
   [Reloading plugins](../lifecycle/reload.md).
6. When the plugin is disabled, the runtime runs its `PLUGIN_STOP` elements (the scope processor
   in `process`, so before the stop functions, which run in a completion action), drops the
   plugin's state, closing every entry that implements `AutoCloseable`, and forgets the registration.

Errors surface as an `EnhancementException` thrown out of the plugin's `onEnable`, so Bukkit logs
them and disables that plugin only.

## Loading processors {/* #loading-processors */}

A processor is resolved by the class name in the element with `Class.forName` through the enhanced
plugin's class loader. Bukkit's plugin loaders delegate to the loaders of the plugins under
`depend:`, so the class may live in VersatiaCore, bundled next to the API classes, or in any plugin
the enhanced one depends on. The class is checked to implement `EnhancementProcessor` before
anything of it runs. One instance per class is created, with the no-argument constructor or by
taking the instance of a Kotlin `object`, and kept with the class (a `ClassValue`), so the
processor of a plugin that is gone does not keep that plugin's class loader alive.

## Plugin state {/* #plugin-state */}

Processors keep nothing per plugin in their fields. `EnhancementContext.state` is a `StateStore`:
entries are created on first use, kept across `START`, `RELOAD` and `STOP`, shared between
processors, and dropped when the plugin is disabled. `EnhancementContext.runtimeState` is a second
store that lives as long as VersatiaCore. The bean session lives in the plugin state, published as
`BeanResolver`; that is how the auto-invoke processor reaches the beans. The registry of exposed
beans lives in the runtime state, and a bean disappears from it with its owner when the session is
closed. See [Enhancements and processors](enhancements.md#plugin-state).

## Lifecycle events and phases {/* #lifecycle-events-and-phases */}

| Event    | Triggered by                                 | Phases dispatched                              |
|----------|----------------------------------------------|------------------------------------------------|
| `START`  | `VersatiaPlugin.onEnable`                    | `PLUGIN_START_ONLY`, `PLUGIN_RELOAD_OR_START`  |
| `RELOAD` | `/versatia reload`, `VersatiaEngine.instance.reload(plugin)` (behind `plugin.versatiaReload()` and `VersatiaEngine.reload(name)`), and the cascade to the plugins holding beans of a reloaded one | `PLUGIN_RELOAD_ONLY`, `PLUGIN_RELOAD_OR_START` |
| `STOP`   | `VersatiaPlugin.onDisable`                   | `PLUGIN_STOP`                                  |

## Conditions {/* #conditions */}

Next to the phase, the enhancer applies one more generic filter: an element whose target carries
`@ConditionalOnPlugin` is dispatched only when every plugin it names is enabled, asked from the
server's `PluginManager`. A function or property element also records the attributes of its
declaring class, so a conditional bean or `object` takes its `@AutoInvoke` functions and `@Value`
properties with it. The skipped
classes are logged at `INFO` when the plugin starts, one line per missing plugin, telling a plugin
that is not installed from one the server started later
(`Skipped VersatiaCommand: CommandAPI is not installed`); a function or property skipped by a
condition of its own, not its class's, is named as the member (`JoinBonus.vaultFound()`). The filter reads the recorded attribute
and knows no feature; see [Optional plugins](../optional-plugins.md).

## Commands {/* #commands */}

VersatiaCore's commands live in `engine.command` and are written with the CommandAPI Kotlin DSL.
`VersatiaCommand` is an `object` whose `register` function is auto-invoked at start and
conditional on the CommandAPI plugin, so VersatiaCore only lists CommandAPI under `softdepend:`
and ships nothing but the DSL. `/versatia reload [plugin]` reads the runtime's registry, runs the
reload event for the selected plugins, reports each failure to the sender and the console and
continues with the next plugin; its permission is `versatia.core.command.reload`.

## Descriptor format compatibility {/* #descriptor-format-compatibility */}

Every descriptor carries the `major.minor` version of the format it was generated with; the runtime
supports the version of the VersatiaAPI it bundles. The two numbers are read through plain
getters *before* the descriptor is cast and before `elements` is touched, so even a descriptor of
another format produces the version message rather than a `NoClassDefFoundError`.

The runtime accepts exactly the supported version. Any other is an error that names the plugin,
both versions and the fix: rebuild the plugin against the matching VersatiaAPI when its format is
older, update VersatiaCore when it is newer. The plugin whose descriptor is rejected stays
disabled; others are unaffected.

## Bean processors {/* #bean-processors */}

There is one processor per scope: `LocalBeanEnhancementProcessor`,
`ExposeSingletonEnhancementProcessor` and `ExposePrototypeEnhancementProcessor`. They do not create
anything themselves: each turns its elements into bean definitions and declares them in the
plugin's **bean session**, kept in the plugin state under `BeanResolver.KEY`, and the session
instantiates everything in the completion action of the start event. That is why all three scopes
can depend on each other inside one plugin regardless of the order in which their processors ran.
Declaring beans at any other event is rejected, and the compile-time step already refuses a scope
that would run a bean processor at another phase.

The definition is where the descriptor's facts become DI concepts: the bean name is the
`@Qualifier` attribute on the class or the default, `@Primary` is read from the attributes, and
each constructor parameter becomes a dependency of its type and the `@Qualifier` on it.

`PluginBeanEnhancementProcessor` receives the descriptor's `PluginTarget`, the plugin's main class,
sent there by `@PluginBean` on `VersatiaPlugin`, and declares it in the same session as a local bean named `plugin` whose instantiator returns the
`Plugin` from the context: the instance Bukkit created becomes injectable under its own type and
every supertype, is never exposed, and nothing is constructed for it. Its element runs at
`PLUGIN_RELOAD_OR_START`: at the reload event the processor reloads the session instead.

### Reloadable beans {/* #reloadable-beans */}

The session adopts every instance it makes or obtains, its own beans and the prototype instances
made for its plugin, and remembers the adopted instances implementing `Reloadable` in creation
order. They are first reloaded in the completion action of the start event, once every bean
exists, which is after the value processor set the plugin's `@Value` properties in `process`;
at the reload event the plugin-bean processor reloads them all in a completion action of its
own, again after the values. Both actions precede the auto-invoke processor's, so functions
always see reloaded beans. An instance adopted after that first pass, obtained by a function at
a later event say, is reloaded as soon as it is adopted. A throwing `reload()` is wrapped as
`Plugin X: <class> failed to reload`. Exposed singletons belong to their owner's session only.

### Resolution {/* #resolution */}

For every dependency (a type `T` and an optional qualifier) of a bean or of an auto-invoked
function:

1. Take the beans of the same plugin whose assignable types include `T`; with a qualifier, only
   the one whose name matches.
2. If that set is empty, take the exposed beans of plugins enhanced earlier, filtered the same way.
   Zero candidates: `no bean provides T, required by X`.
3. One candidate is injected. Among several, the single `@Primary` one is; otherwise the error lists
   the candidates by name, class and owning plugin, with the hint to add `@Qualifier` or `@Primary`.

The compile-time step applies the same rules to the local beans, so at runtime only exposed beans
can still produce these errors.

Instances are created depth-first, so dependencies always exist before their dependents, and each
definition is instantiated once per plugin. A cycle that slipped past the compile-time check is
still detected and reported.

### Scopes {/* #scopes */}

| Scope               | After the owning plugin has started                                                            |
|---------------------|------------------------------------------------------------------------------------------------|
| `@LocalBean`        | kept in the plugin's session, injectable only into that plugin                                 |
| the main class      | a local bean backed by the existing plugin instance                                            |
| `@ExposeSingleton`  | the instance is registered and handed to every later plugin that asks                          |
| `@ExposePrototype`  | a factory is registered; it creates a new instance per consuming plugin from the constructor arguments resolved when the owner started, except for the arguments that depend on the consumer (below) |

A prototype used by two beans (or functions) of the same plugin is created once for that plugin.
The owning plugin's own instance is never handed out. When the owner starts, each constructor
parameter of a prototype is classified once; an instance for a consumer is then built from:

| The owner resolved the parameter to    | The consumer's instance receives                                   |
|----------------------------------------|--------------------------------------------------------------------|
| its plugin bean                        | the consuming plugin, checked with `isInstance` against the parameter type |
| a prototype, its own or an exposed one | the instance of that prototype made for the consumer, resolved by the consumer's session with its own rules, so the consumer's beans share it |
| a parameter another processor supplies | what that processor's function returns now, such as the `@Value` the owner read last |
| anything else                          | the owner's argument                                               |

`ExposedBeanRegistry`, in the runtime state, records which plugins obtained each exposed bean and
the instances a prototype made for them, until they are disabled. `BeanResolver.instancesOf`
reads the instances, and after a successful reload the runtime reloads every running plugin
holding a bean of the reloaded one whose class the `@Value` processor marked (`followOwnerReloads`,
every bean class with values) or that takes such a bean of the owner through its constructor,
directly or through other beans of the owner (`recordDependencies`), transitively, once each and in start order; see
[Plugins that use the reloaded one's values](../lifecycle/reload.md#plugins-that-use-the-reloaded-ones-values).

The [beans every plugin has](../dependency-injection/index.md#beans-every-plugin-has) apart from
the plugin itself are ordinary exposed beans of VersatiaCore's own descriptor: `PluginRegistryBean`
(singleton) and the prototypes `PluginScopeBean`, `PluginLoggerBean` and
`PluginComponentLoggerBean`, each taking the consuming `Plugin`, so the first row above gives every
consumer its own. `PluginLoggerBean` extends `Logger` under the name of `plugin.logger` and
forwards records, level, handlers and filter to it; `PluginComponentLoggerBean` delegates every
method to `plugin.componentLogger`. Neither the build nor the pipeline knows these
types.

### Lifetime {/* #lifetime */}

A plugin's bean session, and the beans it exposed, live exactly as long as the plugin: created when
it starts, closed when the plugin's state is dropped after its `PLUGIN_STOP` elements ran. Closing
withdraws the exposed beans and closes every `AutoCloseable` instance the session adopted (its own
beans and the prototype instances made for it, not foreign singletons) in reverse adoption order,
which puts dependents before their dependencies; failures are collected, the first is thrown with
the rest suppressed. Beans are never re-created on reload; reload-phase functions receive the
retained instances.

## Auto-invoked functions {/* #auto-invoked-functions */}

The auto-invoke processor injects through the plugin's `BeanResolver`, the contract in VersatiaAPI
that any processor may use, and registers a completion action, so functions run after every other
processor of the event has finished. Functions run in descriptor order (class name, then function
name). For each function the processor

1. picks the receiver by `MemberOwner`: the plugin instance from the context, the `INSTANCE` of a
   Kotlin `object`, or, for `MemberOwner.INSTANCE`, the bean of that class from the plugin's
   session (`no bean X exists to call X.f() on` otherwise);
2. resolves the parameters through the bean session with the rules above;
3. calls the `Invoker`. Any exception is wrapped in an `EnhancementException` naming the function
   and the event, with the original as cause.

## Configuration values {/* #configuration-values */}

`ValueEnhancementProcessor` receives the `PropertyTarget`s that [`@Value`](../configuration.md)
produced and works in `process` itself, so the values are in place before any completion
action: before the reloadable beans reload and before the functions run. The descriptor lists
the properties after the beans, so by then every scope has declared its beans and the resources
are extracted. The processor loads each file named by the elements once, reads every
value with the strict getters of `util.config` according to the recorded `TypeReference`, or
through the `ValueMapper` the annotation names (an enum or mapper class is loaded through the
plugin's class loader), and only then assigns them, each on its receiver by `MemberOwner` like
a function: so a broken file leaves every property as it was. A missing non-nullable value, a
wrong shape, a mapper that throws or a missing file is an `EnhancementException` naming the
plugin, the property and the file. The main class and objects are assigned at once. A bean's
values go to every instance of its class, the plugin's own and each one its prototype makes for
another plugin: at start the processor keeps the values it read and hands the session a function
per constructor property (`supply`, a new filled cell for a `PreviousValueTracking`) and an
action that sets the body properties right after each constructor (`onInstanceCreated`), so an
instance made at any later time starts with the values read last; at a reload it replaces the
kept values and sets them on every instance `instancesOf` lists.


## Plugin resources {/* #plugin-resources */}

`ExtractResourcesEnhancementProcessor` receives the `PluginTarget` produced by `@ExtractResources`
on `VersatiaPlugin`. It finds the plugin's JAR through the main class's code source and copies
every file under the JAR's `resources/` entry into the data folder, keeping the layout, skipping
files that already exist and refusing paths that would escape the data folder. It works in
`process` itself, so the files are there before the bean session creates anything. Its phase is
`PLUGIN_RELOAD_OR_START`, so a reload restores a file deleted from the data folder before the
values are read; a JAR without a `resources/` entry leaves the data folder untouched. See
[Plugin resources](../resources.md).

## Event listeners {/* #event-listeners */}

`RegisterListenersEnhancementProcessor` receives the elements that `@RegisterListeners` on
`VersatiaPlugin` produced for every `Listener` of the plugin. Once every processor has run, so the
beans exist, it registers one instance per element with the server's plugin manager: the plugin
itself for the main class, the bean instance when the class is a bean, otherwise a new instance
created through the element's instantiator with the constructor parameters resolved by the
plugin's `BeanResolver`, once per plugin and shared with the other subclass features of
VersatiaCore, so a plain class that is also a `BackgroundTask` exists once. Bukkit unregisters the
listeners when the plugin is disabled. See [Event listeners](../events.md).

## Tasks {/* #tasks */}

The coroutines of every plugin run on one loop driven from the server thread; the `task` package
holds it and the two processors of `@RunBackgroundTasks`. See [Tasks and coroutines](../tasks.md)
for what plugin authors see.

### The heartbeat {/* #the-heartbeat */}

`ServerTicker`, a local bean of VersatiaCore, starts one Bukkit timer when VersatiaCore starts
(`runTaskTimer(periodTicks = 1)`); every run of it is a heartbeat of the `TickLoop`. A plugin's
`PluginScope` has a **lane** of that loop, registered when the scope is made, so lanes run in the
order the plugins started. Each heartbeat:

1. counts the tick;
2. for each lane in turn, runs the coroutine blocks dispatched to it before its turn (a block that
   dispatches itself again therefore advances once per tick), then the condition rechecks posted
   to it;
3. resumes the due tick waits of every lane, by due tick and then in the order they were
   registered.

A block or recheck that throws is logged on its plugin's logger (`A coroutine threw while running
on the server thread`) and the heartbeat goes on. Because rechecks run before the timers, a
condition that turns false in the tick a countdown ends cuts the countdown short.

### Dispatcher and clock {/* #dispatcher-and-clock */}

`PluginDispatcher` asks for no dispatch on the server thread, so a coroutine resumed or launched
there runs in place, and queues everything else in the lane for the next heartbeat: a launch from
another thread, the return from `withContext(Dispatchers.IO)`, a `delay`, a `yield`. It implements
no `Delay`, so kotlinx's `delay` waits wall-clock time on its default executor and then dispatches
back. `PluginClock`, the `ServerClock` in every scope's context, turns `delayTicks(n)` into a timer
due `max(n, 1)` ticks later, so `delayTicks(0)` waits for the next tick; the repeating helpers read
the tick count from it and report a failed run through it. `CoroutineMarker`, a
`ThreadContextElement` in the same context, tells whether a coroutine of a plugin is running on the
current thread, which the stop needs.

### Conditions of the scope {/* #conditions-of-the-scope */}

`PluginCondition` is a `StateFlow` over the last result and a Bukkit `Listener` registered with
`registerEvent` for each trigger, on behalf of the plugin. It is created on the server thread and
checks at once. A trigger whose event passes its filter posts one recheck to the lane, however many
events come before the next heartbeat (a pending flag); an `immediately` trigger fired on the
server thread checks inside the handler, and one fired elsewhere posts like any other and warns
once per event type. `recheck()` checks in place on the server thread and posts otherwise. A check
run for a trigger or for a post that throws keeps the last value and is logged. The listeners are
unregistered when the owner completes: the scope's job for `scope.condition`, the calling
coroutine's job for `condition`.

### The scope {/* #the-scope */}

`PluginScopeBean` is VersatiaCore's `@ExposePrototype` behind `PluginScope`: one instance per
consuming plugin, which its `Plugin` parameter receives, around VersatiaCore's `ServerTicker`. Its
context is a `SupervisorJob`, the dispatcher, the clock, the marker and an exception handler that
logs `<name> failed` on the plugin's logger. The job completing while the plugin is not stopping
means plugin code cancelled it, and is reported. `stop()` cancels the job and then, on the server
thread, abandons the lane's tick waits and rechecks and drains the lane, running its blocks until
the job completed or the loop's close timeout (five seconds) passed; called from inside one of the
plugin's coroutines it skips the drain and warns. Blocks that arrive after the stop still run at a
later heartbeat, and their failures say `after the plugin was disabled`. The scope is
`AutoCloseable`, so the bean session closes it too; stopping twice does nothing.

When VersatiaCore stops, `ServerTicker` cancels its timer and stops the loop: every lane is
cancelled, the loop runs what comes back for up to the same timeout, then hands later blocks to
`Dispatchers.IO` with their job cancelled, and warns about the plugins whose coroutines were still
running.

### The processors {/* #task-processors */}

| Processor                                | Elements                                    | `START`                                   | `RELOAD`                                  | `STOP`                     |
|------------------------------------------|---------------------------------------------|-------------------------------------------|-------------------------------------------|----------------------------|
| `PluginScopeEnhancementProcessor`        | the `PluginTarget`, once at `PLUGIN_START_ONLY` and once at `PLUGIN_STOP` | a completion action resolves the plugin's `PluginScope` through its `BeanResolver` and keeps it in the plugin state | not dispatched | in `process`, so before the stop functions' completion action: stops the scope |
| `RunBackgroundTasksEnhancementProcessor` | one per `BackgroundTask` class, or the `PluginTarget`, at `PLUGIN_RELOAD_OR_START` | a completion action, after the beans exist, obtains each task's instance and launches its run | a completion action, after the bean session reloaded the `Reloadable` beans and before the reload functions, cancels the runs and launches new ones | not dispatched |

A run is a coroutine of the scope named after the task class; it waits for the cancelled runs of
the same task (warning after the timeout), then for one tick, and then calls `run()`. Its outcome
is logged: a normal return at `FINE`, an exception as `Background task <class> failed; it starts
again at the next reload`, and a `CancellationException` while nothing cancelled the run as a
warning. Under `@DisableVersatiaFeatures(runBackgroundTasks = true)` neither processor has
elements, so nothing stops the scope at `STOP`: the bean session closes it, after the stop
functions. A plugin without a bean container cannot run tasks (`X is a BackgroundTask, but the
plugin has no bean container; ...`), and a `PluginScope` bean that is not VersatiaCore's is
refused, because the stop order needs it.

## What the tests cover {/* #what-the-tests-cover */}

VersatiaCore's tests need no server: unit tests drive the runtime with hand-written descriptors,
and end-to-end tests compile sample plugins with the real KSP processor and run them at start,
reload and stop. Only the `/versatia` command, which needs a server, is not unit-tested.
