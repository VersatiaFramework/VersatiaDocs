# Best practices

The conventions the framework follows and expects from anyone extending it: plugin authors who
define their own scopes or enhancements, and contributors to VersatiaAPI and VersatiaCore. Each
rule comes with the reason behind it.

## Extending the framework

**A feature is definitions plus processors, nothing else.** Adding one puts annotations,
attributes and enums into VersatiaAPI and enhancement processors into VersatiaCore (or into your
own plugin). The loader, the dispatcher, the main class and the descriptor model stay untouched.
If a feature seems to need a change to the pipeline, the feature is modelled wrong: record what it
needs as an [attribute](internals/enhancements.md#versatiaattribute) and interpret it in the
processor.

**Record facts, not interpretations.** The descriptor stores classes, supertypes, parameters and
the annotations written on them. It never stores what a feature makes of those facts: there is no
"bean name" field, the DI processor derives the name from `@Qualifier`. Keep new features to the
same standard, so that the descriptor stays neutral and every feature reads it the same way.

## Naming

| What                                   | Convention                                                   | Example                                   |
|----------------------------------------|--------------------------------------------------------------|-------------------------------------------|
| an `EnhancementProcessor` implementation | `<Feature>EnhancementProcessor`                             | `LocalBeanEnhancementProcessor`, `AutoInvokeEnhancementProcessor` |
| a shared base of several processors    | the same suffix                                              | `BeanScopeEnhancementProcessor`           |
| the processor names a feature publishes | an `object` named `<Feature>Processors` holding `const val`s with the fully qualified names | `BeanProcessors.LOCAL`, `LifecycleProcessors.AUTO_INVOKE` |
| an enhancement annotation              | what it does to the element, no `Versatia` prefix            | `@LocalBean`, `@AutoInvoke`               |
| an attribute annotation                | the fact it records                                          | `@Qualifier`, `@Primary`                  |
| a reserved bean name                   | a constant next to the feature                               | `BeanNames.PLUGIN`                        |

The suffix makes a processor recognisable wherever its name appears: in a descriptor, in an error
message, in a stack trace. The constants exist because `@VersatiaEnhancement` takes the processor
as a string (the plugin does not compile against the runtime); a constant keeps the string in one
place and lets the compile-time step reuse it.

## Packages

Packages are organised **by feature**, as if VersatiaAPI, VersatiaCore and the `ksp` module were
slices of one monolith. The same package name holds the feature's definitions in VersatiaAPI and
its processors in VersatiaCore.

| Package (under `com.github.marcoral.versatia`) | Holds                                                                           |
|------------------------------------------------|---------------------------------------------------------------------------------|
| the root                                       | the enhancement mechanism (`@VersatiaEnhancement`, `@VersatiaAttribute`, `EnhancementProcessor`, `EnhancementContext`, `StateStore`, the phases) and the plugin bootstrap (`VersatiaPlugin`, `VersatiaEngine`); in VersatiaCore also the runtime pipeline |
| `engine.*`                                     | technical internals that deliver no feature of their own but are needed for the framework to work, such as `engine.descriptor` |
| `di`, `lifecycle`, …                           | one feature each: definitions in the API, processors in the runtime             |
| `util.*`                                       | independent helpers over the Paper API, grouped by the domain they touch        |
| `ksp`, `ksp.<feature>`                         | the compile-time step: generic parts in `ksp`, feature-specific collectors and checks in `ksp.di`, `ksp.lifecycle` |

There are no packages named after layers (`core`, `service`, `impl`): a reader looking for
"everything about beans" opens `di` in both repositories and finds it.

## Writing a processor

- **No constructor arguments.** The runtime creates a processor with its no-argument constructor
  or uses the instance of a Kotlin `object`, one per class, shared by every plugin.
- **No fields at all.** Whatever a processor must remember goes into `context.state` (per plugin,
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
- **Read facts from the element**, not from the classes: the attributes on the target and its
  parameters, the arguments of the producing annotation. A processor that needs reflection on the
  plugin's classes to find out what was annotated is working around the descriptor.

## Errors

- **Compile time beats runtime.** Whatever can be checked from the sources is checked by the KSP
  processor, with the error pointing at the declaration (`Dependency cycle: Alpha -> Beta -> Alpha`).
  No descriptor is generated when a check fails, so a broken plugin never reaches a server.
- **Runtime errors name the plugin and the fix.** `Plugin Gamma: no bean provides
  com.example.alpha.Secret, required by com.example.gamma.Spy`;
  `Plugin MyPlugin needs the enhancement processor com.example.MyProcessor, which is not available.
  Is the plugin providing it installed and listed under depend:?` An `EnhancementException` out of
  `onEnable` disables that plugin only.
- **Fail before acting.** The runtime loads every processor a plugin needs before any of them runs;
  the bean session resolves all dependencies before exposing anything. A plugin that cannot be
  enhanced is left untouched, not half-enhanced.

## Encapsulation

Beans, constructors, functions and their parameter types may be `private`. The generator emits a
direct call when the generated code can see the member and a reflective fallback otherwise, never
asking the author to widen visibility and never initialising classes as a side effect. New element
kinds follow the same rule: offer a `Direct` variant and a `Reflective` one.

## Notation

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

The rules apply to tests and examples as much as to the libraries: a test that is one assertion is
one line.

## Repositories and documentation

- Every repository is independent: separate build, no composite build, no compile dependency on
  the runtime. Projects meet only through published artifacts and the descriptor format.
- Everything in a repository is in English: identifiers, strings, log messages, comments, docs.
- Code comments are rare; explanations live in the `docs/*.md` of the repository (implementation
  notes) and on this site (what plugin authors need). The site is updated with every change that
  affects it.
- Machine-specific values (`pluginsDir`) live in a gitignored `local.properties` next to a
  committed `local.properties.example`; the build works without the file.
