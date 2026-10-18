---
slug: /
sidebar_label: Introduction
title: Introduction
description: What Versatia is, how its two halves cooperate and what the framework provides today.
---

import Link from '@docusaurus/Link';

**Versatia** is a framework for [Paper](https://papermc.io/) **1.21.4** plugins written in Kotlin.
Its mission is to remove the Bukkit boilerplate from plugins: wiring singletons, passing
dependencies around by hand, registering things in `onEnable` and tearing them down in
`onDisable`. A plugin declares *what* it has; Versatia takes care of *when* and *how* it is hooked
into the server.

```kotlin
class ShopPlugin : VersatiaPlugin() {

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    private fun start(prices: PriceList) = logger.info("Loaded ${prices.size} prices")
}

@LocalBean
class PriceList(private val config: ShopConfig) {
    val size get() = config.prices.size
}

@LocalBean
class ShopConfig {
    @Value("prices")
    var prices: Map<String, Int> = emptyMap()
}
```

Nothing is overridden, nothing is registered. The beans are created in dependency order when the
plugin enables, `prices` is read from `config.yml`, `start` runs once all of that is done, and
everything is dropped when the plugin disables. `/versatia reload` reads `prices` again and runs
`start` again.

## Two projects {/* #two-projects */}

| Project             | What it is      | Where it runs                                                                      |
|---------------------|-----------------|------------------------------------------------------------------------------------|
| **VersatiaAPI** | a library       | in your build: the API you compile against and a compile-time code generator        |
| **VersatiaCore**    | a server plugin | on the server, next to your plugin: the runtime that gives the API its behaviour; distributed as a JAR, its sources are private |

Your plugin depends on VersatiaAPI at compile time and lists VersatiaCore under `depend:` in
its `plugin.yml`. It never compiles against VersatiaCore.

## Nothing is discovered at runtime {/* #nothing-happens-at-runtime */}

The central design rule: **nothing is discovered while the server runs**. There is no classpath
scanning and no reflective search for annotated classes.

1. At **compile time**, a [KSP](https://kotlinlang.org/docs/ksp-overview.html) processor from
   VersatiaAPI reads your sources, validates them and generates a *descriptor*: a small Kotlin
   object listing everything the runtime has to act on.
2. At **runtime**, VersatiaCore loads that descriptor by name at a few well-defined moments
   (plugin start, reload, plugin stop) and executes it.

This buys four things:

- **Errors at build time.** A dependency cycle, an ambiguous injection or a bean that cannot be
  constructed stops the build with a message pointing at the line. It never reaches a server.
- **Fast, predictable start-up.** The runtime walks a list; it does not search.
- **Encapsulation kept.** Beans, constructors and functions may be `private`. Generated code calls
  visible members directly and uses reflection only where it has to.
- **No boilerplate.** The main class is a bean, the files under `resources/` in the JAR
  land in the data folder, a configuration value is a `@Value` property set from them and re-read
  on reload, every `Listener` is registered and every `BackgroundTask` runs, without a line of
  code. An integration with a plugin that may be absent is one annotation, `@ConditionalOnPlugin`.

## What is in the box {/* #what-is-in-the-box */}

<div className="row margin-bottom--lg">
  <div className="col col--6 margin-bottom--md">
    <div className="card card--full-height padding--md">
      <h3>Dependency injection</h3>
      <p>
        Constructor injection with three scopes: <code>@LocalBean</code>, <code>@ExposeSingleton</code>,
        <code>@ExposePrototype</code>. Beans can be shared between plugins; <code>@Qualifier</code> and
        <code>@Primary</code> resolve ambiguity.
      </p>
      <Link to="/docs/dependency-injection">Dependency injection →</Link>
    </div>
  </div>
  <div className="col col--6 margin-bottom--md">
    <div className="card card--full-height padding--md">
      <h3>Lifecycle hooks</h3>
      <p>
        <code>@AutoInvoke(phase)</code> runs a function at plugin start, reload or stop, with its
        parameters injected. It replaces <code>onEnable</code> and <code>onDisable</code>;
        <code>/versatia reload</code> runs the reload phase on demand.
      </p>
      <Link to="/docs/lifecycle/auto-invoke">Auto-invoked functions →</Link>
    </div>
  </div>
  <div className="col col--6 margin-bottom--md">
    <div className="card card--full-height padding--md">
      <h3>Tasks and coroutines</h3>
      <p>
        A <code>BackgroundTask</code> runs as long as the plugin and restarts with every reload; an
        injected <code>PluginScope</code> launches coroutines on the server thread, waiting in ticks or
        real time and for <code>Condition</code>s rechecked on events, never polled.
      </p>
      <Link to="/docs/tasks">Tasks and coroutines →</Link>
    </div>
  </div>
  <div className="col col--6 margin-bottom--md">
    <div className="card card--full-height padding--md">
      <h3>Utilities</h3>
      <p>
        One static entry point, <code>VersatiaEngine</code>, for server-wide calls; strict
        configuration getters, deep-merging maps, scheduler and logging shorthands, reflection
        helpers and more.
      </p>
      <Link to="/docs/utilities">Utilities →</Link>
    </div>
  </div>
  <div className="col col--6 margin-bottom--md">
    <div className="card card--full-height padding--md">
      <h3>Extensible core</h3>
      <p>
        Annotations are <em>enhancements</em> interpreted by processors. The descriptor format is the
        contract between the compile-time and runtime halves.
      </p>
      <Link to="/docs/internals/architecture">Under the hood →</Link>
    </div>
  </div>
</div>

Beyond the runtime, [modules](modules/index.md) add what plugins use every day, each as a plugin of its own
that exposes a bean, such as a bank of messages per plugin, read from its data folder, reloaded with it
and written in MiniMessage with runtime arguments in braces. [VersatiaStarter](getting-started/installation.md#in-your-build)
brings the API of all of them into a build with one dependency.

## Versions {/* #versions */}

| Component | Version  |
|-----------|----------|
| Versatia  | `0.0.1`  |
| Paper     | `1.21.4` |
| Java      | 21       |
| Kotlin    | `2.4.20` |
| KSP       | `2.3.12` |

Ready? Start with the [installation](getting-started/installation.md), or browse the
[example plugins](examples/index.md), one feature each. Coming from a Bukkit plugin? See
[Coming from Bukkit](getting-started/coming-from-bukkit.md) for its everyday code next to the same
plugin with Versatia.
