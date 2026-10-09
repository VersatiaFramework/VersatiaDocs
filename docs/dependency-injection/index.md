# Dependency injection

Versatia wires objects through **constructor injection** driven entirely by the generated
descriptor. There is no container to configure, no module to write and nothing to look up at
runtime: you annotate classes, the build validates the graph, the runtime instantiates it.

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
- A class with **exactly one constructor**. Its parameters must be non-nullable, non-generic class
  types; no `vararg`, no type parameters.

Not allowed: abstract classes, interfaces, `object`s, inner classes and generic classes. Each of
these is a compile error; see [Compile-time checks](compile-time-checks.md).

## The plugin itself

Your main class is a local bean without any annotation. Bukkit creates the instance, and the
runtime registers it before creating anything else, so any bean or auto-invoked function can ask
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

## Resolution in one paragraph

For a parameter of type `T`, the runtime first looks at the beans of the same plugin that provide
`T`; if none does, at the beans other plugins have exposed. One candidate wins. Several candidates
are an error unless a `@Qualifier` on the parameter or a `@Primary` on one of the classes decides.
A dependency that no bean provides is a compile error only when it is local; otherwise the runtime
reports it when the plugin enables. The details are in
[Names, qualifiers and primary beans](qualifiers.md).

## Where beans are used

- As constructor dependencies of other beans.
- As parameters of [auto-invoked functions](../lifecycle/auto-invoke.md).
- As the receiver of an auto-invoked function declared inside a bean class.

The plugin instance is available at all three places as well.
