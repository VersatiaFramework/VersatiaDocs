---
title: Plugins built on Versatia
sidebar_label: Overview
pagination_label: Plugins
description: The plugins the Versatia team builds on the framework, what each gives a server and how your plugin works with them.
---

# Plugins built on Versatia

import CodeCards, {CodeCard} from '@site/src/components/CodeCards';

Besides the framework, the Versatia team publishes plugins built on it, which a server installs like
any other plugin. Each lives in a repository of its own under the Apache License 2.0, and its name
starts with `Versatia`, which keeps it apart from the other plugins called Trade on a server. Your
plugin can work with them: add a button to a menu, stop a trade, follow what happens.

| Plugin | What it gives a server | What your plugin can do with it |
|---|---|---|
| [VersatiaInteractions](interactions.md) | a menu opened with Shift + right click on a player, with a button per action (a trade, a duel), and requests that wait, expire and end on their own | add an action, send its request from code, deny or follow requests |
| [VersatiaTrade](trade.md) | a secure two-player trade window for items and money | deny a trade or an offered item, change how offered items look, follow how a trade ends, say which stacks are the same item |

Their sources are in the [VersatiaInteractions](https://github.com/VersatiaFramework/VersatiaInteractions)
and [VersatiaTrade](https://github.com/VersatiaFramework/VersatiaTrade) repositories.

:::admin

Installing and configuring these plugins is covered by the server admin guide, on the
[VersatiaInteractions](/admin/experimental/interactions) and [VersatiaTrade](/admin/experimental/trade)
pages.

:::

## Working with a plugin {/* #working-with-a-plugin */}

Your plugin compiles against the plugin's artifact, which its build publishes to the local Maven
repository like VersatiaAPI ([In your build](/docs/getting-started/installation#in-your-build)),
and names the plugin in `plugin.yml`. When your plugin runs without it too, it lists it under
`softdepend:` and keeps everything that names the plugin's classes in classes carrying
`@ConditionalOnPlugin`, which exist only while the plugin is installed
([Optional plugins](/docs/optional-plugins)):

<CodeCards>
<CodeCard title="TradeRules.kt">

```kotlin
@ConditionalOnPlugin("VersatiaTrade")
class TradeRules(private val arenas: Arenas, private val messages: Messages) : Listener {
    @EventHandler
    fun onStart(event: TradeStartEvent) {
        if (arenas.isInside(event.first)) event.deny(messages["arena.no-trade"].get())
    }
}
```

</CodeCard>
<CodeCard title="build.gradle.kts">

```kotlin
dependencies {
    compileOnly("dev.versatia:VersatiaTrade:0.0.1")
}
```

</CodeCard>
<CodeCard title="plugin.yml">

```yaml
softdepend:
  - VersatiaTrade
```

</CodeCard>
</CodeCards>

`compileOnly` keeps the plugin's classes out of your JAR: on the server they come from the plugin
itself. A plugin that cannot run without it lists it under `depend:` instead and needs no condition.
The annotations through which your plugin adds something, `@InteractionAction` and
`@TradeItemIdentity`, carry the condition themselves.

A listener that names the plugin's classes without the condition breaks your plugin on every
server without it, since loading the class fails:

```kotlin title="Wrong: the listener loads only where VersatiaTrade is installed"
// error-next-line
class TradeRules(private val arenas: Arenas, private val messages: Messages) : Listener {
    @EventHandler
    fun onStart(event: TradeStartEvent) {
        if (arenas.isInside(event.first)) event.deny(messages["arena.no-trade"].get())
    }
}
```

```kotlin title="Right"
// fix-next-line
@ConditionalOnPlugin("VersatiaTrade")
class TradeRules(private val arenas: Arenas, private val messages: Messages) : Listener {
    @EventHandler
    fun onStart(event: TradeStartEvent) {
        if (arenas.isInside(event.first)) event.deny(messages["arena.no-trade"].get())
    }
}
```

## Events {/* #events */}

Each plugin fires events wherever another plugin may want to react or to stop something, listed
on its page: [VersatiaInteractions](interactions.md#events) and [VersatiaTrade](trade.md#events).
An event fired before something happens is named in the present and can be denied with
`deny(reason)`, a whole sentence from your plugin's messages that the players read; one fired after
it is named in the past and only informs. [Events Versatia fires](/docs/events#events-versatia-fires)
lists them all, with the events of the modules.
