# Building the framework

Versatia is developed in independent repositories that share nothing but published artifacts. This
page is for building the framework itself; plugin authors only need the
[installation](../getting-started/installation.md).

## Repositories

| Repository                   | Produces                                                             |
|------------------------------|----------------------------------------------------------------------|
| `VersatiaAPI`                | `VersatiaAPI` (API) and `VersatiaAPI-ksp` (processor), published to the local Maven repository |
| `VersatiaCore`               | the server plugin JAR, bundling the VersatiaAPI classes; a private repository, built by the Versatia team |
| `VersatiaExample-*`          | the example plugins, one repository per feature; see [Example plugins](../examples/index.md) |
| `VersatiaDocs`               | this site                                                            |

Requirements: JDK 21 or newer. Gradle comes from the wrapper in each repository.

## Build order

The projects consume each other from `~/.m2`, so publish upstream before building downstream:

```bash
cd VersatiaAPI && ./gradlew publishToMavenLocal
```

```bash
cd VersatiaCore && ./gradlew build
```

```bash
cd VersatiaExample-DI-Beans && ./gradlew build
```

Every example repository builds the same way; the two-plugin examples are single Gradle builds
with one module per plugin.

Repeat `publishToMavenLocal` in VersatiaAPI after every change that a dependent project should
see; `build` runs the tests everywhere.

## Copying plugins to a server

Every plugin repository has a `deployPlugin` task that runs after `build` and copies the JAR into
your server's `plugins/` directory. The path is machine-specific and never committed:

1. Copy `local.properties.example` to `local.properties` in the repository root.
2. Set `pluginsDir` to the directory, with forward slashes:

    ```properties
    pluginsDir=D:/server/plugins
    ```

Alternatives: `./gradlew build -PpluginsDir="D:/server/plugins"`, or a `pluginsDir=` line in
`~/.gradle/gradle.properties` for all projects on the machine. Without a value the copy step is
skipped and the build still succeeds.

## Versions

Shared versions live in `gradle.properties` of VersatiaAPI: `versatiaVersion`, `kspVersion`,
`kotlinPoetVersion` and `kctforkVersion`. The Kotlin Gradle plugin version is declared in each
build script.

When bumping Kotlin, pick the `kotlin-compile-testing` fork (`dev.zacsweers.kctfork`) release built
against the same Kotlin and KSP versions; its POM lists them. Both the `ksp` module tests and
VersatiaCore's end-to-end test compile sample plugins with it in-process.

## How the pieces fit

- `VersatiaAPI/api` exports the Paper API for compilation only and the Kotlin standard library
  and `kotlin-reflect` for compilation and runtime; consumers declare none of them, but still need
  the Paper repository because Gradle does not inherit repositories.
- `VersatiaAPI/api` does not use the compiler's explicit API mode: exported declarations carry no
  modifier and return types are inferred; see [Best practices](../best-practices.md#notation).
  Almost everything in `ksp` is internal.
- `VersatiaCore`'s `jar` task unpacks the `VersatiaAPI-*` JARs into the plugin JAR, because
  VersatiaAPI is not published remotely and Paper's `libraries:` mechanism cannot fetch it.
  `kotlin-stdlib` and `kotlin-reflect` stay under `libraries:`; VersatiaCore is the only plugin that
  lists them.
- Example plugins depend on `VersatiaAPI` with `implementation` and on `VersatiaAPI-ksp`
  with `ksp`; in the two-plugin examples the second module adds the first as `compileOnly`.

## This documentation

The site is a [Docusaurus](https://docusaurus.io/) project in the VersatiaDocs repository and
needs Node.js 20 or newer:

```bash
npm ci
```

```bash
npm start
```

serves it locally with live reload; `npm run build` is what the publishing workflow runs and it
fails on broken links. Pages are Markdown files under `docs/`, the navigation is in `sidebars.ts`.
Every push to `master` republishes the site through GitHub Pages.
