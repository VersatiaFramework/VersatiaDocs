# Beans across plugins

import ExampleCard from '@site/src/components/ExampleCard';

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Beans marked `@ExposeSingleton` or `@ExposePrototype` can be injected into other plugins. This page
is written from the consumer's side; the providing plugin only has to pick the scope.

<ExampleCard repo="VersatiaExample-DI-SharedBeans" file="provider/src/main/kotlin/com/github/marcoral/versatia/example/sharedbeans/SharedBeans.kt">
A provider plugin exposing a singleton and a prototype, and a consumer plugin injecting both.
</ExampleCard>

## Set-up in the consumer

Say the plugin **Shop** exposes `Clock` (a singleton) and `PluginSession` (a prototype).

<Tabs>
<TabItem value="build-gradle-kts" label="build.gradle.kts">


```kotlin
dependencies {
    implementation("com.github.marcoral.versatia:VersatiaStarter:$versatiaVersion")
    ksp("com.github.marcoral.versatia:VersatiaAPI-ksp:$versatiaVersion")

    compileOnly("com.example:Shop:1.0.0")
}
```

1. `compileOnly`, never `implementation`: on the server the `Clock` class is loaded from the
   Shop plugin itself, and nothing the server provides goes into your JAR. With `implementation`,
   shading the JAR (Shadow) would bundle a second `Clock` class and break the injection with a
   `ClassCastException`; see [In your build](../getting-started/installation.md#in-your-build).

</TabItem>
<TabItem value="plugin-yml" label="plugin.yml">


```yaml
depend:
  - VersatiaCore
  - Shop
```

Both entries matter. `VersatiaCore` provides the runtime and Kotlin; `Shop` guarantees that its
beans have been exposed before this plugin enables and lets Bukkit's class loader resolve
`Clock` from it.

</TabItem>
<TabItem value="kotlin" label="Kotlin">


```kotlin
@LocalBean
class SessionReport(private val clock: Clock, private val session: PluginSession)

class ReportPlugin : VersatiaPlugin() {
    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    fun summary(clock: Clock) {
        logger.info("Shared clock started at ${clock.startedAt}")
    }
}
```

Nothing marks `Clock` as foreign. It is requested like any other dependency.

</TabItem>
</Tabs>
## What the consumer receives

| Scope of the bean in Shop | The consumer gets                                                    |
|---------------------------|----------------------------------------------------------------------|
| `@ExposeSingleton`        | the instance Shop created, no copy                                   |
| `@ExposePrototype`        | a new instance made for this plugin; all of this plugin's injection points share it |
| `@LocalBean`              | nothing: local beans are invisible outside their plugin             |

A prototype is created by the owner's factory, with the constructor arguments the owner resolved at
its own start, except for what depends on the consumer: a parameter typed `VersatiaPlugin` (or a
supertype) receives the consumer's own instance, so a `PluginSession(val plugin: VersatiaPlugin, ...)`
made for the consumer knows which plugin it serves, and a parameter typed by another prototype
receives the instance of that prototype made for the consumer. In the log the line comes from
Shop's class, but on behalf of the consumer. A prototype instance implementing `Reloadable` is
reloaded with the consumer, not with Shop; see [Reloading plugins](../lifecycle/reload.md#reloadable-beans).

## When the bean is missing

The processor cannot know what other plugins expose, so a dependency that no local bean provides
**compiles**. If nothing provides it at runtime either, the consumer fails to enable:

```
Error occurred while enabling ReportPlugin v1.0.0
EnhancementException: Plugin ReportPlugin: no bean provides com.example.shop.Clock,
    required by com.example.report.SessionReport
```

Bukkit disables that plugin and leaves the others running. Nothing was exposed to other plugins
before the failure, but the plugin's start was under way: its resources may have been extracted,
and the beans created before the failing one, the plugin bean among them, have run their
constructors. Keep constructors free of side effects and this never matters. The same message
appears for a typo in a class name or a provider plugin that is not installed.

If two plugins expose the same type, the message lists them:

```
Plugin ReportPlugin: com.example.shop.Clock required by com.example.report.SessionReport is ambiguous;
candidates: "clock" (com.example.shop.Clock, from Shop), "clock" (com.example.other.Clock, from Other).
Add @Qualifier at the injection point or mark one bean @Primary
```

`@Qualifier` on the parameter picks one of them; see
[Names, qualifiers and primary beans](qualifiers.md).

## Lifetime across plugins

Exposed beans live as long as their owner. When Shop is disabled, its `Clock` and the
`PluginSession` factory disappear. At server stop Bukkit disables plugins in the reverse order of
enabling, so a consumer that lists Shop under `depend:` stops before Shop and can still use its
beans in its `PLUGIN_STOP` functions. A plugin manager that disables Shop alone does not disable
its consumers: they keep the instances they were given, which Shop has dropped and, if they
are `AutoCloseable`, closed. A consumer
enabled later sees whatever is exposed at that moment.

A worked example with two real plugins is in [Example plugins](../examples/index.md).
