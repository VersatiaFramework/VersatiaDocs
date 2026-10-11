# The runtime

VersatiaCore interprets descriptors. This page follows a plugin from `onEnable` to its beans and
functions, and lists the rules the runtime applies.

The runtime is deliberately simple: it reads the descriptor, loads the processors it names, hands
each one its slice of elements and keeps the state those processors build for the plugin. Every
feature lives in its processors; the pipeline knows none of them.

## From `onEnable` to processors

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
   `object` instance and checks its format version. Nothing is scanned.
4. The enhancer keeps the elements whose phase applies to the current event and whose
   [`@ConditionalOnPlugin`](../optional-plugins.md) plugins are enabled, groups them by processor
   class, loads every one of those classes (a missing one fails the plugin before anything ran),
   hands each group to its processor, and finally runs the completion actions the processors
   registered.
5. Once the start event went through, the runtime registers the plugin under its friendly name:
   `@FriendlyName` recorded on the main class, or the plugin's name. The registry is a
   `PluginRegistry` (VersatiaAPI), reachable as `VersatiaEngine.registry` and exposed by
   VersatiaCore as a bean; `/versatia reload` addresses plugins by that name and runs the `RELOAD`
   event for them, as does `VersatiaPlugin.versatiaReload()` for the plugin itself; see
   [Reloading plugins](../lifecycle/reload.md).
6. When the plugin is disabled, the runtime runs its `PLUGIN_STOP` elements, drops the plugin's
   state, closing every entry that implements `AutoCloseable`, and forgets the registration.

Errors surface as an `EnhancementException` thrown out of the plugin's `onEnable`, so Bukkit logs
them and disables that plugin only.

## Loading processors

A processor is resolved by the class name in the element with `Class.forName` through the enhanced
plugin's class loader. Bukkit's plugin loaders delegate to the loaders of the plugins under
`depend:`, so the class may live in VersatiaCore, bundled next to the API classes, or in any plugin
the enhanced one depends on. One instance per class is created, with the no-argument constructor
or by taking the instance of a Kotlin `object`, and kept for the lifetime of the runtime.

## Plugin state

Processors keep nothing per plugin in their fields. `EnhancementContext.state` is a `StateStore`:
entries are created on first use, kept across `START`, `RELOAD` and `STOP`, shared between
processors, and dropped when the plugin is disabled. `EnhancementContext.runtimeState` is a second
store that lives as long as VersatiaCore. The bean session lives in the plugin state, published as
`BeanResolver`; that is how the auto-invoke processor reaches the beans. The registry of exposed
beans lives in the runtime state, and a bean disappears from it with its owner when the session is
closed. See [Enhancements and processors](enhancements.md#plugin-state).

## Lifecycle events and phases

| Event    | Triggered by                                 | Phases dispatched                              |
|----------|----------------------------------------------|------------------------------------------------|
| `START`  | `VersatiaPlugin.onEnable`                    | `PLUGIN_START_ONLY`, `PLUGIN_RELOAD_OR_START`  |
| `RELOAD` | `/versatia reload`, `VersatiaEngine.reload`  | `PLUGIN_RELOAD_ONLY`, `PLUGIN_RELOAD_OR_START` |
| `STOP`   | `VersatiaPlugin.onDisable`                   | `PLUGIN_STOP`                                  |

## Conditions

Next to the phase, the enhancer applies one more generic filter: an element whose target carries
`@ConditionalOnPlugin` is dispatched only when every plugin it names is enabled, asked from the
server's `PluginManager`. A function element also records the attributes of its declaring class,
so a conditional bean or `object` takes its `@AutoInvoke` functions with it. Skipped
elements are logged at `FINE` with the missing plugins. The filter reads the recorded attribute
and knows no feature; see [Optional plugins](../optional-plugins.md).

## Commands

VersatiaCore's commands live in `engine.command` and are written with the CommandAPI Kotlin DSL.
`VersatiaCommand` is an `object` whose `register` function is auto-invoked at start and
conditional on the CommandAPI plugin, so VersatiaCore only lists CommandAPI under `softdepend:`
and ships nothing but the DSL. `/versatia reload [plugin]` reads the runtime's registry, runs the
reload event for the selected plugins, reports each failure to the sender and the console and
continues with the next plugin; its permission is `versatia.core.command.reload`.

## Descriptor format compatibility

Every descriptor carries the `major.minor` version of the format it was generated with; the runtime
supports the version of the VersatiaAPI it bundles. The two numbers are read through plain
getters *before* the descriptor is cast and before `elements` is touched, so even a descriptor of
another format produces the version message rather than a `NoClassDefFoundError`.

The runtime accepts exactly the supported version. Any other is an error that names the plugin,
both versions and the fix: rebuild the plugin against the matching VersatiaAPI when its format is
older, update VersatiaCore when it is newer. The plugin whose descriptor is rejected stays
disabled; others are unaffected.

## Bean processors

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

### Reloadable beans

The session adopts every instance it makes or obtains, its own beans and the prototype instances
made for its plugin, and an adopted instance implementing `Reloadable` is reloaded at once and
remembered in creation order. At the reload event the plugin-bean processor reloads them all in
that order, synchronously, while auto-invoked functions run in a completion action, so
reload-phase functions always see reloaded beans. A throwing `reload()` is wrapped as
`Plugin X: <class> failed to reload`. Exposed singletons belong to their owner's session only.

### Resolution

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

### Scopes

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
| anything else                          | the owner's argument                                               |

### Lifetime

A plugin's bean session, and the beans it exposed, live exactly as long as the plugin: created when
it starts, closed when the plugin's state is dropped after its `PLUGIN_STOP` elements ran. Beans
are never re-created on reload; reload-phase functions receive the retained instances.

## Auto-invoked functions

The auto-invoke processor injects through the plugin's `BeanResolver`, the contract in VersatiaAPI
that any processor may use, and registers a completion action, so functions run after every other
processor of the event has finished. Functions run in descriptor order (class name, then function
name). For each function the processor

1. picks the receiver by `FunctionOwner`: the plugin instance from the context, the `INSTANCE` of a
   Kotlin `object`, or, for `FunctionOwner.INSTANCE`, the bean of that class from the plugin's
   session (`no bean X exists to call X.f() on` otherwise);
2. resolves the parameters through the bean session with the rules above;
3. calls the `Invoker`. Any exception is wrapped in an `EnhancementException` naming the function
   and the event, with the original as cause.

## Plugin resources

`ExtractResourcesEnhancementProcessor` receives the `PluginTarget` produced by `@ExtractResources`
on `VersatiaPlugin`. It finds the plugin's JAR through the main class's code source and copies
every file under the JAR's `resources/` entry into the data folder, keeping the layout, skipping
files that already exist and refusing paths that would escape the data folder. It works in
`process` itself, so the files are there before the bean session creates anything; a JAR without
a `resources/` entry leaves the data folder untouched. See [Plugin resources](../resources.md).

## Event listeners

`RegisterListenersEnhancementProcessor` receives the elements that `@RegisterListeners` on
`VersatiaPlugin` produced for every `Listener` of the plugin. Once every processor has run, so the
beans exist, it registers one instance per element with the server's plugin manager: the plugin
itself for the main class, the bean instance when the class is a bean, otherwise a new instance
created through the element's instantiator with the constructor parameters resolved by the
plugin's `BeanResolver`. Bukkit unregisters the listeners when the plugin is disabled. See
[Event listeners](../events.md).

## What the tests cover

VersatiaCore's tests need no server. Unit tests drive the enhancer with hand-written descriptors
(creation order, isolation, singleton sharing, prototype semantics, ambiguity, lifetime, reflection,
the plugin instance as a bean, phases, missing processors), cover processor loading by name, and
cover descriptor lookup and the format-version rule. An end-to-end test compiles three sample
plugins with the real VersatiaAPI KSP processor (`kotlin-compile-testing`), builds class loaders
that delegate the way Bukkit's plugin loaders do, and runs the runtime over the generated
descriptors at start, reload and stop. The runtime's registry, friendly names, the reload event and
`@ConditionalOnPlugin` are covered with hand-written descriptors; the command itself needs a
server and is not unit-tested.
