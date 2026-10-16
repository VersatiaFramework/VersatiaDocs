# Building the framework

Versatia is developed in independent repositories that share nothing but published artifacts. This
page is for building the framework itself; plugin authors only need the
[installation](../getting-started/installation.md).

## Repositories {/* #repositories */}

| Repository                   | Produces                                                             |
|------------------------------|----------------------------------------------------------------------|
| `VersatiaAPI`                | `VersatiaAPI` (API), `VersatiaAPI-ksp` (processor) and `VersatiaCatalog` (shared versions), published to the local Maven repository |
| `VersatiaCore`               | the server plugin JAR, bundling the VersatiaAPI classes; a private repository, built by the Versatia team |
| `VersatiaModule-<Name>`      | a [module](../modules/index.md)'s API, published to the local Maven repository                |
| `VersatiaModule-<Name>Impl`  | the module's plugin JAR, bundling its API classes; private, like VersatiaCore                 |
| `VersatiaStarter`            | `VersatiaStarter`, the one dependency a plugin build needs: it exports VersatiaAPI and the module APIs |
| `VersatiaExample-*`          | the example plugins, one repository per feature; see [Example plugins](../examples/index.md) |
| `VersatiaDocs`               | this site                                                            |

Requirements: JDK 21 or newer. Gradle comes from the wrapper in each repository.

## Build order {/* #build-order */}

The projects consume each other from `~/.m2`, so publish upstream before building downstream:

```bash
cd VersatiaAPI && ./gradlew publishToMavenLocal
```

```bash
cd VersatiaCore && ./gradlew build
```

```bash
cd VersatiaModule-Messages && ./gradlew publishToMavenLocal
```

```bash
cd VersatiaStarter && ./gradlew publishToMavenLocal
```

```bash
cd VersatiaModule-MessagesImpl && ./gradlew build
```

```bash
cd VersatiaExample-DI-Beans && ./gradlew build
```

Every example depends on VersatiaStarter, so the starter and the module APIs are published before
any example builds. Every example repository builds the same way; the two-plugin examples are
single Gradle builds with one module per plugin.

Repeat `publishToMavenLocal` in VersatiaAPI after every change that a dependent project should
see; `build` runs the tests everywhere. Use `./gradlew build -x deployPlugin` when the JAR should
not be copied to your server.

## Plugin build scripts {/* #plugin-build-scripts */}

The examples and the template share one layout, the one [Installation](../getting-started/installation.md#in-your-build)
shows:

- Repositories are declared only in `settings.gradle.kts`, under `dependencyResolutionManagement`
  with `RepositoriesMode.FAIL_ON_PROJECT_REPOS`; `mavenLocal()` is filtered to the group
  `com.github.marcoral.versatia`.
- Versions come from [VersatiaCatalog](#versions): `settings.gradle.kts` imports it as `libs` at
  `versatiaVersion` from `gradle.properties`, the only place the Versatia version is written, and
  the build script uses `alias(libs.plugins.kotlin.jvm)`, `alias(libs.plugins.ksp)`,
  `libs.versatia.starter`, `libs.versatia.ksp` and `libs.snakeyaml`.
- `checkPluginYml`, part of `check` and so of `build`, fails the build when `plugin.yml` does not
  parse, lacks `name`, `version` or `main`, or does not list `VersatiaCore` under `depend:`.
  Paper would only skip such a plugin at start, with an error in the server log. It also fails
  when `src/main/resources/paper-plugin.yml` exists, which Paper would load in preference to
  `plugin.yml` as a Paper plugin; see
  [plugin.yml, not paper-plugin.yml](../getting-started/coming-from-bukkit.md#pluginyml-not-paper-pluginyml).

## Copying plugins to a server {/* #copying-plugins-to-a-server */}

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

The copy is named after the project without the version, `VersatiaExample-DI-Beans.jar`, so a newer
build replaces the deployed JAR instead of landing next to it.

## Versions {/* #versions */}

Every third-party version (Kotlin, KSP, KotlinPoet, kctfork, Paper API, CommandAPI, SnakeYAML)
lives in one file, `gradle/libs.versions.toml` of VersatiaAPI. Its `catalog` module publishes the
file as the version catalog `com.github.marcoral.versatia:VersatiaCatalog`, adding the version
`versatia` and the libraries `versatia-api`, `versatia-ksp`, `versatia-starter` and
`versatia-messages`. The framework version itself is `versatiaVersion` in each repository's
`gradle.properties`; every other repository imports the catalog at that version in
`settings.gradle.kts`, so VersatiaAPI's `publishToMavenLocal` must run first (`scripts/build-all.sh`
does). A version bump is one edit in `libs.versions.toml`.

VersatiaModule-Messages is the exception: it builds without any Versatia artifact (its own CI
builds it alone), so it keeps literal Kotlin and Paper API versions, which must match the catalog.

When bumping Kotlin, pick the `kotlin-compile-testing` fork (`dev.zacsweers.kctfork`) release built
against the same Kotlin and KSP versions; its POM lists them. Both the `ksp` module tests and
VersatiaCore's end-to-end test compile sample plugins with it in-process.

## How the pieces fit {/* #how-the-pieces-fit */}

- `VersatiaAPI/api` exports the Paper API for compilation only and the Kotlin standard library
  and `kotlin-reflect` for compilation and runtime; consumers declare none of them, but still need
  the Paper repository because Gradle does not inherit repositories.
- `VersatiaAPI/api` does not use the compiler's explicit API mode: exported declarations carry no
  modifier and return types are inferred; see [Best practices](../reference/best-practices.md#notation).
  Almost everything in `ksp` is internal.
- `VersatiaCore`'s `jar` task unpacks the `VersatiaAPI-*` JARs into the plugin JAR, because
  VersatiaAPI is not published remotely and Paper's `libraries:` mechanism cannot fetch it.
  `kotlin-stdlib` and `kotlin-reflect` stay under `libraries:`; VersatiaCore is the only plugin that
  lists them.
- Example plugins depend on `VersatiaStarter` with `implementation` and on `VersatiaAPI-ksp` with
  `ksp`; in the two-plugin examples the second module adds the first as `compileOnly`. The library
  module of VersatiaExample-Enhancements-Custom, which defines an enhancement rather than using
  modules, depends on `VersatiaAPI` directly.
- VersatiaStarter exports VersatiaAPI and the module APIs with `compileOnlyApi`: they reach a
  plugin's compile classpath, never its runtime classpath, so nothing the server provides can be
  packed into a plugin JAR, shaded or not. Module JARs bundle their own API classes the way
  VersatiaCore bundles VersatiaAPI.

## This documentation {/* #this-documentation */}

The site is a [Docusaurus](https://docusaurus.io/) project in the VersatiaDocs repository and
builds with Node.js 24, the version the publishing workflow uses:

```bash
npm ci
```

```bash
npm start
```

serves it locally with live reload; `npm run build` is what the publishing workflow runs and it
fails on broken links. Pages are Markdown files under `docs/`, the navigation is in `sidebars.ts`.
Every push to `master` republishes the site through GitHub Pages.
