# Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Versatia has two halves. The server needs **VersatiaCore**; your build needs **VersatiaAPI**,
which comes with **VersatiaStarter**.

## On the server {/* #on-the-server */}

1. Run Paper **1.21.4** on Java **21** or newer.
2. Drop `VersatiaCore-0.0.1.jar` into the `plugins/` directory.

At its first start VersatiaCore writes its own configuration, `plugins/VersatiaCore/config.yml`:

```yaml
# Logs every step of each Versatia plugin's start, reload and stop at INFO; for diagnosing a plugin, off otherwise
debug: false
```

With `debug: true` the log describes what the runtime does with each plugin (see
[Troubleshooting](../reference/troubleshooting.md#debug-mode)). The file is read at start and at
every reload of VersatiaCore, so `/versatia reload VersatiaCore` switches it without a restart; a
deleted file comes back at that reload.

VersatiaCore is the only plugin that ships the Kotlin runtime: its `plugin.yml` lists
`kotlin-stdlib`, `kotlin-reflect` and `kotlinx-coroutines-core-jvm` under `libraries:`, and Paper
downloads them at its first start (and keeps them under `libraries/`). Every Versatia plugin reaches
Kotlin and `kotlinx.coroutines` through VersatiaCore, which is why your plugin must **not** list
either itself (see [below](#pluginyml)). A plugin built against a VersatiaAPI needs the VersatiaCore
of the same release; an older one refuses it with the
[descriptor format message](../reference/troubleshooting.md#x-was-built-for-descriptor-format-a-but-this-versatiacore-supports-b).

:::info[Where do the JARs come from?]

Versatia is not published to a Maven repository yet. VersatiaAPI is open source: build it and
publish it to your local Maven repository, the steps are in
[Building the framework](../contributing/building.md). VersatiaCore is distributed as a plugin
JAR; its repository is private and access to the sources is granted by the Versatia team.

:::

### Soft dependencies {/* #soft-dependencies */}

VersatiaCore works on its own. Some of its features appear only when another plugin is installed
next to it; VersatiaCore lists these under `softdepend:` and nothing else changes without them.

| Plugin                                   | Version | What it enables                                              |
|------------------------------------------|---------|--------------------------------------------------------------|
| [CommandAPI](https://commandapi.dev/)    | 12.x    | the `/versatia` command, today [`/versatia reload`](../lifecycle/reload.md) |

Without CommandAPI a plugin still reloads itself from code with
[`versatiaReload()`](../lifecycle/reload.md#from-code). A CommandAPI release VersatiaCore is not
compatible with costs only the command; VersatiaCore logs one warning:

```
/versatia could not be registered. The installed CommandAPI 13.0.0 may not be compatible with the
12.x release VersatiaCore is built against; everything except the command keeps working.
```

### Modules {/* #modules */}

Features beyond the runtime come as [modules](../modules/index.md), one plugin JAR each, installed
next to VersatiaCore when a plugin on the server needs them; each plugin lists the modules it uses
under `depend:`.

| Module JAR                          | Plugin name               | Needs        |
|-------------------------------------|---------------------------|--------------|
| `VersatiaModule-Messages-0.0.1.jar` | `VersatiaModule-Messages` | VersatiaCore |

## In your build {/* #in-your-build */}

A Versatia plugin is an ordinary Kotlin/JVM Gradle project with the KSP plugin applied. The
repositories are declared once, in `settings.gradle.kts`.

<Tabs>
<TabItem value="build-gradle-kts" label="build.gradle.kts">


```kotlin
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.4.20"
    id("com.google.devtools.ksp") version "2.3.12"
}

group = "com.example"
version = "1.0.0"

val versatiaVersion = "0.0.1"

dependencies {
    implementation("com.github.marcoral.versatia:VersatiaStarter:$versatiaVersion")
    ksp("com.github.marcoral.versatia:VersatiaAPI-ksp:$versatiaVersion")
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_21
    }
}
```

</TabItem>
<TabItem value="settings-gradle-kts" label="settings.gradle.kts">


```kotlin
rootProject.name = "MyPlugin"

pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        mavenLocal { content { includeGroup("com.github.marcoral.versatia") } }
        mavenCentral()
        maven("https://repo.papermc.io/repository/maven-public/")
    }
}
```

1. `FAIL_ON_PROJECT_REPOS` makes this the only place repositories are declared; a `repositories { }`
   block in `build.gradle.kts` fails the build.
2. The Versatia artifacts come from the local Maven repository until they are published remotely.
   The filter takes nothing else from there, so a stale local copy of another library never wins.
3. VersatiaAPI exports the Paper API, but Gradle never inherits repositories, so the Paper
   repository has to be declared here.

</TabItem>
</Tabs>

Two dependencies, nothing else:

| Dependency                | Configuration    | Role                                                                 |
|---------------------------|------------------|----------------------------------------------------------------------|
| `VersatiaStarter`         | `implementation` | the starter, in the spirit of Spring Boot's: no code, it exports `VersatiaAPI` (annotations, `VersatiaPlugin`, utilities, and with it the Paper API, `kotlin-stdlib`, `kotlin-reflect` and `kotlinx-coroutines-core`, pinned to the version VersatiaCore loads) and the API of every [module](../modules/index.md), so you declare none of those |
| `VersatiaAPI-ksp`         | `ksp`            | the code generator. Lives on the annotation-processing classpath only and never reaches the server; it cannot come through the starter, because Gradle does not fill the `ksp` configuration transitively |

Keep the version in one `versatiaVersion` value; both lines use it. A plugin that uses no module
may depend on `com.github.marcoral.versatia:VersatiaAPI` instead of the starter.

### Versions from VersatiaCatalog {/* #versatia-catalog */}

Instead of writing the Kotlin, KSP and Versatia versions yourself, you can import the Gradle
version catalog the framework is built with, `com.github.marcoral.versatia:VersatiaCatalog`
(published by VersatiaAPI). The examples and the template do this. The Versatia version moves to
`gradle.properties`, the one place both scripts read it from:

```properties title="gradle.properties"
versatiaVersion=0.0.1
```

```kotlin title="settings.gradle.kts (added inside dependencyResolutionManagement)"
versionCatalogs {
    create("libs") {
        from("com.github.marcoral.versatia:VersatiaCatalog:${providers.gradleProperty("versatiaVersion").get()}")
    }
}
```

```kotlin title="build.gradle.kts"
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ksp)
}

dependencies {
    implementation(libs.versatia.starter)
    ksp(libs.versatia.ksp)
}
```

The catalog matches the framework release: Kotlin and KSP at the versions Versatia is compiled
with, plus `libs.paper.api` (for `testImplementation`), `libs.versatia.api`,
`libs.versatia.messages`, `libs.commandapi.*`, `libs.snakeyaml` and `libs.kotlinx.coroutines.test`
(for `testImplementation`; `kotlinx-coroutines-core` itself comes with VersatiaAPI). Your own
libraries stay in your build, or in a second catalog of your own.

There is no configuration block for the processor. It finds your plugin's main class on its own
and places the generated descriptor next to it.

:::tip[Nothing the server provides goes into your JAR]

VersatiaAPI, Kotlin, the Paper API and the module APIs are on the server already: VersatiaCore,
Paper and the module plugins provide them, and your plugin reaches them through `depend:`. A
second copy in your JAR is a second class of the same name and breaks at runtime. The starter
exports everything with `compileOnlyApi`, so it is on the compile classpath only: a plain `jar`
does not pack it, and neither does Shadow when you shade a third-party library. A test that needs
these classes at runtime adds them with `testImplementation`. The same rule covers another
plugin you inject beans from, which you add as
[`compileOnly`](../dependency-injection/cross-plugin.md#set-up-in-the-consumer).

:::

## plugin.yml {/* #pluginyml */}

```yaml
name: MyPlugin
version: '1.0.0'
main: com.example.myplugin.MyPlugin
api-version: '1.21'
depend:
  - VersatiaCore
```

Two rules:

- `VersatiaCore` goes under `depend:`. It guarantees that the runtime is up before your plugin
  enables and lets your plugin load the Kotlin and VersatiaAPI classes from VersatiaCore.
- **No `libraries:` entry for Kotlin, nor for a library built on it.** Paper loads each plugin's
  libraries into a separate class loader. A plugin with its own copy of Kotlin would exchange
  `kotlin.jvm.functions.Function1` objects with VersatiaCore across two different `Function1`
  classes, and the JVM rejects that with a `LinkageError`. A Kotlin library such as
  `kotlinx-serialization-json` brings `kotlin-stdlib` along, so listing it under `libraries:` has
  the same effect. Shade such a library into your JAR instead and leave Kotlin out:

    ```kotlin
    plugins {
        id("com.gradleup.shadow") version "8.3.5"
    }

    dependencies {
        implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0")
    }

    tasks.shadowJar {
        dependencies {
            exclude(dependency("org.jetbrains.kotlin:.*"))
            exclude(dependency("org.jetbrains.kotlinx:kotlinx-coroutines-.*"))
        }
    }
    ```

- **No copy of `kotlinx.coroutines` at all**, neither under `libraries:` nor shaded, nor through a
  coroutine library for Bukkit such as MCCoroutine. VersatiaCore loads it, VersatiaAPI exports it to
  your build at that same version, and a [`PluginScope`](../tasks.md) or a `Condition` is a
  `kotlinx.coroutines` type crossing between your plugin and VersatiaCore, so a second copy fails
  with a `LinkageError` or a `ClassCastException`.

  See [Troubleshooting](../reference/troubleshooting.md#linkageerror-at-start-up).

:::warning[plugin.yml, not paper-plugin.yml]

A Versatia plugin is described by `plugin.yml`. A `paper-plugin.yml` makes Paper load the JAR as a
Paper plugin, even next to a `plugin.yml`: its class loader is isolated, and it has no `depend:`
through which VersatiaCore shares Kotlin and VersatiaAPI the way it does with a Bukkit plugin. That
loading is not supported, and the `checkPluginYml` task of the template fails the build when
`src/main/resources/paper-plugin.yml` exists. See
[Coming from Bukkit](coming-from-bukkit.md#pluginyml-not-paper-pluginyml).

:::

## Check the setup {/* #check-the-setup */}

Run `./gradlew build`. On success the build directory contains

```
build/generated/ksp/main/kotlin/com/example/myplugin/VersatiaDescriptor.kt
```

in the package of your main class. It already lists the elements every plugin inherits from
`VersatiaPlugin` (the main class as a bean, resource extraction, the plugin's coroutine scope);
beans and auto-invoked functions add theirs, which is the subject of [Your first plugin](first-plugin.md).
