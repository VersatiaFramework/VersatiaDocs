# The descriptor

import ExampleCard from '@site/src/components/ExampleCard';

The descriptor is the generated `object VersatiaDescriptor`, placed in the package of the plugin's
main class so that the runtime can load it by name: for `com.example.MyPlugin` it is
`com.example.VersatiaDescriptor`. It implements `VersatiaPluginDescriptor` from
`com.github.marcoral.versatia.engine.descriptor`.

The descriptor is a technical detail of the enhancement mechanism, not a feature. It records
**facts** about the annotated code (classes, supertypes, parameters, the annotations written on
them) and never what a feature makes of those facts: there is no "bean name" field, the DI
processor derives the name from the recorded `@Qualifier` attribute.

## Shape

The descriptor is deliberately **flat**: a format version and a list of `EnhancedElement`s.

| Field of `EnhancedElement` | Meaning                                                                   |
|----------------------------|---------------------------------------------------------------------------|
| `processorClass`           | the processor that interprets it, for example `com.github.marcoral.versatia.di.LocalBeanEnhancementProcessor` |
| `phase`                    | the `EventType` at which it runs; see [Phases and events](../lifecycle/phases.md) |
| `annotation`               | the enhancement annotation that produced it, with all its arguments        |
| `target`                   | what was annotated: a `ClassTarget`, a `FunctionTarget` or a `PluginTarget` |
| `origin`                   | the class the annotation is physically written on: the target's own class, a base class of the main class for inherited enhancements, or the class carrying a [subclass enhancement](enhancements.md#subclass-enhancements) |

No iteration order, grouping or phase structure is baked into the file; the runtime decides how to
walk it. Changing how VersatiaCore iterates therefore never requires regenerating plugins.

### `AnnotationOccurrence` and `Parameter`

An `AnnotationOccurrence` is an annotation as written at one place: its class name and its
arguments, defaults included. Values are strings, booleans, numbers, chars, enum entry names,
class names and lists of those. A `Parameter` is a constructor or function parameter: its type and
the [attributes](enhancements.md#versatiaattribute) written on it.

### `ClassTarget`

A class whose instances the runtime may create.

| Field                   | Meaning                                                               |
|-------------------------|-----------------------------------------------------------------------|
| `className`             | Kotlin qualified name (`com.example.Outer.Inner`)                     |
| `assignableTypes`       | the class and every supertype except `Any`                            |
| `annotations`           | the attributes written on the class                                   |
| `constructorParameters` | one `Parameter` per constructor parameter, in order                   |
| `instantiator`          | how to create an instance from resolved arguments                     |

### `FunctionTarget`

A function the runtime may call.

| Field             | Meaning                                                                     |
|-------------------|-----------------------------------------------------------------------------|
| `className`       | Kotlin qualified name of the declaring class                                |
| `binaryClassName` | JVM name of the declaring class (`com.example.Outer$Inner`)                 |
| `functionName`    | the function                                                                |
| `owner`           | `PLUGIN`, `OBJECT` or `INSTANCE`: who holds the instance to call it on; `INSTANCE` means the processor must obtain it (for `@AutoInvoke`, the bean of that class) |
| `annotations`     | the attributes written on the function                                      |
| `parameters`      | one `Parameter` per parameter                                               |
| `invoker`         | how to call it with a receiver and resolved arguments                        |

### `PluginTarget`

The plugin's main class. It carries `className`, `assignableTypes` and `annotations` like a
`ClassTarget`, but no parameters and no instantiator: Bukkit creates the instance, the runtime
only hands it out. One element is produced per class enhancement written on the main class or on
one of its supertypes, all listed first; `VersatiaPlugin` contributes `@PluginBean` (the main
class as a bean) and `@ExtractResources` (the plugin's resources).

## Direct access versus reflection

Encapsulation is preserved: beans, constructors, functions and their parameter types may be
`private`. The generator picks per element:

<ExampleCard repo="VersatiaExample-DI-PrivateBeans" file="src/main/kotlin/com/github/marcoral/versatia/example/privatebeans/Vault.kt">
Private beans and a private auto-invoked function; compare the direct and reflective entries in its descriptor.
</ExampleCard>

- **`Instantiator.Direct` / `Invoker.Direct`** when the class, the member and every parameter type
  are `public` or `internal`. The generated code contains the call itself:

    ```kotlin
    Instantiator.Direct { args -> ConsoleGreeter(args[0] as Clock) }
    Invoker.Direct { instance, args -> (instance as MyPlugin).start(args[0] as Clock) }
    ```

    No reflection, no `setAccessible`.

- **`Instantiator.Reflective` / `Invoker.Reflective`** otherwise. They store JVM binary names and
  at runtime load the class **without initialising it** (`Class.forName(name, false, loader)`),
  find the matching declared constructor or method and make it accessible.
- A Kotlin `object` reached through a subclass enhancement is named directly
  (`Instantiator.Direct { _ -> Console }`) when visible and read from its `INSTANCE` field
  (`Instantiator.ObjectInstance`) otherwise.

## A generated file

For

```kotlin
class AlphaPlugin : VersatiaPlugin()

interface Greeter

@ExposeSingleton
class Clock

@LocalBean
internal class ConsoleGreeter(val clock: Clock) : Greeter

@LocalBean
private class HiddenAudit(@Qualifier("consoleGreeter") val greeter: Greeter)
```

the processor emits (shortened):

```kotlin
object VersatiaDescriptor : VersatiaPluginDescriptor {
  override val formatMajor: Int = 1
  override val formatMinor: Int = 0

  override val elements: List<EnhancedElement>
    get() = listOf(
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.di.PluginBeanEnhancementProcessor",
        phase = EventType.PLUGIN_START_ONLY,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.di.PluginBean"),
        target = PluginTarget(
          className = "com.example.alpha.AlphaPlugin",
          assignableTypes = listOf("com.example.alpha.AlphaPlugin", "com.github.marcoral.versatia.VersatiaPlugin", "org.bukkit.plugin.java.JavaPlugin", "org.bukkit.plugin.Plugin", /* ... */),
          annotations = emptyList(),
        ),
      ),
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.resources.ExtractResourcesEnhancementProcessor",
        phase = EventType.PLUGIN_START_ONLY,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.resources.ExtractResources"),
        target = PluginTarget(/* the same */),
      ),
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.di.ExposeSingletonEnhancementProcessor",
        phase = EventType.PLUGIN_START_ONLY,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.di.ExposeSingleton"),
        target = ClassTarget(
          className = "com.example.alpha.Clock",
          assignableTypes = listOf("com.example.alpha.Clock"),
          annotations = emptyList(),
          constructorParameters = emptyList(),
          instantiator = Instantiator.Direct { _ -> Clock() },
        ),
      ),
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.di.LocalBeanEnhancementProcessor",
        phase = EventType.PLUGIN_START_ONLY,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.di.LocalBean"),
        target = ClassTarget(
          className = "com.example.alpha.ConsoleGreeter",
          assignableTypes = listOf("com.example.alpha.ConsoleGreeter", "com.example.alpha.Greeter"),
          annotations = emptyList(),
          constructorParameters = listOf(Parameter("com.example.alpha.Clock")),
          instantiator = Instantiator.Direct { args -> ConsoleGreeter(args[0] as Clock) },
        ),
      ),
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.di.LocalBeanEnhancementProcessor",
        phase = EventType.PLUGIN_START_ONLY,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.di.LocalBean"),
        target = ClassTarget(
          className = "com.example.alpha.HiddenAudit",
          assignableTypes = listOf("com.example.alpha.HiddenAudit"),
          annotations = emptyList(),
          constructorParameters = listOf(Parameter("com.example.alpha.Greeter", listOf(AnnotationOccurrence("com.github.marcoral.versatia.di.Qualifier", mapOf("value" to "consoleGreeter"))))),
          instantiator = Instantiator.Reflective("com.example.alpha.HiddenAudit", listOf("com.example.alpha.Greeter")),
        ),
      ),
    )
}
```

## Format version

The format has its own `major.minor` version, `VersatiaPluginDescriptor.FORMAT_VERSION`, currently
**`1.0`**. It is independent of the library version. A runtime accepts exactly the version it was
built with and rejects any other with a message naming the plugin, both versions and the fix; see
[The runtime](runtime.md#descriptor-format-compatibility).

The generator writes the two numbers as literal `Int` properties (`formatMajor`, `formatMinor`), so
a runtime can read them from any descriptor, even one whose other members it does not understand,
before deciding what to do with it. For the same reason `elements` is a getter rather than an
initialised field: loading the descriptor class resolves nothing the elements refer to, so a
descriptor of another format still yields a clear version message instead of a
`NoClassDefFoundError`.
