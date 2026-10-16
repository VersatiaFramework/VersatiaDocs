# Dependency injection

import ExampleCard from '@site/src/components/ExampleCard';

Versatia wires objects through **constructor injection** driven entirely by the generated
descriptor. There is no container to configure, no module to write and nothing to look up at
runtime: you annotate classes, the build validates the graph, the runtime instantiates it.

<ExampleCard repo="VersatiaExample-DI-Beans" file="src/main/kotlin/com/github/marcoral/versatia/example/beans/Beans.kt">
Three local beans created in dependency order, one of them taking the plugin instance.
</ExampleCard>

## Declaring a bean

A bean is a class annotated with a *scope*. Its constructor parameters are its dependencies, and
they are satisfied by other beans.

```kotlin
import com.github.marcoral.versatia.di.LocalBean

interface Greeter {
    fun greeting(): String
}

@LocalBean
class FriendlyGreeter : Greeter {
    override fun greeting() = "Welcome!"
}

@LocalBean
class Banner(private val greeter: Greeter) {
    fun show() = println(greeter.greeting())
}
```

`Banner` asks for a `Greeter`, an interface. A bean *provides* its own type and every supertype
except `Any`, so `FriendlyGreeter` satisfies the request.

## The scopes

| Annotation          | Who can inject it                                   | Instances                                  |
|---------------------|-----------------------------------------------------|--------------------------------------------|
| `@LocalBean`        | only the plugin that declares it                    | one per plugin                             |
| `@ExposeSingleton`  | the declaring plugin and every plugin enabled later | one, shared                                |
| `@ExposePrototype`  | the declaring plugin and every plugin enabled later | one per consuming plugin                   |

All three live in `com.github.marcoral.versatia.di`. Their semantics and the lifetime of beans are
covered in [Scopes and lifetime](scopes.md); sharing beans between plugins in
[Beans across plugins](cross-plugin.md).

## What a bean can be

- A top-level or **nested** class (`object Settings { @LocalBean class Format }` works).
- `public`, `internal` or **`private`**. Private classes and constructors are instantiated through
  reflection; everything else through a direct constructor call. Encapsulation is yours to decide.
- A class whose **primary constructor**, or its only constructor when it has no primary one, is
  injected. Secondary constructors next to a primary one are ignored; several constructors and no
  primary one are a compile error. The parameters must be non-nullable, non-generic class types;
  no `vararg`, no type parameters. A type alias stands for the class it names.
- A constructor parameter with a **default value** is an [optional dependency](#optional-dependencies),
  and one marked `@Value` is a [configuration value](../configuration.md#in-a-constructor).

Not allowed: abstract classes, interfaces, `object`s, inner classes and generic classes. Each of
these is a compile error; see [Compile-time checks](compile-time-checks.md).

## The plugin itself

Your main class is a local bean: `VersatiaPlugin` carries `@PluginBean`, and an enhancement on a
base class applies to every plugin extending it. Bukkit creates the instance, and the runtime
registers it before creating anything else, so any bean or auto-invoked function can ask
for it, by its own type or by any supertype such as `JavaPlugin`:

```kotlin
@LocalBean
class Storage(plugin: JavaPlugin) {
    val folder = plugin.dataFolder
}

@LocalBean
class Commands(private val plugin: MyPlugin)
```

Its bean name is always **`plugin`**, whatever the class is called, so `@Qualifier("plugin")`
selects it where several candidates provide the requested type, and no other bean may take that
name. `@Primary` on the main class works like on any bean, and the bean is only visible inside its
own plugin. Two things are compile errors: a `@Qualifier` on the main class
(`MyPlugin is the plugin's main class and its bean is always named "plugin"; remove @Qualifier`)
and a scope annotation on it
(`MyPlugin is the plugin's main class and a local bean already; remove @LocalBean`), because a
second plugin instance must never be constructed.

## Your own scope annotations

A scope is itself an annotation marked `@Bean`. Annotating your own annotation with an existing
scope *inherits* it, so you can give your beans a domain-specific name:

```kotlin
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.BINARY)
@LocalBean
annotation class Service

@Service
class OrderService(repository: OrderRepository)
```

`@Service` inherits `@LocalBean`, and through it everything a local bean is. The relation is
transitive, and the descriptor still records `@Service` as the annotation that produced the
element. The mechanism behind this is described in
[Enhancements and processors](../internals/enhancements.md).

## Your own attribute annotations

The attributes work the same way. An annotation of your own annotated with `@Qualifier`,
`@Primary`, `@ConditionalOnPlugin` or `@FriendlyName` counts as that attribute wherever you write
it, transitively, exactly as if the attribute were written directly:

```kotlin
@Target(AnnotationTarget.CLASS, AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.BINARY)
@Qualifier("fast")
annotation class Fast

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.BINARY)
@Primary
annotation class Preferred

@LocalBean @Fast
class FastClock : Clock          // the bean is named "fast"

@LocalBean @Preferred
class SystemClock : Clock        // the default Clock

@LocalBean
class Race(@Fast clock: Clock)   // FastClock
```

An attribute that is not repeatable may reach an element once: `@Fast` next to `@Qualifier("x")`
is a compile error, `Race has @Qualifier more than once: written directly and inherited from @Fast;
keep one`. `@ConditionalOnPlugin` is repeatable, so its occurrences combine; see
[Optional plugins](../optional-plugins.md#several-conditions).

## Resolution in one paragraph

For a parameter of type `T`, the runtime first looks at the beans of the same plugin that provide
`T`; if none does, at the beans other plugins have exposed. One candidate wins. Several candidates
are an error unless a `@Qualifier` on the parameter or a `@Primary` on one of the classes decides.
A dependency that no bean provides is a compile error only when it is local; otherwise the runtime
reports it when the plugin enables. The details are in
[Names, qualifiers and primary beans](qualifiers.md).

## Optional dependencies

A constructor parameter with a default value is optional: when a bean provides its type, the bean
is injected; when none does, the default is used.

```kotlin
interface PriceFormat {
    fun format(price: Int): String
}

object PlainFormat : PriceFormat {
    override fun format(price: Int) = "$price coins"
}

@LocalBean
class PriceList(private val format: PriceFormat = PlainFormat) {
    fun describe(item: String, price: Int) = "$item costs ${format.format(price)}"
}
```

Without a `PriceFormat` bean, here or exposed by another plugin, `PriceList` gets `PlainFormat`.
Declare a `@LocalBean class FancyFormat : PriceFormat`, or install a plugin exposing one, and it is
injected instead, with no change to `PriceList`. Several candidates are still an ambiguity, as for
any parameter. This works for every class the runtime creates: beans, [listeners](../events.md)
and the classes of [subclass enhancements](../internals/enhancements.md#subclass-enhancements).
It does not apply to the parameters of [auto-invoked functions](../lifecycle/auto-invoke.md), which
are always injected.

## Conditional beans

A bean carrying [`@ConditionalOnPlugin`](../optional-plugins.md) whose plugins are not enabled
**does not exist**: it is not created, it provides nothing, and a `@Primary` on it counts only
while its condition holds. Another provider of the same type stands in. The build checks that
every dependency is satisfied in each case; see
[Conditional beans](../optional-plugins.md#conditional-beans).

## Where beans are used

- As constructor dependencies of other beans.
- As parameters of [auto-invoked functions](../lifecycle/auto-invoke.md).
- As the receiver of an auto-invoked function declared inside a bean class.

The plugin instance is available at all three places as well.

## Corner cases

- **Many optional plugins.** The build checks the dependencies of conditional beans for every
  combination of the plugins their `@ConditionalOnPlugin` names. With more than 10 such plugins
  for one dependency it checks only two cases, none of them enabled and all of them; a problem in
  another combination is reported by the runtime when the plugin enables.
- **A prototype's constructor values.** A `@Value` constructor parameter of an `@ExposePrototype`
  is read from the owner's files. An instance made for a consumer receives what the owner's
  instance received at start: a `var` value, which reloads do not update, or the owner's
  `PreviousValueTracking` cell, which they do. A `@Value` property in the class body is set on the
  owner's instance only; see [`@Value` on a prototype](../lifecycle/reload.md#value-on-a-prototype).
- **A prototype's optional dependencies.** An instance made for a consumer reuses what the owner
  resolved, its default included; it never looks among the consumer's beans for that parameter.
- **A default on a function parameter.** A parameter of an auto-invoked function with a default
  value is injected like any other; only constructor parameters are optional.
- **A plugin that disables itself while its beans are created** stops the creation: beans not yet
  created are never created, nothing is exposed to other plugins, and a bean created after the
  disable is closed at once if it is `AutoCloseable`. The same holds for start and reload
  functions: once the plugin is disabled, the remaining ones of that event do not run.

