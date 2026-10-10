# Example plugins

Two small plugins in their own repositories exercise every feature described in this
documentation. Reading their server log next to their sources is the quickest way to see the
runtime at work.

## VersatiaDIExample

A plugin whose main class overrides nothing. Its beans live in
`com.github.marcoral.versatia.example.service` and log a line from their constructor, so the log
shows the order in which the runtime created them.

### Beans

| Bean                     | Scope              | Demonstrates                                                                 |
|--------------------------|--------------------|------------------------------------------------------------------------------|
| `Clock`                  | `@ExposeSingleton` | no dependencies; one instance that plugins loaded later may inject           |
| `PluginSession`          | `@ExposePrototype` | depends on `Clock`; every later plugin that needs it gets its own instance with a new id |
| `FriendlyGreeter`        | `@Service`         | a scope defined by the plugin itself (inherits `@LocalBean`); `internal`; implements `Greeter`; `@Primary`; its text comes from `Messages` |
| `UnfriendlyGreeter`      | `@Service`         | the second `Greeter`; `@Qualifier("grumpy")` names it                        |
| `Messages`               | `@LocalBean`       | reads `messages.yml`, extracted from the JAR's `resources/` directory before any bean exists |
| `Settings.MessageFormat` | `@LocalBean`       | a nested class; depends on `DIExamplePlugin`, the plugin instance, which is a bean through `@PluginBean` on `VersatiaPlugin` |
| `StartupBanner`          | `@LocalBean`       | `private`, created through reflection; depends on `Greeter` (resolved to the `@Primary` one) and `Settings.MessageFormat` |
| `ComplaintDesk`          | `@LocalBean`       | asks for `@Qualifier("grumpy") Greeter` in its constructor and in an auto-invoked function |

### Listeners

| Listener          | Demonstrates                                                                                  |
|-------------------|-----------------------------------------------------------------------------------------------|
| `WelcomeListener` | not a bean; created with `Greeter` and `Settings.MessageFormat` injected and registered with Bukkit because it implements `Listener`; greets joining players |

### Auto-invoked functions

| Function                   | Phase                    | Demonstrates                                                        |
|----------------------------|--------------------------|---------------------------------------------------------------------|
| `DIExamplePlugin.announce` | `PLUGIN_RELOAD_OR_START` | private function of the main class, `Clock` injected as a parameter |
| `DIExamplePlugin.farewell` | `PLUGIN_STOP`            | runs when the plugin is disabled                                    |
| `StartupBanner.show`       | `PLUGIN_START_ONLY`      | a function of a bean, called on the bean instance                   |
| `ComplaintDesk.open`       | `PLUGIN_START_ONLY`      | a qualified parameter on an auto-invoked function                   |
| `Statistics.countStart`    | `PLUGIN_RELOAD_OR_START` | a function of an `object`; no bean involved                         |

### The log

```
[Clock] created, instance ..., server time is ...
[PluginSession] created session #1 at ...
[Messages] loaded 2 messages from VersatiaDIExample/messages.yml
[FriendlyGreeter] created for session #1
[UnfriendlyGreeter] created
[MessageFormat] created for VersatiaDIExample 0.0.1
[StartupBanner] created with the FriendlyGreeter
[ComplaintDesk] created with the UnfriendlyGreeter
[WelcomeListener] created, greets every player who joins
[ComplaintDesk] desk opened, the clerk says: What do you want?
[StartupBanner] *** [VersatiaDIExample] Welcome! You are visitor #1. ***
[StartupBanner] banner shown at ...
[Statistics] start number 1
All beans are wired; the clock says ...
```

Beans first, in dependency order; then the functions, in descriptor order (class name, then
function name). On disable, `farewell` logs `Shutting down.` and the beans are dropped.

### Things to try

- Remove `@Primary` from `FriendlyGreeter`: the build fails because `Greeter` is ambiguous for
  `StartupBanner`, and the message lists `"friendlyGreeter"` and `"grumpy"`.
- Add `@LocalBean class Chicken(val egg: Egg)` and `@LocalBean class Egg(val chicken: Chicken)`:
  the build fails with `Dependency cycle: Chicken -> Egg -> Chicken`.
- Annotate `DIExamplePlugin` with `@LocalBean`: the build fails with
  `DIExamplePlugin is the plugin's main class and a local bean already; remove @LocalBean`.
- Edit `plugins/VersatiaDIExample/messages.yml` and restart: the greeting changes, because the
  extracted file is never overwritten. Delete it and restart: the original is back.
- Open `build/generated/ksp/main/kotlin/.../VersatiaDescriptor.kt`. The first two elements are
  `PluginTarget`s for `DIExamplePlugin`, produced by `@PluginBean` and `@ExtractResources` on
  `VersatiaPlugin`; `FriendlyGreeter` is sent to
  `LocalBeanEnhancementProcessor` although it is annotated `@Service`, and `@Primary` appears among its
  recorded attributes; its `assignableTypes` include `Greeter`; `ComplaintDesk`'s parameter carries
  the `@Qualifier("grumpy")` occurrence; `StartupBanner` has an `Instantiator.Reflective` with the
  binary name `Settings$MessageFormat` among its parameters.

## VersatiaDIConsumerExample

A second plugin that lists `VersatiaDIExample` under `depend:` and compiles against it with
`compileOnly`. It injects the two exposed beans and nothing else.

| Bean / function              | Receives                                                            |
|------------------------------|---------------------------------------------------------------------|
| `SessionReport(clock, session)` | the same `Clock` instance VersatiaDIExample created, and a `PluginSession` with id `2` |
| `SessionAudit(session, report)` | the **same** `PluginSession` as `SessionReport`: one prototype instance per consuming plugin |
| `DIConsumerPlugin.summary(clock)` | the shared `Clock`, injected into an auto-invoked function of the main class |

### The log

```
[PluginSession] created session #2 at ...
[SessionReport] clock instance 123456789, started at ...
[SessionReport] got session #2, expected #2 because VersatiaDIExample used #1 itself
[SessionAudit] sees session #2 as well, same instance as SessionReport's
Consumer beans are wired; shared clock instance 123456789.
```

The clock instance number equals the one in VersatiaDIExample's `[Clock] created` line. The
`[PluginSession] created session #2` line is logged by VersatiaDIExample's class on behalf of the
consumer.

### Things to try

- Inject `FriendlyGreeter`, a local bean of VersatiaDIExample. It compiles, and the consumer fails
  to enable with `no bean provides ...FriendlyGreeter, required by ...`, while VersatiaDIExample
  keeps running.
- Change the `compileOnly` dependency to `implementation`. The consumer now bundles its own
  `Clock` class and the injection fails with a `ClassCastException`.

Both repositories carry a `local.properties.example`; with `pluginsDir` set in a `local.properties`
next to it, `./gradlew build` copies the JAR to your server. See
[Building the framework](../contributing/building.md).
