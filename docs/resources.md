# Plugin resources

import ExampleCard from '@site/src/components/ExampleCard';

Every Versatia plugin extracts the files it ships under a `resources` directory into its data
folder when it starts and at every reload. Nothing has to be declared: put the files there and
they appear on the server.

<ExampleCard repo="VersatiaExample-Resources-Extraction" file="src/main/resources/resources" fileLabel="resources/">
A plugin shipping two files under <code>resources/</code> and logging them from its data folder.
</ExampleCard>

## Where the files go {/* #where-the-files-go */}

| In the build                               | In the JAR                  | On the server                          |
|--------------------------------------------|-----------------------------|----------------------------------------|
| `src/main/resources/resources/config.yml`  | `resources/config.yml`      | `plugins/<Name>/config.yml`            |
| `src/main/resources/resources/lang/en.yml` | `resources/lang/en.yml`     | `plugins/<Name>/lang/en.yml`           |

The directory layout under `resources/` is kept. Only files are copied; an empty directory in the
JAR creates nothing.

## Existing files are never overwritten {/* #existing-files-are-never-overwritten */}

A file that already exists in the data folder is left exactly as it is, whatever the JAR contains.
Server owners edit the extracted copies, and an update of the plugin does not undo their changes.
To get a fresh copy of a file, delete it and run [`/versatia reload <name>`](lifecycle/reload.md)
or restart the plugin.

## When it happens {/* #when-it-happens */}

Extraction runs at `PLUGIN_RELOAD_OR_START`, first: at start before any bean is created, any
[`@Value` property](configuration.md) is read or any auto-invoked function runs, and again at
every reload before the values are read. So a value always finds its file, and a file the
administrator deleted comes back with its default at the next reload.

Reading the files is the job of the features built on them. A single value is a `@Value` property
set from the extracted file, so the shipped file is where the defaults live:

```kotlin
@LocalBean
class Shop {
    @Value("greeting", file = "messages.yml")
    lateinit var greeting: String
}
```

Texts shown to players belong to the [Messages module](modules/messages.md), which reads
`messages/`. A file of your own format is read in a `PLUGIN_RELOAD_OR_START` function, so a reload
picks up its changes, with `loadYamlOrThrow` and the strict getters of the
[configuration utilities](utilities/configuration.md); never in a constructor, which runs once.

## Why every plugin has it {/* #why-every-plugin-has-it */}

`VersatiaPlugin` is annotated with `@ExtractResources`, and an enhancement declared on a base
class applies to every plugin extending it, as explained under
[Enhancements and processors](internals/enhancements.md#enhancements-on-a-base-class). A main
class that extends `JavaPlugin` directly can carry the annotation itself. The processor behind it
is `ExtractResourcesEnhancementProcessor` (`ResourceProcessors.EXTRACT`); it reads the files
from the plugin's own JAR, never from a dependency.

The classpath directory is fixed to `resources` (`ExtractResources.DIRECTORY`). Files placed
anywhere else in `src/main/resources`, such as `plugin.yml`, stay inside the JAR.

## Switching it off {/* #switching-it-off */}

A plugin that wants to handle its files itself switches the feature off on its main class:

<ExampleCard repo="VersatiaExample-Enhancements-FeatureSwitches" file="src/main/kotlin/com/github/marcoral/versatia/example/switches/SwitchesPlugin.kt">
A base plugin class switching extraction off and a main class switching listener registration off.
</ExampleCard>

```kotlin
@DisableVersatiaFeatures(extractResources = true)
class MyPlugin : VersatiaPlugin()
```

The descriptor then carries no extraction element at all; nothing happens at runtime. The
annotation is accepted on the main class and on its base classes only, and the nearest declaration
wins: a base class may switch the feature off and a subclass may declare `@ExtractResources` again.
Writing `@DisableVersatiaFeatures` without switching anything on, or next to `@ExtractResources`
on the same class, is a compile error. Every feature a plugin inherits and its switch are listed
under [Enhancements on a base class](internals/enhancements.md#enhancements-on-a-base-class).

## Corner cases {/* #corner-cases */}

- **A link counts as a file.** Anything at the destination, a symbolic link included, even one
  pointing nowhere, keeps the JAR's copy out; a configuration the administrator shares through a
  link is left alone.
- **A deleted file comes back** at the next reload or start, with the content of the JAR the
  server runs now.
- **Empty directories** in the JAR create nothing in the data folder.
