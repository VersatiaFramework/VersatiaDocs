# Plugin resources

Every Versatia plugin extracts the files it ships under a `resources` directory into its data
folder when it starts. Nothing has to be declared: put the files there and they appear on the
server.

## Where the files go

| In the build                               | In the JAR                  | On the server                          |
|--------------------------------------------|-----------------------------|----------------------------------------|
| `src/main/resources/resources/config.yml`  | `resources/config.yml`      | `plugins/<Name>/config.yml`            |
| `src/main/resources/resources/lang/en.yml` | `resources/lang/en.yml`     | `plugins/<Name>/lang/en.yml`           |

The directory layout under `resources/` is kept. Only files are copied; an empty directory in the
JAR creates nothing.

## Existing files are never overwritten

A file that already exists in the data folder is left exactly as it is, whatever the JAR contains.
Server owners edit the extracted copies, and an update of the plugin does not undo their changes.
To get a fresh copy of a file, delete it and restart the plugin.

## When it happens

Extraction runs at `PLUGIN_START_ONLY`, before any bean is created and before any auto-invoked
function runs, so a bean may read the files in its constructor:

```kotlin
@LocalBean
class Messages(plugin: JavaPlugin) {
    private val config = loadYamlOrThrow(plugin.dataFolder.resolve("messages.yml"))

    operator fun get(key: String) = config.getStringOrThrow(key)
}
```

`loadYamlOrThrow` and the strict getters come from the [configuration utilities](utilities/configuration.md).

## Why every plugin has it

`VersatiaPlugin` is annotated with `@ExtractResources`, and an enhancement declared on a base
class applies to every plugin extending it, as explained under
[Enhancements and processors](internals/enhancements.md#enhancements-on-a-base-class). A main
class that extends `JavaPlugin` directly can carry the annotation itself. The processor behind it
is `ExtractResourcesEnhancementProcessor` (`ResourceProcessors.EXTRACT`); it reads the files
from the plugin's own JAR, never from a dependency.

The classpath directory is fixed to `resources` (`ExtractResources.DIRECTORY`). Files placed
anywhere else in `src/main/resources`, such as `plugin.yml`, stay inside the JAR.

## Switching it off

A plugin that wants to handle its files itself switches the feature off on its main class:

```kotlin
@DisableVersatiaFeatures(extractResources = true)
class MyPlugin : VersatiaPlugin()
```

The descriptor then carries no extraction element at all; nothing happens at runtime. The
annotation is accepted on the main class and on its base classes only, and the nearest declaration
wins: a base class may switch the feature off and a subclass may declare `@ExtractResources` again.
Writing `@DisableVersatiaFeatures` without switching anything on, or next to `@ExtractResources`
on the same class, is a compile error.
