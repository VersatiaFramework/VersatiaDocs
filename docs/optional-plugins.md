# Optional plugins

import ExampleCard from '@site/src/components/ExampleCard';

`@ConditionalOnPlugin("Vault")` keeps an element out of the runtime's work unless every named
plugin is enabled on the server. It is how a Versatia plugin integrates with a plugin that may or
may not be installed, without `Class.forName` checks and without a `NoClassDefFoundError` when the
other plugin is missing.

<ExampleCard repo="VersatiaExample-DI-OptionalPlugins" file="src/main/kotlin/com/github/marcoral/versatia/example/optionalplugins/VaultPayments.kt">
A <code>Payments</code> bean backed by Vault when it is installed, <code>@ConditionalOnPlugin("Vault")</code> and <code>@Primary</code>, a fallback otherwise, and the condition written once as <code>@NeedsVault</code>.
</ExampleCard>

```kotlin
import com.github.marcoral.versatia.ConditionalOnPlugin
import com.github.marcoral.versatia.VersatiaEngine
import com.github.marcoral.versatia.loadService

@ConditionalOnPlugin("Vault")
@LocalBean
class VaultBridge(private val plugin: ShopPlugin) : Listener {
    private val economy = VersatiaEngine.loadService<Economy>()

    @AutoInvoke(Phase.PLUGIN_START_ONLY)
    fun announce() = plugin.logger.info("Vault found, prices are charged")

    @EventHandler
    fun onBuy(event: BuyEvent) = economy.withdrawPlayer(event.player, event.price)
}
```

With Vault installed, `VaultBridge` is created, its listener registered and `announce` called.
Without it, none of that happens and the class is never loaded, so its references to Vault's
classes never have to resolve.

## Where it goes {/* #where-it-goes */}

| On                                        | Effect when a named plugin is missing                                                                |
|-------------------------------------------|------------------------------------------------------------------------------------------------------|
| a bean or a listener class                | the bean is not created, the listener is not registered, the `@AutoInvoke` functions and the [`@Value` properties](configuration.md) of the class are skipped, the class is not loaded |
| an `object`                               | none of its `@AutoInvoke` functions is called, none of its `@Value` properties is read, and the object is not loaded |
| an `@AutoInvoke` function                 | the function is not called; the class is still loaded and, for a bean, created                       |
| a [`BackgroundTask`](tasks.md#background-tasks) class | the task is not created and never runs; when it is a bean, the bean does not exist either; the class is not loaded |

The values of a conditional class are not read, so their file need not exist without the other
plugin. A function may add plugins of its own to those its class names; all of them have to be
enabled. VersatiaCore's own command is an `object` written this way:

```kotlin
@ConditionalOnPlugin("CommandAPI")
object VersatiaCommand {
    @AutoInvoke(Phase.PLUGIN_START_ONLY)
    fun register(core: VersatiaCore) = commandAPICommand("versatia", core) { /* ... */ }
}
```

## Several conditions {/* #several-conditions */}

The annotation is repeatable, and all occurrences combine: every named plugin has to be enabled.
These two declarations mean the same:

```kotlin
@ConditionalOnPlugin("Vault") @ConditionalOnPlugin("WorldGuard")
@LocalBean
class RegionShop

@ConditionalOnPlugin("Vault", "WorldGuard")
@LocalBean
class RegionShop
```

An annotation of your own annotated with `@ConditionalOnPlugin` counts as the condition, so a
condition used in many places is written once:

```kotlin
@Target(AnnotationTarget.CLASS, AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.BINARY)
@ConditionalOnPlugin("Vault")
annotation class WithVault

@WithVault
@LocalBean
class VaultBridge
```

## Conditional beans {/* #conditional-beans */}

A bean whose condition is not met **does not exist**: it provides nothing, and another provider
of the same type stands in. That makes a fallback one declaration:

```kotlin
interface Payments {
    fun charge(player: Player, price: Int): Boolean
}

@LocalBean
class FreePayments : Payments {
    override fun charge(player: Player, price: Int) = true
}

@ConditionalOnPlugin("Vault")
@LocalBean @Primary
class VaultPayments : Payments {
    private val economy = VersatiaEngine.loadService<Economy>()

    override fun charge(player: Player, price: Int) = economy.withdrawPlayer(player, price.toDouble()).transactionSuccess()
}

@LocalBean
class Checkout(private val payments: Payments)   // VaultPayments with Vault, FreePayments without
```

With Vault, both beans exist and the `@Primary` decides. Without it, `VaultPayments` does not
exist, so its `@Primary` does not count and `FreePayments` is the only candidate. An
[optional dependency](dependency-injection/index.md#optional-dependencies) does the same without
a second bean: `class Checkout(private val payments: Payments = FreePayments)` with `FreePayments`
an `object`.

The build checks every combination of the optional plugins: a bean that needs a provider which
exists only with Vault, without being conditional on Vault itself, is a compile error:

```
Checkout depends on VaultPayments, which exists only with @ConditionalOnPlugin("Vault"); make
Checkout conditional on the same plugins or declare a provider without the condition
```

and two providers left without a decision while a plugin is enabled are reported as
`Dependency Payments of Checkout is ambiguous while "Vault" is enabled; candidates: ...`.

## `softdepend:` {/* #softdepend */}

List the plugins under `softdepend:` in `plugin.yml`:

```yaml
softdepend:
  - Vault
```

Bukkit then enables them before your plugin when they are present, which is what the runtime
checks. Without the entry the other plugin may enable later, and the element is left out although
the plugin is on the server.

## Compile-time checks {/* #compile-time-checks */}

The annotation is rejected where it would have no effect: on a class that is neither enhanced nor
declares an enhanced function or property (`@ConditionalOnPlugin on Tools has no effect: Tools is
not enhanced and declares no enhanced function or property`), on a function without an
enhancement, on the plugin's main class (`@ConditionalOnPlugin cannot apply to MyPlugin, the
plugin's main class`), and when it names no plugin. The same holds when it comes through an
annotation of your own. The full list is in
[Compile-time checks](reference/compile-time-checks.md#attributes-the-runtime-reads).

## How it works {/* #how-it-works */}

The compile-time step records the annotation as an attribute of the element, one occurrence per
annotation, the inherited ones included; a function or property element also records the
attributes of its declaring class, which is how the values of a conditional class are skipped. When the plugin starts, the runtime keeps the elements whose
plugins are enabled and dispatches only those; the skipped classes are logged at `INFO`, one line
per missing plugin: `Skipped VersatiaCommand: CommandAPI is not installed`, or `Skipped
VaultBridge: Vault is installed but was not enabled before MyPlugin; list it under softdepend: in
plugin.yml` when the plugin exists but the server started it later. A function or property
skipped by a condition of its own, in a class without it, is named as the member, since its class
still exists: `Skipped VaultPayments, JoinBonus.vaultFound(): Vault is not installed`. The check is
`PluginManager.isPluginEnabled(name)`, nothing is loaded to find out. VersatiaCore's own
`/versatia reload` is declared this way, conditional on the CommandAPI plugin; see
[Reloading plugins](lifecycle/reload.md).

## Corner cases {/* #corner-cases */}

- **Decided once, at start.** The runtime checks the plugins when your plugin starts and keeps the
  result until it stops. A plugin enabled later, through a plugin manager say, does not bring the
  skipped elements back, and one disabled later does not remove them; restart your plugin to
  decide again. A reload never changes the decision.
- **A skipped `@Primary`** gives way: the remaining providers are resolved as if it were not
  declared.
- **The main class** can never be conditional; the plugin itself is always there.
- **The skip log names what is gone.** A conditional class is named by its simple name, its
  functions and properties with it; a member conditional on its own, in a class that stays, is
  named `Class.function()` or `Class.property`.
