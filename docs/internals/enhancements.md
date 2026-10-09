# Enhancements and processors

Versatia does not hardcode what any annotation means. Every annotation the framework acts on is an
**enhancement**, and the behaviour behind it lives in an **enhancement processor**. The bean scopes
and `@AutoInvoke` are built this way, with nothing special about them.

Enhancements are the framework's only extension mechanism: a feature is a set of definitions that
the compile-time step records in the descriptor plus a processor that interprets them. The runtime
itself stays simple: read the descriptor, load the processors it names, hand each one its slice,
let the processor do the work. See [Architecture](architecture.md#enhancements) for the rules this
implies.

## Vocabulary

- **Enhancement**: an annotation whose occurrences the framework acts on. It names its processor
  class and the phase it runs at with `@VersatiaEnhancement` (`com.github.marcoral.versatia`).
- **Element**: one recorded occurrence in the descriptor, with the processor class, the phase, the
  annotation as written and the target (a class, a function or the plugin's main class).
- **Processor**: the class, loaded by name, that receives the elements naming it and does something
  with them. Processors live in VersatiaCore, or in any plugin the enhanced plugin depends on.
- **Attribute**: an annotation marked `@VersatiaAttribute`. Wherever it appears on an enhanced
  class, its constructor parameters, an enhanced function or its parameters, the descriptor
  records it with its arguments, so processors can read it. `@Qualifier` and `@Primary` are
  attributes.
- **Annotation inheritance**: an annotation class annotated with another annotation *inherits* it,
  transitively. When `@LocalBean` is annotated with `@Bean` and `@VersatiaEnhancement`, every
  class marked `@LocalBean` counts as marked with both; a `@Service` annotated with `@LocalBean`
  inherits them too.

## `@VersatiaEnhancement`

```kotlin
@Target(AnnotationTarget.ANNOTATION_CLASS)
@Retention(AnnotationRetention.BINARY)
@Repeatable
annotation class VersatiaEnhancement(
    val processorClass: String,
    val enhancementPhase: EventType = EventType._NULL,
    val enhancementPhaseParamRefName: String = "",
)
```

- `processorClass` is the fully qualified name of the processor. It is a name rather than a class
  because the plugin compiles against VersatiaAPI only; the processor is in VersatiaCore or in
  another plugin. The names of the built-in processors are kept in `BeanProcessors` and
  `LifecycleProcessors`. A mistyped name is reported when the plugin enables.
- Exactly one of `enhancementPhase` (fixed) and `enhancementPhaseParamRefName` (read from a
  property of the annotated annotation, per occurrence) must be set; see
  [Phases and events](../lifecycle/phases.md#how-an-annotation-declares-its-phase).
- It is **repeatable**: several processors can act on one annotation, each producing its own
  element.

The built-in enhancements:

```kotlin
@Bean
@VersatiaEnhancement(BeanProcessors.LOCAL, enhancementPhase = EventType.PLUGIN_START_ONLY)
annotation class LocalBean

@VersatiaEnhancement(LifecycleProcessors.AUTO_INVOKE, enhancementPhaseParamRefName = "phase")
annotation class AutoInvoke(val phase: EventType)
```

`@Bean` is a second marker that tells the compile-time step to treat annotated classes as beans:
analyse the constructor, compute the assignable types, validate the graph. An annotation that
inherits `@Bean` without a `@VersatiaEnhancement` is a compile error, because no processor would
ever see its beans.

## `@VersatiaAttribute`

```kotlin
@Target(AnnotationTarget.CLASS, AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.BINARY)
@VersatiaAttribute
annotation class Qualifier(val value: String)
```

The descriptor records facts about the annotated code, never what a feature makes of them. An
attribute is how a feature gets its facts in: the compile-time step records every attribute on an
enhanced element and on its parameters, with all arguments (defaults included), and the processor
reads them. Argument values may be strings, booleans, numbers, chars, enum entries (recorded by
name), classes (recorded by name) and lists of those; anything else, such as a nested annotation,
is a compile error at the place the attribute is used.

## Processors

```kotlin
interface EnhancementProcessor {
    fun process(elements: List<EnhancedElement>, context: EnhancementContext)
}

interface EnhancementContext {
    val plugin: Plugin
    val event: LifecycleEvent
    val state: StateStore
    val runtimeState: StateStore
    fun onPluginEnhanced(action: () -> Unit)
}
```

The runtime loads `processorClass` with `Class.forName` through the enhanced plugin's class loader.
Bukkit's plugin loaders delegate to the loaders of the plugins under `depend:`, so the class may
be in VersatiaCore or in any plugin the enhanced one depends on: a plugin can ship its own
annotations and processors without touching VersatiaCore. One instance per class is created, with
the no-argument constructor or by taking the instance of a Kotlin `object`, and kept for the
lifetime of the runtime. All processors of a plugin are loaded before any of them runs, so a
missing one leaves the plugin untouched:

```
Plugin MyPlugin needs the enhancement processor com.example.MyProcessor, which is not available. Is the plugin providing it installed and listed under depend:?
```

A processor receives, per plugin and per lifecycle event, only the elements naming it whose phase
applies to the event. The context carries the `Plugin` being enhanced (its name, logger and class
loader follow from it; `EnhancementContext.classLoader` is a shorthand) and the event.
`onPluginEnhanced` registers an action that runs once every processor has seen the plugin's
elements for this event. The bean processors use it to instantiate all beans after all scopes have
declared theirs, and the auto-invoke processor to call functions after the beans exist.

### Plugin state

Processors keep nothing per plugin in their own fields. `context.state` is a `StateStore`: a
store created for the plugin on first use, kept across `START`, `RELOAD` and `STOP`, shared by
every processor and dropped when the plugin is disabled. `context.runtimeState` is a second store
with the same interface that lives as long as VersatiaCore, for what spans plugins. Entries
implementing `AutoCloseable` are closed when their store goes, last created first. These stores
are the only way processors share anything, with each other or with their own later invocations:

```kotlin
// In VersatiaAPI: the contract every injecting processor uses
interface BeanResolver {
    fun resolve(requester: String, parameters: List<Parameter>): List<Any>
    fun instanceOf(className: String): Any?
    companion object { val KEY = StateKey<BeanResolver>("beans") }
}

// In VersatiaCore: the DI processors keep the session under that key
class PluginBeanSession(...) : BeanResolver, AutoCloseable {
    companion object {
        fun of(context: EnhancementContext) =
            context.state.getOrPut(BeanResolver.KEY) { PluginBeanSession(context.plugin.name, context.classLoader, ExposedBeanRegistry.of(context)) } as PluginBeanSession
    }
}
```

The bean processors declare into that session; the auto-invoke processor, like any processor of
any plugin that wants injected parameters, reads `context.state[BeanResolver.KEY]`; the registry
of exposed beans sits in `runtimeState`; closing the session when the plugin is disabled
withdraws the beans it exposed. The runtime knows none of this; it only closes what is closable.

The built-in processors, all in VersatiaCore:

| Processor class (`com.github.marcoral.versatia…`) | Handles                                                       |
|----------------------------------------------------|---------------------------------------------------------------|
| `.di.LocalBeanEnhancementProcessor`                           | `ClassTarget`s of `@LocalBean`                                |
| `.di.PluginBeanEnhancementProcessor`                          | the `PluginTarget` of the main class                          |
| `.di.ExposeSingletonEnhancementProcessor`                     | `ClassTarget`s of `@ExposeSingleton`                          |
| `.di.ExposePrototypeEnhancementProcessor`                     | `ClassTarget`s of `@ExposePrototype`                          |
| `.lifecycle.AutoInvokeEnhancementProcessor`                   | `FunctionTarget`s of `@AutoInvoke`                            |

## Defining your own scope

The supported way to extend the framework from a plugin without writing a processor is a **scope
annotation that inherits a built-in one**. It costs one declaration and changes nothing at runtime:

```kotlin
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.BINARY)
@LocalBean
annotation class Service
```

The descriptor records `@Service` as the producing annotation (with its arguments, if any), while
the processor class and phase come from the inherited `@LocalBean`. An annotation may inherit two
enhancements and then produces two elements per occurrence.

## Defining your own enhancement

A new feature is an annotation, optionally some attributes, and a processor. The conventions a
processor follows (naming, packages, state, errors) are collected in
[Best practices](../best-practices.md).

```kotlin
// In a library plugins compile against
@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.BINARY)
@VersatiaEnhancement("com.example.timing.TimedEnhancementProcessor", enhancementPhase = EventType.PLUGIN_START_ONLY)
annotation class Timed(val everyTicks: Long)

// In the plugin that provides the feature; other plugins list it under depend:
class TimedEnhancementProcessor : EnhancementProcessor {
    override fun process(elements: List<EnhancedElement>, context: EnhancementContext) {
        val beans = context.state[BeanResolver.KEY]
        for (element in elements) {
            val target = element.target as FunctionTarget
            val ticks = element.annotation!!.arguments["everyTicks"] as Long
            val description = target.className + "." + target.functionName + "()"
            val arguments = beans?.resolve(description, target.parameters).orEmpty()
            // schedule target.invoker.invoke(context.classLoader, context.plugin, arguments) every `ticks` ...
        }
    }
}
```

The compile-time step records every function carrying `@Timed` as a `FunctionTarget` whose
`annotation` holds `everyTicks`; the runtime loads `TimedEnhancementProcessor` through the enhanced
plugin's class loader; injected parameters come from the plugin's `BeanResolver`, the same contract
`@AutoInvoke` uses. Nothing in VersatiaCore changes. The compile-time step still enforces the general
rules on enhanced functions (no extension, suspend, abstract or generic functions; injectable
parameters) and on enhanced classes.

## How the compile-time step works

The `ksp` module of VersatiaAPI runs once per compilation:

1. It locates the plugin's main class: the single concrete `JavaPlugin` subclass in the sources, or
   the `main:` entry of the file named by the KSP option `versatia.pluginYml` when it is set.
2. It walks every class declaration in the sources (compile-time scanning is fine, runtime scanning
   is not) and, for each annotation on a class, resolves the annotation class and checks whether it
   inherits `@Bean`. Hits become bean declarations: type, name, scope occurrence, enhancements
   (processor class and phase), attributes, constructor parameters with their attributes,
   assignable types, reachability. The main class becomes a plugin declaration under the fixed
   name `plugin`.
3. It collects functions annotated with an enhancement, checks their owner kind and parameters.
4. It validates the bean graph, the plugin included: duplicate names, qualifier mismatches,
   ambiguity, cycles.
5. It builds the descriptor with KotlinPoet and writes it through KSP's `CodeGenerator` as an
   aggregating output depending on all source files.

Any error stops the build and suppresses the descriptor. The module mirrors the feature packages
of the API (`ksp.di`, `ksp.lifecycle`); the generic parts, among them the resolution of inherited
enhancements and the recording of attributes, sit in `ksp` itself.
