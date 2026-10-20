# Scopes and lifetime

## `@LocalBean` {/* #localbean */}

```kotlin
@LocalBean
class PriceList(config: ShopConfig)
```

One instance, created when the plugin enables, injectable only into that plugin's own beans and
functions. Other plugins never see it, even if they list this plugin under `depend:`.

The plugin's main class is a local bean too, through `@PluginBean` on `VersatiaPlugin`; the
instance is the one Bukkit created. See [The plugin itself](index.md#the-plugin-itself).

## `@ExposeSingleton` {/* #exposesingleton */}

```kotlin
@ExposeSingleton
class Clock {
    fun now() = Instant.now()
}
```

One instance for the whole server. The declaring plugin creates it when it enables; every plugin
enabled afterwards that asks for `Clock` (or any of its supertypes) receives **the same instance**.

## `@ExposePrototype` {/* #exposeprototype */}

```kotlin
@ExposePrototype
class PluginSession(val plugin: VersatiaPlugin, val clock: Clock) {
    val id = counter.incrementAndGet()
}
```

A factory rather than an instance. The declaring plugin gets its own `PluginSession`; every plugin
enabled afterwards that asks for one gets a **fresh instance, one per consuming plugin**. Within one
plugin all injection points share that single instance.

The factory reuses the constructor arguments that were resolved when the owner started, with one
exception: a parameter satisfied by the owner's [plugin bean](index.md#the-plugin-itself) receives the
**plugin the instance is made for**. In the example, a `PluginSession` created for the consumer
`Report` gets `Report`'s instance as `plugin` and the `Clock` the owner resolved, so a consumer does
not need to provide (or even know) the prototype's other dependencies. Because any plugin may ask,
that parameter must be typed `VersatiaPlugin` or one of its supertypes (`JavaPlugin`, `Plugin`);
the owner's concrete class is a compile error. The owner's own instance is never handed out.

A parameter satisfied by another prototype, the owner's own or one exposed by a third plugin, is
resolved for the consumer as well: the instance is the one the consumer's own beans share. A
`Messages` prototype taking a `Text` prototype therefore gives each consumer a chain of instances
made for it; this is how the [Messages module](../modules/messages.md) is built, and how
[modules](../modules/index.md) build on each other. The `Logger`, `ComponentLogger`
and `PluginScope` every plugin has are such prototypes, so a prototype taking one logs and
launches coroutines as its consumer; see
[Beans every plugin has](index.md#beans-every-plugin-has).

A [`@Value` property](../configuration.md) of a prototype is read from the owner's files and set
on every instance, so `@ExposePrototype class PriceList { @Value("tax") var tax = 0.0 }` gives
each consumer its own `PriceList` holding the owner's current `tax`. A reload of the owner sets the
new values on all of them and then reloads each consumer, whose reload functions see them; see
[`@Value` on a prototype](../lifecycle/reload.md#value-on-a-prototype).


## Processors {/* #processors */}

Each scope is interpreted by its own runtime processor, named in the annotation and recorded in
the descriptor:

| Scope               | Processor class in VersatiaCore                          |
|---------------------|----------------------------------------------------------|
| `@LocalBean`        | `com.github.marcoral.versatia.di.LocalBeanEnhancementProcessor`       |
| `@ExposeSingleton`  | `com.github.marcoral.versatia.di.ExposeSingletonEnhancementProcessor` |
| `@ExposePrototype`  | `com.github.marcoral.versatia.di.ExposePrototypeEnhancementProcessor` |

All three run at `PLUGIN_START_ONLY`, and a scope that would send one of them another phase is a
compile error. The main class has a processor of its own, `PluginBeanEnhancementProcessor`,
behind `@PluginBean`. The names are kept in `BeanProcessors`.

## Lifetime {/* #lifetime */}

A plugin's beans, including the ones it exposes, live **exactly as long as the plugin**:

- They are created when the plugin enables, depth-first along the dependencies, after the whole
  descriptor has been read. That is why beans of all three scopes within one plugin may depend on
  each other freely.
- They are kept for the plugin's whole life. Functions running at reload or stop receive the same
  instances that were created at start; nothing is re-created on reload.
- They are dropped when the plugin disables, after its stop-phase functions ran. Exposed beans
  disappear with their owner.
- A bean that implements `AutoCloseable` is closed at that moment, last created first, so a bean
  is closed before the beans it depends on, and a stop-phase function can still use all of them.
  This covers the prototype instances made for the plugin too: a database pool a module made for
  your plugin closes with your plugin. An exposed singleton is closed with its owner, never by the
  plugins using it. A failing `close()` is reported as `Plugin X: <class> failed to close` and does
  not keep the others open.

Nothing is tied to server start. A plugin enabled later, for example through a plugin manager,
sees the exposed beans of the plugins running at that moment, and re-enabling a plugin replaces its
beans.

:::warning[Dependants and their providers]

Bukkit enables a plugin after everything under its `depend:`, and at server stop disables it
before them. List the plugin whose beans you inject under `depend:` and the order is right at
start and at stop. Disabling one plugin alone, through a plugin manager, is not covered: its
consumers keep running with the beans it dropped; see
[Lifetime across plugins](cross-plugin.md#lifetime-across-plugins).

:::

## Choosing a scope {/* #choosing-a-scope */}

| You want                                                | Use                 |
|---------------------------------------------------------|---------------------|
| an internal collaborator                                | `@LocalBean`        |
| a shared service with one state for the whole server    | `@ExposeSingleton`  |
| per-plugin state or a per-plugin handle onto a shared service | `@ExposePrototype` |
