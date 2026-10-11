# Troubleshooting

Messages you may meet, what they mean and what to do. Build-time messages point at a file and
line; runtime messages come from VersatiaCore while a plugin enables and disable only that plugin.

## At build time

### `No class extending org.bukkit.plugin.java.JavaPlugin found in the sources`

The processor could not find your main class (or found several:
`Several classes extend org.bukkit.plugin.java.JavaPlugin: ...`). Make sure exactly one concrete
class extends `VersatiaPlugin`, or point the processor at `plugin.yml`:

```kotlin
ksp {
    arg("versatia.pluginYml", layout.projectDirectory.file("src/main/resources/plugin.yml").asFile.path)
}
```

### `Dependency cycle: A -> B -> A`

Two or more beans depend on each other through their constructors. Break the cycle, for example
by letting one of them receive the other through a function parameter later, or by extracting the
shared part into a third bean.

### `Dependency T of X is ambiguous; candidates: ...`

Two beans of your plugin provide the requested type. Add `@Qualifier("name")` to the parameter or
`@Primary` to one of the classes. See
[Names, qualifiers and primary beans](dependency-injection/qualifiers.md).

### `Bean name "x" is used by A, B`

Two beans share a name (by default the decapitalised simple class name). Rename one with
`@Qualifier("...")` on the class.

### `X cannot be enhanced: Y is neither the plugin's main class, an object nor a bean`

`@AutoInvoke` sits on a function of a plain class. Move it to the main class, an `object` or a
bean, or make the class a bean.

### `@FriendlyName on X has no effect: it belongs on the plugin's main class`

`@FriendlyName` names the plugin, so it goes on the main class, as one word. See
[Friendly names](lifecycle/reload.md#friendly-names).

### `@ConditionalOnPlugin on X has no effect`

The annotation sits on a class that is neither enhanced nor declares an enhanced function, on a
function without an enhancement, or on the main class. Put it on a bean, a listener, an `object`
with `@AutoInvoke` functions, or such a function. See [Optional plugins](optional-plugins.md).

### Unresolved reference to a Versatia annotation

The `ksp` plugin or the `VersatiaAPI-ksp` dependency is missing, or VersatiaAPI is not in
your local Maven repository. Run `./gradlew publishToMavenLocal` in the VersatiaAPI checkout
and check the [installation](getting-started/installation.md).

## At start-up

### `VersatiaCore is not running. Add it to depend: in plugin.yml.`

Your plugin enabled before VersatiaCore or without it. Add `VersatiaCore` under `depend:` and make
sure the JAR is in `plugins/`.

### `LinkageError` at start-up

```
java.lang.LinkageError: loader constraint violation: ... kotlin/jvm/functions/Function1 ...
```

Your plugin lists `kotlin-stdlib` (or `kotlin-reflect`) under `libraries:` in `plugin.yml`, so
Paper gave it a second copy of Kotlin in its own class loader. Remove the entry: VersatiaCore is
the single provider of the Kotlin runtime and your plugin reaches it through `depend:`. The same
happens when a plugin shades Kotlin or VersatiaAPI into its JAR.

### `Plugin X: no bean provides T, required by Y`

No bean of your plugin and no exposed bean of a plugin enabled earlier provides `T`.

- If `T` belongs to another plugin, that plugin must declare the bean `@ExposeSingleton` or
  `@ExposePrototype` (a `@LocalBean` is invisible outside its plugin) and be listed under your
  `depend:`.
- Check for a typo in the class name and that the providing plugin is installed.

### `Plugin X: T required by Y is ambiguous; candidates: ...`

Several plugins expose beans providing `T`. The candidates are listed with their owning plugin.
Add `@Qualifier("name")` to the parameter, or ask the providers to mark one `@Primary`.

### `ClassCastException` when a bean from another plugin is injected

Your plugin bundles its own copy of the other plugin's classes. Declare that plugin as
`compileOnly`, never `implementation`, so that the class is loaded from the providing plugin
through `depend:`.

### `X was built for descriptor format A, but this VersatiaCore supports B`

The plugin's descriptor format and the server's VersatiaCore do not match. Rebuild the plugin
against the VersatiaAPI that matches the installed VersatiaCore, or update VersatiaCore. See
[Descriptor format compatibility](internals/runtime.md#descriptor-format-compatibility).

### `Plugin X needs the enhancement processor Y, which is not available`

The descriptor names a processor class that cannot be loaded through the plugin's class loader.
Either the plugin was built against a VersatiaAPI with enhancements this VersatiaCore lacks (update
VersatiaCore), or the processor belongs to another plugin that is not installed or not listed under
`depend:` (install it, add it to `depend:`), or the name in `@VersatiaEnhancement` is mistyped.

### `Plugin X: Y.f() failed at START`

Your auto-invoked function threw. The original exception is the cause; the message names the
function and the lifecycle event. At `RELOAD` the same message reaches the sender of
`/versatia reload` and the console, and the other plugins are still reloaded.

### `Plugin X: Y failed to reload`

A bean implementing `Reloadable` threw from `reload()`; the original exception is the cause. The
runtime calls `reload()` right after creating the bean and at every reload of the plugin, so at
start-up the plugin does not enable, and at a reload the message reaches the sender of
`/versatia reload`. The bean may belong to a module (an instance made for your plugin), in which
case the message still names your plugin, whose data folder it reads. See
[Reloadable beans](lifecycle/reload.md#reloadable-beans).

### `Plugin X: Y takes its consuming plugin as T, which Z is not`

A prototype exposed by another plugin has a plugin-typed parameter, and your plugin is not an
instance of that type (for example, the prototype asks for `VersatiaPlugin` and your main class
extends `JavaPlugin` directly). Extend `VersatiaPlugin`, or ask the prototype's author for a wider
type. See [Scopes](dependency-injection/scopes.md#exposeprototype).

### `Plugin X has no message "k"; ...`

`messages[key]` of the [Messages module](modules/messages.md) found no such key; the message lists
the keys that start the same way, or says the plugin has no messages at all, which usually means
the `messages/` directory is missing from its data folder: ship the files under
`src/main/resources/resources/messages/`. A key is dotted, `shop.bought`, and never contains the
file name.

### `Plugin X: the friendly name "n" is already used by Y`

Two running plugins declare the same `@FriendlyName`, or one declares as its friendly name the
`plugin.yml` name of another. Rename one of them; the second plugin stays disabled until then.

### `/versatia` is an unknown command

VersatiaCore declares the command only when the [CommandAPI](https://commandapi.dev/) plugin is
installed. Drop its JAR into `plugins/` and restart; see [Reloading plugins](lifecycle/reload.md).

## Looking at what was generated

Whenever the behaviour surprises you, open
`build/generated/ksp/main/kotlin/<package of the main class>/VersatiaDescriptor.kt`. It lists every
element the runtime will act on: processor id, phase, provided types, dependencies with qualifiers,
and whether the call is direct or reflective. What is not in there does not happen.
