# Your first plugin

This page walks through a minimal plugin: a main class, two beans and two lifecycle functions. The
[installation](installation.md) is assumed to be done.

## The main class

```kotlin
package com.example.myplugin

import com.github.marcoral.versatia.VersatiaPlugin

class MyPlugin : VersatiaPlugin()
```

`VersatiaPlugin` extends `JavaPlugin` and seals `onEnable` and `onDisable`. There is nothing to
override: on enable it hands the plugin to the runtime, on disable it tells the runtime to clean
up. Start-up code goes into auto-invoked functions instead.

## Beans

A bean is a class annotated with a *scope*. Its constructor parameters are its dependencies.

```kotlin
package com.example.myplugin

import com.github.marcoral.versatia.di.LocalBean

@LocalBean
class ShopConfig {
    val currency = "coins"
}

@LocalBean
class PriceList(private val config: ShopConfig) {
    fun describe(item: String) = "$item costs 10 ${config.currency}"
}
```

`@LocalBean` means: one instance, visible only inside this plugin. The other scopes,
`@ExposeSingleton` and `@ExposePrototype`, share a bean with other plugins; see
[Scopes and lifetime](../dependency-injection/scopes.md).

Nothing has to be registered. The processor finds every class carrying a scope annotation and
records it in the descriptor.

## Lifecycle functions

```kotlin
package com.example.myplugin

import com.github.marcoral.versatia.EventType
import com.github.marcoral.versatia.VersatiaPlugin
import com.github.marcoral.versatia.lifecycle.AutoInvoke

class MyPlugin : VersatiaPlugin() {

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    private fun start(prices: PriceList) {
        logger.info(prices.describe("Diamond"))
    }

    @AutoInvoke(EventType.PLUGIN_STOP)
    private fun stop() {
        logger.info("Bye")
    }
}
```

- `start` runs when the plugin enables (and on a Versatia reload). Its `PriceList` parameter is
  injected from the beans, exactly like a constructor dependency.
- `stop` runs when the plugin disables.
- Both functions are `private`; the generated code reaches them through reflection. Visibility is
  your choice, not the framework's.

Auto-invoked functions may also live in Kotlin `object`s and in beans; see
[Auto-invoked functions](../lifecycle/auto-invoke.md).

## Build and look at the result

```bash
./gradlew build
```

The processor generated `build/generated/ksp/main/kotlin/com/example/myplugin/VersatiaDescriptor.kt`.
Shortened, it reads:

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
          className = "com.example.myplugin.MyPlugin",
          assignableTypes = listOf("com.example.myplugin.MyPlugin", "com.github.marcoral.versatia.VersatiaPlugin", /* ... */),
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
        processorClass = "com.github.marcoral.versatia.di.LocalBeanEnhancementProcessor",
        phase = EventType.PLUGIN_START_ONLY,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.di.LocalBean"),
        target = ClassTarget(
          className = "com.example.myplugin.PriceList",
          assignableTypes = listOf("com.example.myplugin.PriceList"),
          annotations = emptyList(),
          constructorParameters = listOf(Parameter("com.example.myplugin.ShopConfig")),
          instantiator = Instantiator.Direct { args -> PriceList(args[0] as ShopConfig) },
        ),
      ),
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.lifecycle.AutoInvokeEnhancementProcessor",
        phase = EventType.PLUGIN_RELOAD_OR_START,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.lifecycle.AutoInvoke", mapOf("phase" to "PLUGIN_RELOAD_OR_START")),
        target = FunctionTarget(
          className = "com.example.myplugin.MyPlugin",
          binaryClassName = "com.example.myplugin.MyPlugin",
          functionName = "start",
          owner = FunctionOwner.PLUGIN,
          annotations = emptyList(),
          parameters = listOf(Parameter("com.example.myplugin.PriceList")),
          invoker = Invoker.Reflective("com.example.myplugin.MyPlugin", "start", listOf("com.example.myplugin.PriceList")),
        ),
      ),
      // ShopConfig, stop ...
    )
}
```

One element per bean and per function, plus one for the main class: `MyPlugin` is a local bean
named `plugin` without any annotation, so beans and functions may ask for it (or for `JavaPlugin`)
like for any other bean. Each element names the VersatiaCore class that interprets it. `PriceList`
is public, so the descriptor calls its constructor directly; `start` is private, so it gets a
reflective invoker. Nothing in the file says in which order to create the beans: the runtime
derives that from the constructor parameters.

## Run it

Copy the JAR to the server's `plugins/` directory next to VersatiaCore and start the server. The
log shows

```
[MyPlugin] Diamond costs 10 coins
```

and, on shutdown, `Bye`.

## Break it on purpose

Make `ShopConfig` depend on `PriceList`:

```kotlin
@LocalBean
class ShopConfig(prices: PriceList)
```

The build now fails with

```
Dependency cycle: ShopConfig -> PriceList -> ShopConfig
```

pointing at the file and line. No descriptor is generated, so the problem can never reach a server.
The full list of what the processor checks is in
[Compile-time checks](../dependency-injection/compile-time-checks.md).
