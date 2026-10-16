# Best practices

The conventions the framework follows and expects from anyone extending it: plugin authors who
define their own scopes or enhancements, and contributors to VersatiaAPI and VersatiaCore. Each
rule comes with the reason behind it.

## Extending the framework {/* #extending-the-framework */}

**A feature is definitions plus processors, nothing else.** Adding one puts annotations,
attributes and enums into VersatiaAPI and enhancement processors into VersatiaCore (or into your
own plugin). The loader, the dispatcher, the main class and the descriptor model stay untouched.
If a feature seems to need a change to the pipeline, the feature is modelled wrong: record what it
needs as an [attribute](../internals/enhancements.md#versatiaattribute) and interpret it in the
processor.

**Record facts, not interpretations.** The descriptor stores classes, supertypes, parameters and
the annotations written on them. It never stores what a feature makes of those facts: there is no
"bean name" field, the DI processor derives the name from `@Qualifier`. Keep new features to the
same standard, so that the descriptor stays neutral and every feature reads it the same way.

## Naming {/* #naming */}

| What                                   | Convention                                                   | Example                                   |
|----------------------------------------|--------------------------------------------------------------|-------------------------------------------|
| an `EnhancementProcessor` implementation | `<Feature>EnhancementProcessor`                             | `LocalBeanEnhancementProcessor`, `AutoInvokeEnhancementProcessor` |
| a shared base of several processors    | the same suffix                                              | `BeanScopeEnhancementProcessor`           |
| the processor names a feature publishes | an `object` named `<Feature>Processors` holding `const val`s with the fully qualified names | `BeanProcessors.LOCAL`, `LifecycleProcessors.AUTO_INVOKE` |
| an enhancement annotation              | what it does to the element, no `Versatia` prefix            | `@LocalBean`, `@AutoInvoke`               |
| an attribute annotation                | the fact it records                                          | `@Qualifier`, `@Primary`                  |
| a reserved bean name                   | a constant next to the feature                               | `BeanNames.PLUGIN`                        |
| a `VersatiaEngine` shortcut            | an extension on `VersatiaEngine.Companion` in `VersatiaEngineExtensions.kt`; Bukkit's term without `get`; a lookup that can miss ends in `OrNull`, a bare name never misses or throws an exception naming the fix; a property for argument-less state that does not depend on the calling thread, a function otherwise; never a Kotlin standard-library top-level name | `onlinePlayers`, `playerOrNull(id)`, `loadService<T>()`, `reload(name)` |
| a module                               | API repository, Maven artifact and plugin name `VersatiaModule-<Name>`; implementation repository `VersatiaModule-<Name>Impl`; package `com.github.marcoral.versatia.<name>`, one per part when it has several | `VersatiaModule-Messages`, `VersatiaModule-MessagesImpl`, `com.github.marcoral.versatia.messages` and `.text` |

The suffix makes a processor recognisable wherever its name appears: in a descriptor, in an error
message, in a stack trace. The constants exist because `@VersatiaEnhancement` takes the processor
as a string (the plugin does not compile against the runtime); a constant keeps the string in one
place and lets the compile-time step reuse it.

## Packages {/* #packages */}

Packages are organised **by feature**, as if VersatiaAPI, VersatiaCore and the `ksp` module were
slices of one monolith. The same package name holds the feature's definitions in VersatiaAPI and
its processors in VersatiaCore.

| Package (under `com.github.marcoral.versatia`) | Holds                                                                           |
|------------------------------------------------|---------------------------------------------------------------------------------|
| the root                                       | the enhancement mechanism (`@VersatiaEnhancement`, `@VersatiaAttribute`, `EnhancementProcessor`, `EnhancementContext`, `StateStore`, the phases) and the plugin bootstrap (`VersatiaPlugin`, `VersatiaEngine`), with the static shortcuts over the server (`VersatiaEngineExtensions.kt`); in VersatiaCore also the runtime pipeline |
| `engine.*`                                     | technical internals that deliver no feature of their own but are needed for the framework to work, such as `engine.descriptor` |
| `di`, `lifecycle`, `config`, …                 | one feature each: definitions in the API, processors in the runtime             |
| `<anything>.command`                           | the commands of a feature or of a plugin, always in a subpackage named `command` (`engine.command` holds `/versatia`) |
| `util.*`                                       | helpers on objects a caller holds and pure functions, grouped by the domain they touch; server-wide work with no receiver is on `VersatiaEngine`, and `util` never imports the root package |
| `ksp`, `ksp.<feature>`                         | the compile-time step: generic parts in `ksp`, feature-specific collectors and checks in `ksp.di`, `ksp.lifecycle`, `ksp.config` |

There are no packages named after layers (`core`, `service`, `impl`): a reader looking for
"everything about beans" opens `di` in both repositories and finds it.

## Writing a processor {/* #writing-a-processor */}

- **No constructor arguments.** The runtime creates a processor with its no-argument constructor
  or uses the instance of a Kotlin `object`, one per class, shared by every plugin.
- **No state in fields.** Constants in a companion object are fine; whatever a processor must
  remember goes into `context.state` (per plugin,
  dropped on disable) or `context.runtimeState` (as long as VersatiaCore runs) under a `StateKey`.
  Both stores are shared with other processors; nothing is ever a global.
- **Clean up with `AutoCloseable`.** An entry in the plugin state that holds resources, or that
  registered something elsewhere (the bean session registers exposed beans), implements
  `AutoCloseable`; the runtime closes it on disable. Processors never hook the stop event just to
  clean up.
- **Depend on another feature through a contract in VersatiaAPI and its state entry**, never
  through the runtime or through the other feature's classes in VersatiaCore. The auto-invoke
  processor injects through `context.state[BeanResolver.KEY]`; the runtime does not know that
  lifecycle functions need beans, and a processor in another plugin injects the same way.
- **Defer work that needs the whole plugin** with `context.onPluginEnhanced { }`. Beans are created
  there, after all scopes declared theirs; functions run there, after the beans exist.
- **What every plugin gets is an annotation on `VersatiaPlugin`.** An enhancement declared on a
  base class applies to every main class extending it, so a feature every plugin needs
  (`@PluginBean`, `@ExtractResources`) is one annotation there, never a special case in the
  compile-time step or the runtime. Its processor accepts only the `PluginTarget`, exactly once.
  If plugins may opt out, the feature gets a `Boolean` in `@DisableVersatiaFeatures`, marked with
  `@VersatiaDisabler`; no feature has a switch annotation of its own.
- **Read facts from the element**, not from the classes: the attributes on the target and its
  parameters, the arguments of the producing annotation. A processor that needs reflection on the
  plugin's classes to find out what was annotated is working around the descriptor.

## Internal plumbing {/* #internal-plumbing */}

Some of VersatiaAPI is public only because the compile-time step, the generated descriptor and
VersatiaCore live in different modules: the `*Processors` name holders of the built-in features,
`ValueTypes`, `VersatiaPluginDescriptor` and `DescriptorVersion`, the `Direct` and `Reflective`
implementations of `Instantiator`, `Invoker` and `Setter`, `BeanResolver.supply`,
`onInstanceCreated` and `instancesOf`, `VersatiaEngine.enhance` and `disable`, `Phase.appliesTo`.
They are marked `@VersatiaInternalApi`, an opt-in marker of level `WARNING`:

```kotlin
val beans = context.state[BeanResolver.KEY]
beans?.resolve(description, target.parameters)   // the processor contract: no warning
beans?.instancesOf(target.className)             // warning: internal plumbing of Versatia
```

- **Plugin authors and custom processors never opt in.** A warning from the marker means the code
  reaches into the framework's own wiring, which may change without notice; what a processor
  needs (`EnhancedElement` and its targets, `create`, `invoke` and `set` on the interfaces,
  `BeanResolver.resolve` and `instanceOf`, the state stores) stays unmarked.
- **The generated descriptor opts in for its own file** (`@file:OptIn(VersatiaInternalApi::class)`),
  so no plugin sees a warning for code it did not write.
- **Framework modules opt in module-wide**: the `api` and `ksp` modules, VersatiaCore and the
  implementation repository of every module add
  `optIn.add("com.github.marcoral.versatia.VersatiaInternalApi")` to `kotlin.compilerOptions`.
- **Mark only what nothing outside the framework needs**, never a type a processor sees in a
  signature it uses: the marker spreads to every declaration whose signature names a marked type.

## Reloadable plugins {/* #reloadable-plugins */}

- **A plugin's configuration is [`@Value` properties](../configuration.md).** The runtime sets them
  from the shipped files at start and at every reload, before anything else of the event; a type
  the runtime does not read gets a `ValueMapper`. The default lives in the file, not in the code,
  and a missing value is reported instead of silently defaulted.
- **`Reloadable` is for the prototypes of modules.** An instance a module makes for a consuming
  plugin reads that plugin's files and has no other way to follow its reloads; `reload()` is
  called once the consumer's values are set and at every reload. A plugin's own bean never
  implements it: that is a module's job done by hand, and `@Value` does it.
- **What derives from the values is rebuilt at `PLUGIN_RELOAD_OR_START`, never in a constructor.**
  Constructors wire dependencies and run once; a `PLUGIN_RELOAD_OR_START` function sees the new
  values and rebuilds caches, recipes, tasks. `PLUGIN_RELOAD_ONLY` is for what a reload adds on
  top of a start, `PLUGIN_START_ONLY` for what the server allows once.
- **Listeners and tasks read the beans' current state** instead of copying values when they are
  created; a reload does not re-register them. See [Reloading plugins](../lifecycle/reload.md#designing-for-reload).
- **A value derived from others is read at use, recomputed or reacted to.** A getter
  (`val priceWithTax get() = ...`) first; a `PLUGIN_RELOAD_OR_START` function when it is
  expensive; a [`PreviousValueTracking`](../configuration.md#reacting-to-a-change) when the work
  should happen only on a change. A bean that needs a value while it is constructed declares it
  as a `@Value` [constructor property](../configuration.md#in-a-constructor); a constructor may read
  the values of the main class, of `object`s and of the beans it takes, never those of its own body.
- **What derives from another plugin's beans is rebuilt at `PLUGIN_RELOAD_OR_START` too.** A
  plugin using a bean another plugin exposes with `@Value` properties, or wrapping one of its beans that has them, is reloaded right after that plugin, so a function of
  that phase sees the owner's new values; nothing has to poll for them. See
  [Reloading plugins](../lifecycle/reload.md#plugins-that-use-the-reloaded-ones-values).


## Beans {/* #beans */}

- **The primary constructor is the injection point.** Its parameters are the dependencies; a
  secondary constructor is for other callers, never for the runtime.
- **An optional dependency is a default value**, `class PriceList(format: PriceFormat = PlainFormat)`,
  never a nullable parameter, a lookup or a try-and-catch: a bean providing the type replaces the
  default without a change to the class. See [Optional dependencies](../dependency-injection/index.md#optional-dependencies).
- **An integration is a conditional bean with a fallback.** `@ConditionalOnPlugin("Vault")` on
  the integration, `@Primary` on it where another provider exists, never an `isPluginEnabled`
  check in code. See [Conditional beans](../optional-plugins.md#conditional-beans).
- **An attribute written in many places becomes an annotation of your own**, meta-annotated with
  it: `@Qualifier("fast") annotation class Fast`, `@ConditionalOnPlugin("Vault") annotation class
  WithVault`. It behaves exactly like the attribute written directly. See
  [Your own attribute annotations](../dependency-injection/index.md#your-own-attribute-annotations).

## Commands {/* #commands */}

- **Commands live in a `command` subpackage** of the feature or plugin they belong to, one class
  or object per command: `com.github.marcoral.versatia.engine.command.VersatiaCommand`.
- **Commands are written with the [CommandAPI](https://commandapi.dev/) Kotlin DSL**, declared in
  an `@AutoInvoke(Phase.PLUGIN_START_ONLY)` function and unregistered at `PLUGIN_STOP`. The
  CommandAPI plugin is a soft dependency, so the object carries
  `@ConditionalOnPlugin("CommandAPI")` and is never loaded without it.
- **Permissions are named `versatia.<plugin>.command.<command>`**; VersatiaCore's reload is
  `versatia.core.command.reload`. Declare them in `plugin.yml` with a default. See
  [Commands](../commands.md).

## Entry points {/* #entry-points */}

**A basic use case is one call on an injected object.** Reloading the plugin is
`plugin.versatiaReload()` on the injected plugin instance, the running plugins are an injected
`PluginRegistry`, anything server-wide is `VersatiaEngine.<call>`; nothing a plugin does every day
goes through `ServicesManager`, a cast or a reflective helper. When a documented snippet needs such
a lookup, the API is missing a method and gets one.

**Server-wide work starts at `VersatiaEngine`.** Finding players and worlds, services,
broadcasting, console commands, thread checks and reloading another plugin are extensions on the
companion of `VersatiaEngine`: `VersatiaEngine.playerOrNull(name)`,
`VersatiaEngine.loadService<Economy>()`, `VersatiaEngine.reload("shop")`; see
[Utilities](../utilities/index.md#start-with-versatiaengine). Work on an object you hold is a call on that
object (`plugin.runTaskLater(20) { }`, `event.callEvent()`, `section.getIntOrThrow("size")`); the
facade never takes that object as a parameter. Code and docs use the facade, not `Bukkit.x` or
`server.x`, for everything it covers, in the main class too. A new member needs no receiver, is
routine, is at least as good as the Bukkit call it replaces and delegates in one expression to
Bukkit or `VersatiaEngine.instance`; logic goes into a type that runs without a server
(`PluginRegistry.getOrThrow`). The helper a shortcut replaces is moved, never kept as an alias.
`enhance` and `disable` have no shortcut: only `VersatiaPlugin` calls them.

**Derive first, configure only to override.** Whatever the build or the runtime can work out is
not written by the author: the main class is found by its supertype, a bean name comes from its
class. Explicit configuration (`versatia.pluginYml`, `@Qualifier`) exists only to override what was
derived.

**Use and grow the `util.*` helpers.** Where Bukkit plumbing gets clumsy (a nullable lookup, a
cast, a loop over a section), code calls the helper, and a missing one is added rather than worked
around. A shorthand is not forced where the direct API is at hand: a plugin logs through its own
`logger`.

## Modules {/* #modules */}

- **Features beyond the runtime are modules, never packages of VersatiaCore.** A module is a
  plugin written against VersatiaAPI alone; VersatiaCore knows nothing about it. See [Modules](../modules/index.md).
- **The entry point is an `@ExposePrototype` behind an interface.** Each consumer gets its own
  instance; per-plugin state and registrations live there, and a prototype that reads from the
  consumer implements `Reloadable`.
- **Nothing is kept in the module's own plugin:** no data folder, no logger, no reference to its
  main class. Everything belongs to the consumer, reached through a `JavaPlugin` (or `Plugin`)
  parameter of the prototype.
- **API and implementation are separate repositories**, `VersatiaModule-<Name>` (public) and
  `VersatiaModule-<Name>Impl` (private). Consumers compile against the API only, through
  VersatiaStarter or `compileOnly`, and never pack it into their JAR;
  the implementation is `internal`, and its JAR carries the API classes.
- **A module building on another injects its prototype** and relies on the runtime to make the
  whole chain for the consumer; it never looks the other module up.
- **Text from outside is inserted as text, never parsed.** A tag bridging another plugin (a
  PlaceholderAPI value, say) inserts the string as a text component, never through
  `Tag.preProcessParsed` or `context.deserialize`, since it may carry what a player typed; see
  [Tags with access to the arguments](../modules/messages.md#tags-with-access-to-the-arguments).
- **One package per part of a module.** A module made of several parts gives each its own package,
  in the API and in the implementation alike, and lets dependencies point one way: the Messages
  module keeps the bank in `messages` and the parser in `text`, which knows nothing of messages.

## Attributes the runtime reads itself {/* #attributes-the-runtime-reads-itself */}

Two attributes are read by the pipeline rather than by a processor, because they concern every
element or the plugin as a whole: `@ConditionalOnPlugin` decides whether an element is dispatched
at all, like the phase does, and `@FriendlyName` names the plugin in the runtime's registry.
Keep that list short. A fact that only one feature interprets belongs to that feature's processor.

## Errors {/* #errors */}

- **Compile time beats runtime.** Whatever can be checked from the sources is checked by the KSP
  processor, with the error pointing at the declaration (`Dependency cycle: Alpha -> Beta -> Alpha`).
  No descriptor is generated when a check fails, so a broken plugin never reaches a server.
- **Runtime errors name the plugin and the fix.** `Plugin Gamma: no bean provides
  com.example.alpha.Secret, required by com.example.gamma.Spy`;
  `Plugin MyPlugin needs the enhancement processor com.example.MyProcessor, which is not available.
  Is the plugin providing it installed and listed under depend:?` An `EnhancementException` out of
  `onEnable` disables that plugin only.
- **Fail before exposing.** The runtime loads every processor a plugin needs before any of them runs;
  the bean session resolves all dependencies before exposing anything. A plugin that cannot be
  enhanced exposes nothing to other plugins and is not registered; its resources may already be
  extracted and some of its beans constructed, which is one more reason for constructors without
  side effects.

## Encapsulation {/* #encapsulation */}

Beans, constructors, functions, properties and their types may be `private`. The generator emits a
direct call or assignment when the generated code can see the member and a reflective fallback otherwise, never
asking the author to widen visibility and never initialising classes as a side effect. New element
kinds follow the same rule: offer a `Direct` variant and a `Reflective` one.

## Notation {/* #notation */}

Kotlin is written as tersely as the language allows. The rules, in the order they most often apply:

- **Expression bodies.** A function whose body is one expression uses `=`, never a block with a
  single `return` or call: `operator fun plusAssign(other: Map<out K, Any?>) = merge(other)`.
- **Inferred types.** A property or function whose type the compiler infers does not spell it out:
  `val KEY = StateKey<BeanResolver>("beans")`,
  `const val AUTO_INVOKE = "com.github.marcoral.versatia.lifecycle.AutoInvokeEnhancementProcessor"`.
  A type is written where it changes the result: where the body calls a Java method and inference
  would produce a platform type, where the function is recursive, or where the compiler would
  expose an `internal` type through a public function.
- **No braces around one statement.** An `if`, `else`, `for` or `while` whose body is a single
  statement is written without braces, on the same line or on the next one when it is long. A
  `when` branch is written the same way.
- **No redundant modifiers.** `public` is Kotlin's default and is never written; `internal` and
  `private` mark what is not part of the contract. VersatiaAPI does not use the compiler's explicit
  API mode, which would demand both `public` and the return types above.
- **No warnings.** Code triggers no compiler warnings and no IntelliJ inspections: no redundant
  `else`, cast or `when` subject, nothing unused.

The rules apply to tests and examples as much as to the libraries: a test that is one assertion is
one line.

## Repositories and documentation {/* #repositories-and-documentation */}

- Every repository is independent: separate build, no composite build, no compile dependency on
  the runtime. Projects meet only through published artifacts and the descriptor format.
- Everything in a repository is in English: identifiers, strings, log messages, comments, docs.
- Code comments are rare; explanations live in the `docs/*.md` of the repository (implementation
  notes) and on this site (what plugin authors need). The site is updated with every change that
  affects it.
- Every API convention is written on this page; every edge rule of a feature goes into the
  "Corner cases" section of that feature's page.
- **Plugin builds share one layout.** Repositories are declared only in `settings.gradle.kts`,
  with `RepositoriesMode.FAIL_ON_PROJECT_REPOS` and `mavenLocal()` filtered to the group
  `com.github.marcoral.versatia`; the version is one `versatiaVersion` value; a plugin depends on
  `VersatiaStarter` and `VersatiaAPI-ksp`; `checkPluginYml` guards `plugin.yml`. See
  [Plugin build scripts](../contributing/building.md#plugin-build-scripts).
- **Nothing the server provides goes into a plugin JAR**: not VersatiaAPI, Kotlin, the Paper API,
  a module API or another plugin's classes. VersatiaStarter exports with `compileOnlyApi`, another
  plugin is `compileOnly`, and a test needing them at runtime uses `testImplementation`.
- Machine-specific values (`pluginsDir`) live in a gitignored `local.properties` next to a
  committed `local.properties.example`; the build works without the file.
