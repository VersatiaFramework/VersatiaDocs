# Troubleshooting

Messages you may meet, what they mean and what to do. Build-time messages point at a file and
line; runtime messages come from VersatiaCore while a plugin enables, reloads or disables and
affect only that plugin. Every check the build makes, with its message, is listed in
[Compile-time checks](compile-time-checks.md).

## At build time {/* #at-build-time */}

### `No class extending org.bukkit.plugin.java.JavaPlugin found in the sources` {/* #no-class-extending-orgbukkitpluginjavajavaplugin-found-in-the-sources */}

The processor could not find your main class (or found several:
`Several classes extend org.bukkit.plugin.java.JavaPlugin: ...`). Make sure exactly one concrete
class extends `VersatiaPlugin`, or point the processor at `plugin.yml`:

```kotlin
ksp {
    arg("versatia.pluginYml", layout.projectDirectory.file("src/main/resources/plugin.yml").asFile.path)
}
```

### `Dependency cycle: A -> B -> A` {/* #dependency-cycle-a---b---a */}

Two or more beans depend on each other through their constructors. Break the cycle, for example
by letting one of them receive the other through a function parameter later, or by extracting the
shared part into a third bean.

### `Dependency T of X is ambiguous; candidates: ...` {/* #dependency-t-of-x-is-ambiguous-candidates- */}

Two beans of your plugin provide the requested type. Add `@Qualifier("name")` to the parameter or
`@Primary` to one of the classes. See
[Names, qualifiers and primary beans](../dependency-injection/qualifiers.md). The variant
`... is ambiguous while "Vault" is enabled` means the candidates exist together only with that
plugin: mark one of them `@Primary`; see [Conditional beans](../optional-plugins.md#conditional-beans).

### `X depends on Y, which exists only with @ConditionalOnPlugin("Vault"); ...` {/* #x-depends-on-y-which-exists-only-with-conditionalonpluginvault- */}

`Y` is the only provider of what `X` needs, and it does not exist without Vault, while `X` does.
Make `X` conditional on the same plugins, declare a provider without the condition, or give the
parameter a default value to make it [optional](../dependency-injection/index.md#optional-dependencies).

### `Bean name "x" is used by A, B` {/* #bean-name-x-is-used-by-a-b */}

Two beans share a name (by default the decapitalised simple class name). Rename one with
`@Qualifier("...")` on the class.

### `X must have a primary constructor or exactly one constructor to be a bean` {/* #x-must-have-a-primary-constructor-or-exactly-one-constructor-to-be-a-bean */}

The runtime injects the primary constructor. Declare one, or keep a single constructor. The
related `Injected parameter p of X must not be nullable` (or `must not be generic`, `must not be
vararg`) rejects a parameter the runtime cannot inject: use a non-null class type, or a default
value for a dependency that may be absent. See
[What a bean can be](../dependency-injection/index.md#what-a-bean-can-be).

### `X has @Qualifier more than once: written directly and inherited from @Fast; keep one` {/* #x-has-qualifier-more-than-once-written-directly-and-inherited-from-fast-keep-one */}

An attribute reaches the element twice, here once written and once through an
[annotation of your own](../dependency-injection/index.md#your-own-attribute-annotations). Remove one
of them. Only `@ConditionalOnPlugin` may be repeated.

### `X cannot be enhanced: Y is neither the plugin's main class, an object nor a bean` {/* #x-cannot-be-enhanced-y-is-neither-the-plugins-main-class-an-object-nor-a-bean */}

`@AutoInvoke` or `@Value` sits on a member of a plain class. Move it to the main class, an
`object` or a bean, or make the class a bean.

### `X.f must not be suspend to be enhanced; implement BackgroundTask ...` {/* #xf-must-not-be-suspend-to-be-enhanced-implement-backgroundtask- */}

The full message is `X.f must not be suspend to be enhanced; implement BackgroundTask for work that
runs with the plugin, or launch from an injected PluginScope`. The runtime calls an `@AutoInvoke`
function inside the event and does not wait for a coroutine. Work that runs as long as the plugin
is a [`BackgroundTask`](../tasks.md#background-tasks); anything else takes a `PluginScope` and
launches from it, in a plain function:

```kotlin
@AutoInvoke(Phase.PLUGIN_START_ONLY)
fun warmUp(scope: PluginScope) = scope.launch { cache.fill() }
```

### `@FriendlyName on X has no effect: it belongs on the plugin's main class` {/* #friendlyname-on-x-has-no-effect-it-belongs-on-the-plugins-main-class */}

`@FriendlyName` names the plugin, so it goes on the main class, as one word. See
[Friendly names](../lifecycle/reload.md#friendly-names).

### `@ConditionalOnPlugin on X has no effect: ...` {/* #conditionalonplugin-on-x-has-no-effect- */}

The annotation sits on a class that is neither enhanced nor declares an enhanced function or
property, or on a function without an enhancement. Put it on a bean, a listener, an `object`
with `@AutoInvoke` functions or `@Value` properties, or such a function. On the main class the
message is `@ConditionalOnPlugin cannot apply to X, the plugin's main class`: the plugin itself
cannot be optional. See [Optional plugins](../optional-plugins.md).

### `X.y must be a var to be enhanced` {/* #xy-must-be-a-var-to-be-enhanced */}

`@Value` sits on a `val`. The runtime sets the property, so it must be a `var`, or a `val`
holding a [`PreviousValueTracking`](../configuration.md#reacting-to-a-change). In a constructor the
message ends with `declare the constructor parameter as a property`: write `var` (or a `val` of a
`PreviousValueTracking`) before the parameter; see
[In a constructor](../configuration.md#in-a-constructor). The same family of messages rejects a
top-level property (`move it into the plugin's main class, an object or a bean`), a property of a
plain class and a function parameter (`only properties can, constructor properties included`).

### `@Value on X.y: T is not a supported type` {/* #value-on-xy-t-is-not-a-supported-type */}

The property's type is not one the runtime can read: the message lists what is
(scalars, enums, the Bukkit types, `List`, `Set` and `Map<String, T>` of scalars and enums, any of
them nullable). Name a [mapper](../configuration.md#mappers) in `@Value(mapper = ...)` for a
structured value, or change the type; `MutableList` is not `List`.

### `@Value on X.y: mapper M maps to T, which U cannot hold` {/* #value-on-xy-mapper-m-maps-to-t-which-u-cannot-hold */}

The `ValueMapper<T>` named in the annotation produces a type the property cannot hold; change
the property's type or the mapper. The related `mapper M must be an object or a class with a
no-argument constructor` means the runtime could not create the mapper.

### `plugin.yml must list VersatiaCore under depend:` {/* #pluginyml-must-list-versatiacore-under-depend */}

The `checkPluginYml` task of the example and template builds found a `plugin.yml` that would not
work: it does not parse, lacks `name`, `version` or `main`, or does not depend on VersatiaCore.
Fix the file; see [plugin.yml](../getting-started/installation.md#pluginyml).

### `Versatia plugins use plugin.yml; remove paper-plugin.yml` {/* #versatia-plugins-use-pluginyml-remove-paper-pluginyml */}

The same task found `src/main/resources/paper-plugin.yml`. Paper would load the JAR as a Paper
plugin, with an isolated class loader, instead of a Bukkit plugin depending on VersatiaCore.
Delete the file and keep the plugin's settings in `plugin.yml`; see
[plugin.yml, not paper-plugin.yml](../getting-started/coming-from-bukkit.md#pluginyml-not-paper-pluginyml).

### Unresolved reference to a Versatia annotation {/* #unresolved-reference-to-a-versatia-annotation */}

The build does not see VersatiaAPI: the `VersatiaStarter` (or `VersatiaAPI`) dependency is
missing, or the artifact is not in your local Maven repository. Run
`./gradlew publishToMavenLocal` in the VersatiaAPI and VersatiaStarter checkouts and check the
[installation](../getting-started/installation.md). A missing `ksp` plugin or `VersatiaAPI-ksp`
dependency does not show here: the build succeeds and the plugin fails at start with
[`Descriptor X not found`](#descriptor-x-not-found).

## At start-up {/* #at-start-up */}

### `VersatiaCore is not running. Add it to depend: in plugin.yml.` {/* #versatiacore-is-not-running-add-it-to-depend-in-pluginyml */}

Your plugin enabled before VersatiaCore or without it. Add `VersatiaCore` under `depend:` and make
sure the JAR is in `plugins/`.

### `Descriptor X not found` {/* #descriptor-x-not-found */}

The full message is `Plugin X: descriptor com.example.VersatiaDescriptor not found. Is the
VersatiaAPI KSP processor applied to the plugin build?`. The plugin JAR has no descriptor, so the code generator did not run. Apply the
`com.google.devtools.ksp` plugin and add `ksp("com.github.marcoral.versatia:VersatiaAPI-ksp:...")`;
see [In your build](../getting-started/installation.md#in-your-build). The related
`Plugin X: com.example.VersatiaDescriptor is not a Kotlin object; it is not a Versatia descriptor`
means a class of your own uses the reserved name next to the main class: rename it.

### `Plugin X: descriptor D comes from ..., not from the plugin itself` {/* #plugin-x-descriptor-d-comes-from--not-from-the-plugin-itself */}

The descriptor class next to your main class was found in another plugin or library your plugin
can see, not in your JAR: your build did not generate one, and another plugin has its main class
in the same package. Apply the KSP processor (above) and give your main class a package of its
own, such as `com.example.myplugin`.

### `Skipped X: Y is not installed` {/* #skipped-x-y-is-not-installed */}

Not an error: `X` is marked [`@ConditionalOnPlugin("Y")`](../optional-plugins.md) and `Y` was not
enabled when your plugin started, so `X` does not exist until the next start; an `X` written
`Class.function()` is a function that is not called, while its class exists. The variant `Y is
installed but was not enabled before X; list it under softdepend: in plugin.yml` means the server
started `Y` after your plugin: add `Y` under `softdepend:`.

### `LinkageError` at start-up {/* #linkageerror-at-start-up */}

```
java.lang.LinkageError: loader constraint violation: ... kotlin/jvm/functions/Function1 ...
```

Your plugin has a second copy of Kotlin in its own class loader. Either it lists `kotlin-stdlib`
(or `kotlin-reflect`) under `libraries:` in `plugin.yml`, or it lists a library built on Kotlin,
such as `kotlinx-serialization-json`, which brings `kotlin-stdlib` along. Remove the entry and shade
such a library without Kotlin, as shown in [plugin.yml](../getting-started/installation.md#pluginyml):
VersatiaCore is the single provider of the Kotlin runtime and your plugin reaches it through
`depend:`. The same happens when a plugin shades Kotlin or VersatiaAPI into its JAR.

`kotlinx.coroutines` is a special case: VersatiaCore provides it too, and your plugin must neither
list it nor shade it, not even without Kotlin. A second copy breaks with a `LinkageError` naming a
`kotlinx/coroutines` class, or a `ClassCastException` between two `kotlinx.coroutines` classes of
the same name, as soon as a coroutine reaches the framework: a `PluginScope`, a `Condition`,
`delayTicks`. A coroutine library for Bukkit such as MCCoroutine brings its own copy and the same
failure. Remove the entry or the dependency; the classes come from VersatiaAPI at compile time and
from VersatiaCore on the server.

### `Plugin X: no bean provides T, required by Y` {/* #plugin-x-no-bean-provides-t-required-by-y */}

No bean of your plugin and no exposed bean of a plugin enabled earlier provides `T`.

- If `T` belongs to another plugin, that plugin must declare the bean `@ExposeSingleton` or
  `@ExposePrototype` (a `@LocalBean` is invisible outside its plugin) and be listed under your
  `depend:`.
- Check for a typo in the class name and that the providing plugin is installed.
- If your plugin can work without it, give the constructor parameter a default value; see
  [Optional dependencies](../dependency-injection/index.md#optional-dependencies).

### `Plugin X: no bean provides com.github.marcoral.versatia.task.PluginScope, ...` {/* #plugin-x-no-bean-provides-comgithubmarcoralversatiataskpluginscope- */}

VersatiaCore exposes `PluginScope` to every plugin, so this means the installed VersatiaCore is
older than the VersatiaAPI the plugin was built with: install the VersatiaCore matching that API.
Usually the [descriptor format message](#x-was-built-for-descriptor-format-a-but-this-versatiacore-supports-b)
comes first. The related `Plugin X: the PluginScope bean is C, not VersatiaCore's; background
tasks and the stop order need VersatiaCore's` means a bean of your plugin provides `PluginScope`
and shadows VersatiaCore's; remove it and inject the scope.

### `Plugin X: T required by Y is ambiguous; candidates: ...` {/* #plugin-x-t-required-by-y-is-ambiguous-candidates- */}

Several plugins expose beans providing `T`. The candidates are listed with their owning plugin.
Add `@Qualifier("name")` to the parameter, or ask the providers to mark one `@Primary`.

### `ClassCastException` when a bean from another plugin is injected {/* #classcastexception-when-a-bean-from-another-plugin-is-injected */}

Your plugin bundles its own copy of the other plugin's classes. Declare that plugin as
`compileOnly`, never `implementation`, so that the class is loaded from the providing plugin
through `depend:`; nothing the server provides belongs in your JAR, see
[In your build](../getting-started/installation.md#in-your-build).

### `Plugin X: "n" (C from Y) cannot be injected as T: the two plugins load separate copies of that class` {/* #plugin-x-n-c-from-y-cannot-be-injected-as-t-the-two-plugins-load-separate-copies-of-that-class */}

The runtime caught the case above before the cast: your plugin `X` and the provider `Y` each load
their own `T`. Either one of them bundles the classes of the other (declare that dependency
`compileOnly`), or `Y` was reloaded on its own by a plugin manager, which gives it new classes:
restart the server instead.

### `Plugin X: bean "n" (C) could not be created: ...` {/* #plugin-x-bean-n-c-could-not-be-created- */}

The constructor or an initialiser of bean `C` threw; the rest of the message and the cause are
what it threw. With `for Z` before the colon, the instance was being made for plugin `Z`, which
injects the `@ExposePrototype` bean `C` of `X`; fix `C`, or what `Z` passes it.

### `X was built for descriptor format A, but this VersatiaCore supports B` {/* #x-was-built-for-descriptor-format-a-but-this-versatiacore-supports-b */}

The plugin's descriptor format and the server's VersatiaCore do not match. Rebuild the plugin
against the VersatiaAPI that matches the installed VersatiaCore, or update VersatiaCore. See
[Descriptor format compatibility](../internals/runtime.md#descriptor-format-compatibility).

### `Plugin X needs the enhancement processor Y, which is not available` {/* #plugin-x-needs-the-enhancement-processor-y-which-is-not-available */}

The descriptor names a processor class that cannot be loaded through the plugin's class loader.
Either the plugin was built against a VersatiaAPI with enhancements this VersatiaCore lacks (update
VersatiaCore), or the processor belongs to another plugin that is not installed or not listed under
`depend:` (install it, add it to `depend:`), or the name in `@VersatiaEnhancement` is mistyped.

### `Plugin X: Y cannot be loaded to ... it` {/* #plugin-x-y-cannot-be-loaded-to--it */}

The descriptor names a class the JAR does not contain, usually because the JAR comes from an
incomplete or stale build. Run `./gradlew clean build` and deploy the new JAR. The related
`Y is not a Kotlin object, so there is no instance to ...` means a class recorded as an `object`
was changed into a class without a rebuild.

### `Plugin X: Y.f() failed at START` {/* #plugin-x-yf-failed-at-start */}

Your auto-invoked function threw. The original exception is the cause; the message names the
function and the lifecycle event. At `RELOAD` the same message reaches the sender of
`/versatia reload` and the console, and the other plugins are still reloaded.

### `Plugin X: Y failed to reload` {/* #plugin-x-y-failed-to-reload */}

A bean implementing `Reloadable` threw from `reload()`; the original exception is the cause. The
runtime calls `reload()` once the plugin's beans exist and its values are set, and at every
reload of the plugin, so at start-up the plugin does not enable, and at a reload the message reaches the sender of
`/versatia reload`. The bean may belong to a module (an instance made for your plugin), in which
case the message still names your plugin, whose data folder it reads. See
[Reloadable beans](../lifecycle/reload.md#reloadable-beans).

### `Plugin X: Y failed to close` {/* #plugin-x-y-failed-to-close */}

A bean implementing `AutoCloseable` threw from `close()` while the plugin disabled. The other
beans are closed all the same; the original exception is the cause. See
[Lifetime](../dependency-injection/scopes.md#lifetime).

### `Plugin X: Y takes its consuming plugin as T, which Z is not` {/* #plugin-x-y-takes-its-consuming-plugin-as-t-which-z-is-not */}

A prototype exposed by another plugin has a plugin-typed parameter, and your plugin is not an
instance of that type (for example, the prototype asks for `VersatiaPlugin` and your main class
extends `JavaPlugin` directly). Extend `VersatiaPlugin`, or ask the prototype's author for a wider
type. See [Scopes](../dependency-injection/scopes.md#exposeprototype).

### `Plugin X: Y.z could not be read from f.yml: ...` {/* #plugin-x-yz-could-not-be-read-from-fyml- */}

A `@Value` property could not be set: the rest of the message says why, with the full key path.
`No value present at "k"` means the key is missing and the property is not nullable; `Value at
"k" is not an int` and friends mean the wrong shape, including a single value where a list
belongs. Nothing was set, so at start the plugin stays disabled and at a reload it keeps its
previous values. See [Configuration values](../configuration.md#missing-and-invalid-values).

### `Plugin X: f.yml could not be read` {/* #plugin-x-fyml-could-not-be-read */}

The file is not valid YAML. The cause is the parser's message with the line and column; a tab
used for indentation and a missing space after a colon are the usual culprits.

### `Plugin X: f.yml is missing from the data folder; ...` {/* #plugin-x-fyml-is-missing-from-the-data-folder- */}

A `@Value` names a file the data folder does not have. When the plugin JAR ships a default copy,
the message says `put it back, or reload the plugin to restore the default copy from the plugin
JAR`: run `/versatia reload <name>` and the file is [extracted](../resources.md) again. When it
does not, the message says `the plugin JAR has no default copy`: create the file, or, as the
plugin's developer, ship it under `src/main/resources/resources/`. Check the `file` argument of
the annotation too; the path is relative to the data folder.

### `Plugin X: the @Value file "f" lies outside the data folder; ...` {/* #plugin-x-the-value-file-f-lies-outside-the-data-folder- */}

A `@Value` names a file that, once its path is normalised, is not inside the plugin's data folder,
so the runtime refuses to read it. The compile-time step already rejects absolute paths and `..`
segments written in the source; name a path relative to the data folder, such as `config.yml` or
`rules/limits.yml`.

### `Plugin X has no message "k"; ...` {/* #plugin-x-has-no-message-k- */}

`messages[key]` of the [Messages module](../modules/messages.md) found no such key; the message lists
the keys that start the same way, or says the plugin has no messages at all, which usually means
the `messages/` directory is missing from its data folder: ship the files under
`src/main/resources/resources/messages/`. A key is dotted, `shop.bought`, and never contains the
file name.

### `Plugin X: messages/f.yml is not valid YAML: ...` {/* #plugin-x-messagesfyml-is-not-valid-yaml- */}

A message file could not be read, so the plugin does not enable, or at a reload keeps its previous
messages. Its siblings: `is not UTF-8 encoded; save it as UTF-8`,
`message "k" is defined twice in messages/f.yml`, `message "k" is defined in both messages/a.yml
and messages/b.yml`, `"k" is a message in ... and a group of messages in ...; rename one of them`,
`message "k" in messages/f.yml is not text` and `... is a list whose lines must all be text`. Fix
the file and reload. See [The files](../modules/messages.md#the-files).

### `Plugin X: message "k" in messages/f.yml cannot be shown: ...` {/* #plugin-x-message-k-in-messagesfyml-cannot-be-shown- */}

The message was read, but using it failed; the rest says why, such as
`No argument "nmae"; the arguments are: name, item`. Fix the brace in the file, or pass the
argument in the code. See [Errors](../modules/messages.md#errors).

### `Plugin X: the friendly name "n" is already used by Y` {/* #plugin-x-the-friendly-name-n-is-already-used-by-y */}

Two running plugins declare the same `@FriendlyName`, or one declares as its friendly name the
`plugin.yml` name of another. Rename one of them; the second plugin stays disabled until then.

### `Plugin X: Y expects Z to supply parameter n, which it has not` {/* #plugin-x-y-expects-z-to-supply-parameter-n-which-it-has-not */}

For authors of [enhancement processors](../internals/enhancements.md): a constructor parameter is
marked as supplied by processor `Z` (as `@Value` does for a constructor property), but `Z` did not
call `supply` before the beans were created. The related `the argument of parameter n of Y was
supplied after the beans had been created` means it called too late: supply in `process`, not in
`onPluginEnhanced`.

## While the plugin runs {/* #while-the-plugin-runs */}

### A task logs a failure {/* #a-task-logs-a-failure */}

A background task, a coroutine of a `PluginScope`, a repeated run or a condition check threw; the
runtime logged it on the plugin's logger and the server goes on. The lines, what each means and
what follows are listed under [Failures](../tasks.md#failures). The usual causes:

- `Background task X failed; it starts again at the next reload`: `run()` threw; fix it and
  reload the plugin to start the task again.
- `Background task X ended with TimeoutCancellationException although nobody cancelled it`: a
  `withTimeout` inside `run()` ran out; use `withTimeoutOrNull`, or catch the exception.
- `... a repeated run failed; it runs again on schedule ...`: one run of `everyTicks` or `every`
  threw; the loop goes on and logs the same failure once.
- `IllegalStateException: Asynchronous ...` from Paper, logged as `A coroutine failed`: a Bukkit call
  inside `withContext(Dispatchers.IO) { }`; move it after the block, back on the server thread.

### Something runs twice after a reload {/* #something-runs-twice-after-a-reload */}

A coroutine launched from a `PluginScope` in a `PLUGIN_RELOAD_OR_START` function: the scope
survives the reload, so every reload starts one more copy. Make the work a
[`BackgroundTask`](../tasks.md#background-tasks), which the reload cancels and starts again, or
launch it from a `PLUGIN_START_ONLY` function.

### `Module with the Main dispatcher is missing` {/* #module-with-the-main-dispatcher-is-missing */}

The code uses `Dispatchers.Main`, which exists on Android and in desktop UIs, never on a server.
Launch from the injected `PluginScope`, whose coroutines run on the server thread, or switch with
`withContext(scope.serverThread) { }`; see [Threads](../tasks.md#threads).

### `No server clock in this coroutine: ...` {/* #no-server-clock-in-this-coroutine- */}

`delayTicks`, `everyTicks`, `every` or `condition` was called in a coroutine that is not the
plugin's: one started with `runBlocking`, `GlobalScope` or a scope of your own. Launch it from the
injected `PluginScope`, or run it in a `BackgroundTask`.

### `A condition is created on the server thread, where its check runs; ...` {/* #a-condition-is-created-on-the-server-thread-where-its-check-runs- */}

`scope.condition` or `condition` was called on another thread, inside `withContext(Dispatchers.IO)`
or from an asynchronous event say. Create the condition in a bean, a start function or a coroutine
of the scope on the server thread; its triggers may still fire on any thread.

## At a reload {/* #at-a-reload */}

### `Plugin X: reload must run on the server's main thread; ...` {/* #plugin-x-reload-must-run-on-the-servers-main-thread- */}

The reload was asked for from an asynchronous task or another thread; nothing was reloaded. Hand
it over to the main thread with `plugin.runTask { plugin.versatiaReload() }`; see
[On the main thread](../lifecycle/reload.md#on-the-main-thread). `start must run ...` and `stop
must run ...` mean the same for a hand-made `enhance` or `disable` call.

### `dispatchConsoleCommand("...") must run on the server's main thread; ...` {/* #dispatchconsolecommand-must-run-on-the-servers-main-thread- */}

`VersatiaEngine.dispatchConsoleCommand` was called off the main thread, which Bukkit does not
allow; the command did not run. Wrap the call in `plugin.runTask { ... }`. The same wording, with
the name you pass, comes from `VersatiaEngine.checkPrimaryThread("...")` in your own code.

### `/versatia` is an unknown command {/* #versatia-is-an-unknown-command */}

VersatiaCore declares the command only when the [CommandAPI](https://commandapi.dev/) plugin,
release 12.x, is installed. Drop its JAR into `plugins/` and restart; see
[Reloading plugins](../lifecycle/reload.md). Without it a plugin reloads itself with
`versatiaReload()`. If the log shows `/versatia could not be registered. The installed CommandAPI
... may not be compatible ...`, CommandAPI is there but in a release VersatiaCore cannot use;
install a 12.x release.

### `X failed to reload: ...` {/* #x-failed-to-reload- */}

The reply of `/versatia reload` names the plugin and the chain of causes. A configuration mistake
is logged as one warning; anything else as an error with the stack trace. The entries above
explain the causes; the plugin keeps running with its previous state.

### `Y failed to reload after X, whose beans it uses: ...` {/* #y-failed-to-reload-after-x-whose-beans-it-uses- */}

X reloaded, and Y, which holds a bean X exposes with `@Value` properties (or wrapping one), failed in the reload that
[follows it](../lifecycle/reload.md#plugins-that-use-the-reloaded-ones-values). X stays reloaded and Y
keeps its previous state; the rest of the message is the cause, as for any failed reload. Fix it
and reload Y.

### `Plugin X has already been reloaded by the reload under way; ...` {/* #plugin-x-has-already-been-reloaded-by-the-reload-under-way- */}

A reload-phase function asked for a reload of a plugin that the running reload, its cascade
included, already went through. Every plugin reloads at most once per reload, and a plugin using
another one's beans already follows it; drop the call.

### `Plugin X is not running`, `... is still starting`, `... is already reloading` {/* #plugin-x-is-not-running--is-still-starting--is-already-reloading */}


The plugin cannot be reloaded right now: it is disabled or its start failed, its start has not
completed, or a reload is already in progress and a reload-phase function asked for another one.
See [Reloading plugins](../lifecycle/reload.md#from-code).

## Debug mode {/* #debug-mode */}

When a plugin does not behave as its code suggests, set `debug: true` in
`plugins/VersatiaCore/config.yml` and run `/versatia reload VersatiaCore`, then reload or restart
the plugin. VersatiaCore logs every step of each plugin's start, reload and stop at `INFO`:

```text
[debug] Shop START: descriptor format 1.4, 11 elements, 9 for this event
[debug] Shop START: skipped VaultBridge: @ConditionalOnPlugin(Vault) is not met
[debug] Shop START: AutoInvokeEnhancementProcessor receives Counter.report()
[debug] Shop START: created 2 beans: "plugin" (com.example.shop.ShopPlugin), "counter" (com.example.shop.Counter)
[debug] Economy RELOAD: set 3 values, config.yml: base, rate, tax
[debug] Economy RELOAD: goes on to Shop, holding beans that follow its reloads
```

Values are logged by key only, never with what the file holds. Turn it off again the same way;
while it is off nothing is written. `/versatia info <plugin>` shows the same state at a glance;
see [Commands](../commands.md#versatia-info).

## Looking at what was generated {/* #looking-at-what-was-generated */}

Whenever the behaviour surprises you, open
`build/generated/ksp/main/kotlin/<package of the main class>/VersatiaDescriptor.kt`. It lists every
element the runtime will act on: processor id, phase, provided types, dependencies with qualifiers,
and whether the call is direct or reflective. What is not in there does not happen.
