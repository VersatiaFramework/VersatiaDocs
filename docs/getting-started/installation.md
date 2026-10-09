# Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Versatia has two halves. The server needs **VersatiaCore**; your build needs **VersatiaAPI**.

## On the server

1. Run Paper **1.21.4** on Java **21** or newer.
2. Drop `VersatiaCore-0.0.1.jar` into the `plugins/` directory.

VersatiaCore is the only plugin that ships the Kotlin runtime: its `plugin.yml` lists
`kotlin-stdlib` and `kotlin-reflect` under `libraries:`, and Paper downloads them at start.
Every Versatia plugin reaches Kotlin through VersatiaCore, which is why your plugin must **not**
list Kotlin itself (see [below](#pluginyml)).

:::info[Where do the JARs come from?]

Versatia is not published to a public repository yet. Build VersatiaCore and VersatiaAPI
from source and publish the latter to your local Maven repository; the steps are in
[Building the framework](../contributing/building.md).

:::

## In your build

A Versatia plugin is an ordinary Kotlin/JVM Gradle project with the KSP plugin applied.

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

repositories {
    mavenLocal()
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    implementation("com.github.marcoral.versatia:VersatiaAPI:0.0.1")
    ksp("com.github.marcoral.versatia:VersatiaAPI-ksp:0.0.1")
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_21)
    }
}
```

1. VersatiaAPI is resolved from the local Maven repository until it is published remotely.
2. VersatiaAPI exports the Paper API, but Gradle never inherits repositories, so the Paper
   repository has to be declared here.

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
```

</TabItem>
</Tabs>
Two dependencies, nothing else:

| Dependency                | Configuration    | Role                                                                 |
|---------------------------|------------------|----------------------------------------------------------------------|
| `VersatiaAPI`             | `implementation` | the API: annotations, `VersatiaPlugin`, utilities. Also brings the Paper API, `kotlin-stdlib` and `kotlin-reflect` onto the compile classpath, so you do not declare those |
| `VersatiaAPI-ksp`         | `ksp`            | the code generator. Lives on the annotation-processing classpath only and never reaches the server |

There is no configuration block for the processor. It finds your plugin's main class on its own
and places the generated descriptor next to it.

:::tip[Nothing from VersatiaAPI ends up in your JAR]

Do not shade or bundle VersatiaAPI. On the server its classes are provided by VersatiaCore,
which your plugin reaches through `depend:`.

:::

## plugin.yml

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
- **No `libraries:` entry for Kotlin.** Paper loads each plugin's libraries into a separate class
  loader. A plugin with its own copy of Kotlin would exchange `kotlin.jvm.functions.Function1`
  objects with VersatiaCore across two different `Function1` classes, and the JVM rejects that
  with a `LinkageError`. See [Troubleshooting](../troubleshooting.md#linkageerror-at-start-up).

## Check the setup

Run `./gradlew build`. On success the build directory contains

```
build/generated/ksp/main/kotlin/com/example/myplugin/VersatiaDescriptor.kt
```

in the package of your main class. It is empty of elements until you declare a bean or an
auto-invoked function, which is the subject of [Your first plugin](first-plugin.md).
