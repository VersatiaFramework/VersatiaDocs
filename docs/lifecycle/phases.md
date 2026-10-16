# Phases and events

Every element in the descriptor (a bean, an auto-invoked function) carries the **phase** at which
the runtime acts on it. The runtime walks a plugin's descriptor at **lifecycle events** and
dispatches only the elements whose phase applies.

## Phases

`EventType` in `com.github.marcoral.versatia`:

| `EventType`              | Applies to the events        |
|--------------------------|------------------------------|
| `PLUGIN_START_ONLY`      | `START`                      |
| `PLUGIN_RELOAD_ONLY`     | `RELOAD`                     |
| `PLUGIN_RELOAD_OR_START` | `START`, `RELOAD`            |
| `PLUGIN_STOP`            | `STOP`                       |
| `_NULL`                  | none; a technical "not given", never present in a descriptor |

## Lifecycle events

| `LifecycleEvent` | Triggered by                                          |
|------------------|-------------------------------------------------------|
| `START`          | the plugin's `onEnable`                               |
| `RELOAD`         | `/versatia reload`, `plugin.versatiaReload()` or `VersatiaEngine.reload(name)`; see [Reloading plugins](reload.md) |
| `STOP`           | the plugin's `onDisable`                              |

The bean scopes run at `PLUGIN_START_ONLY`: beans are created once and kept. The main class's
`@PluginBean` runs at `PLUGIN_RELOAD_OR_START`: at a reload it reloads the plugin's
[`Reloadable` beans](reload.md#reloadable-beans) instead. [`@Value` properties](../configuration.md) are set at
`PLUGIN_RELOAD_OR_START`, before the reloadable beans and the functions. Functions pick their phase per occurrence; put what reads configuration at `PLUGIN_RELOAD_OR_START`, so that a
[reload](reload.md#designing-for-reload) re-reads it, and keep `PLUGIN_START_ONLY` for what the
server allows once.

## How an annotation declares its phase

Authors of plain plugins never touch this; it matters when you
[define your own enhancement](../internals/enhancements.md). `@VersatiaEnhancement` must say when
its processor runs, in exactly one of two ways:

```kotlin
// Fixed for every occurrence
@VersatiaEnhancement(BeanProcessors.LOCAL, enhancementPhase = EventType.PLUGIN_START_ONLY)
annotation class LocalBean

// Chosen per occurrence through a property of the annotation
@VersatiaEnhancement(LifecycleProcessors.AUTO_INVOKE, enhancementPhaseParamRefName = "phase")
annotation class AutoInvoke(val phase: EventType)
```

With `enhancementPhaseParamRefName`, the named property must exist on the annotation, be of type
`EventType`, and every occurrence must set it to something other than `_NULL`. Setting both forms or
neither is a compile error.

When a scope is inherited (`@Service` inherits `@LocalBean`), the phase is read from the occurrence
that links the two, that is from the `@LocalBean` written on the declaration of `Service`.
