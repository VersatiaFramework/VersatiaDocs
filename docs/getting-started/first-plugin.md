# Your first plugin

This page walks through a minimal plugin: a main class, two beans, a configuration value and two
lifecycle functions. The [installation](installation.md) is assumed to be done.

## The main class {/* #the-main-class */}

```kotlin
package com.example.myplugin

import com.github.marcoral.versatia.VersatiaPlugin

class MyPlugin : VersatiaPlugin()
```

`VersatiaPlugin` extends `JavaPlugin` and seals `onEnable` and `onDisable`. There is nothing to
override: on enable it hands the plugin to the runtime, on disable it tells the runtime to clean
up. Start-up code goes into auto-invoked functions instead.

## Beans {/* #beans */}

A bean is a class annotated with a *scope*. Its constructor parameters are its dependencies.

```kotlin
package com.example.myplugin

import com.github.marcoral.versatia.config.Value
import com.github.marcoral.versatia.di.LocalBean

@LocalBean
class ShopConfig {
    @Value("currency")
    lateinit var currency: String
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

## Configuration {/* #configuration */}

`currency` is a [`@Value` property](../configuration.md): the runtime sets it from `config.yml` in
the plugin's data folder. Ship the file with its default under `src/main/resources/resources/`:

```yaml
# src/main/resources/resources/config.yml
currency: coins
```

At start the file is [extracted](../resources.md) to `plugins/MyPlugin/config.yml`, where the
server owner edits it, and `currency` is set from it; at every reload it is set again. `PriceList`
reads `config.currency` when it describes an item, so it always shows the current value.

## Lifecycle functions {/* #lifecycle-functions */}

```kotlin
package com.example.myplugin

import com.github.marcoral.versatia.Phase
import com.github.marcoral.versatia.VersatiaPlugin
import com.github.marcoral.versatia.lifecycle.AutoInvoke

class MyPlugin : VersatiaPlugin() {

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    private fun start(prices: PriceList) = logger.info(prices.describe("Diamond"))

    @AutoInvoke(Phase.PLUGIN_STOP)
    private fun stop() = logger.info("Bye")
}
```

- `start` runs when the plugin enables (and on a Versatia reload). Its `PriceList` parameter is
  injected from the beans, exactly like a constructor dependency.
- `stop` runs when the plugin disables.
- Both functions are `private`; the generated code reaches them through reflection. Visibility is
  your choice, not the framework's.

Auto-invoked functions may also live in Kotlin `object`s and in beans; see
[Auto-invoked functions](../lifecycle/auto-invoke.md).

## Reaching the server {/* #reaching-the-server */}

Server-wide calls start at one class, `VersatiaEngine`. Type `VersatiaEngine.` and the completion
offers what a plugin needs every day; IntelliJ adds the import:

```kotlin
VersatiaEngine.broadcast(text("The shop is open"))
VersatiaEngine.playerOrNull("Notch")?.sendMessage(text("Welcome back"))
```

Work on an object you already hold stays on that object: `plugin.runTaskLater(20) { }`,
`player.sendMessage(...)`. The full list is in [Utilities](../utilities/index.md#start-with-versatiaengine).

## Build and look at the result {/* #build-and-look-at-the-result */}

```bash
./gradlew build
```

The processor generated `build/generated/ksp/main/kotlin/com/example/myplugin/VersatiaDescriptor.kt`.
Shortened, it reads:

```kotlin
@file:OptIn(VersatiaInternalApi::class)

object VersatiaDescriptor : VersatiaPluginDescriptor {
  override val formatMajor: Int = 1
  override val formatMinor: Int = 5

  override val elements: List<EnhancedElement>
    get() = listOf(
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.di.PluginBeanEnhancementProcessor",
        phase = Phase.PLUGIN_RELOAD_OR_START,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.di.PluginBean"),
        target = PluginTarget(
          className = "com.example.myplugin.MyPlugin",
          assignableTypes = listOf("com.example.myplugin.MyPlugin", "com.github.marcoral.versatia.VersatiaPlugin", /* ... */),
          annotations = emptyList(),
        ),
      ),
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.resources.ExtractResourcesEnhancementProcessor",
        phase = Phase.PLUGIN_RELOAD_OR_START,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.resources.ExtractResources"),
        target = PluginTarget(/* the same */),
      ),
      EnhancedElement(
        processorClass = "com.github.marcoral.versatia.di.LocalBeanEnhancementProcessor",
        phase = Phase.PLUGIN_START_ONLY,
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
        phase = Phase.PLUGIN_RELOAD_OR_START,
        annotation = AnnotationOccurrence("com.github.marcoral.versatia.lifecycle.AutoInvoke", mapOf("phase" to "PLUGIN_RELOAD_OR_START")),
        target = FunctionTarget(
          className = "com.example.myplugin.MyPlugin",
          binaryClassName = "com.example.myplugin.MyPlugin",
          functionName = "start",
          owner = MemberOwner.PLUGIN,
          annotations = emptyList(),
          parameters = listOf(Parameter("com.example.myplugin.PriceList")),
          invoker = Invoker.Reflective("com.example.myplugin.MyPlugin", "start", listOf("com.example.myplugin.PriceList")),
        ),
      ),
      // ShopConfig, its @Value property, stop ...
    )
}
```

One element per bean and per function, plus one per enhancement the main class inherits from
`VersatiaPlugin` (`@PluginBean` and `@ExtractResources` above). `MyPlugin` is a local bean named
`plugin` without any annotation, so beans and functions may ask for it (or for `JavaPlugin`)
like for any other bean. Each element names the VersatiaCore class that interprets it. `PriceList`
is public, so the descriptor calls its constructor directly; `start` is private, so it gets a
reflective invoker. Nothing in the file says in which order to create the beans: the runtime
derives that from the constructor parameters.

## Run it {/* #run-it */}

Copy the JAR to the server's `plugins/` directory next to VersatiaCore and start the server. The
log shows

```
[MyPlugin] Diamond costs 10 coins
```

and, on shutdown, `Bye`.

## Reload it {/* #reload-it */}

Change `currency` to `gems` in `plugins/MyPlugin/config.yml` and run `/versatia reload MyPlugin`
(the command needs [CommandAPI](installation.md#soft-dependencies) on the server). The runtime
sets `currency` again, then runs `start`, because its phase is `PLUGIN_RELOAD_OR_START`:

```
[MyPlugin] Diamond costs 10 gems
```

No restart and no reload code. What else a reload does is in
[Reloading plugins](../lifecycle/reload.md).

## Break it on purpose {/* #break-it-on-purpose */}

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
[Compile-time checks](../reference/compile-time-checks.md).

## Next steps {/* #next-steps */}

- Follow the learning path of the [example plugins](../examples/index.md): one feature per
  repository, each with the log lines to expect.
- Start a plugin of your own from
  [VersatiaExample-Template](https://github.com/VersatiaFramework/VersatiaExample-Template).
- Read the features one by one, from [Dependency injection](../dependency-injection/index.md) on.
