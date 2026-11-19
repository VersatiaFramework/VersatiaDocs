---
description: How an AI coding assistant reads this documentation, starts from the template and checks its own code, and the notes it is given first.
---

# Writing plugins with an AI assistant

This documentation is written for AI coding assistants as much as for people. Every page has a
Markdown twin, an index made for assistants lists them with the rules that matter most, and the
build names every mistake it finds together with its fix, so an assistant can write a Versatia
plugin, build it and correct itself without guessing.

## Point the assistant at the documentation {/* #point-the-assistant-at-the-documentation */}

Give the assistant the address of the index, or one of the files it lists:

| File                                                    | What it holds                                                                                                      |
|---------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| [`/llms.txt`](pathname:///llms.txt)                     | the index for assistants: the [first notes](#what-the-assistant-is-told-first), the rules of [Best practices](../reference/best-practices.md), the Bukkit code Versatia replaces and a link to every page |
| [`/llms-full.txt`](pathname:///llms-full.txt)           | the whole developer documentation and the symbol index in one file                                                 |
| [`/admin/llms-full.txt`](pathname:///admin/llms-full.txt) | the whole [server admin guide](/admin) in one file                                                               |
| [`/symbols.md`](pathname:///symbols.md)                 | the package, signature and first KDoc sentence of every public declaration of VersatiaAPI and the module APIs      |
| a page's address plus `.md`                             | that page as Markdown, such as [`/docs/dependency-injection.md`](pathname:///docs/dependency-injection.md)         |

Every page also has a **Copy as Markdown** button next to its title, for pasting it into a chat, and
names its Markdown twin in a `<link rel="alternate" type="text/markdown">` tag for an assistant
that browses.

A Markdown twin holds everything its page shows: the code of every tab, the lines a wrong/right
pair marks (`// ✗ wrong`, `// ✓ fix`), whom a part is for, and the Versatia imports a Kotlin
snippet needs, which the site leaves out because IntelliJ adds them. The Plain Paper side of an
example appears only in [Coming from Bukkit](coming-from-bukkit.md#side-by-side), labelled and
next to its Versatia side, so an assistant never takes it for code to write.

## Start from the template {/* #start-from-the-template */}

[VersatiaExample-Template](https://github.com/VersatiaFramework/VersatiaExample-Template) ships an
`AGENTS.md`, which coding assistants read when they open a project, and a `CLAUDE.md` that points
Claude Code to it. It names the stack, the build command, the rules whose breach fails the build or
the server, and the [files for assistants](#point-the-assistant-at-the-documentation). A plugin made from the template keeps it and adds its own rules.

## Let the build check the code {/* #let-the-build-check-the-code */}

`./gradlew build` runs the [compile-time checks](../reference/compile-time-checks.md): a mistake in
the bean graph, a `@Value` target or an `@AutoInvoke` function fails the build with a message
saying what is wrong, where, and how to fix it. An assistant that builds after every change and
follows those messages ends with a plugin the runtime accepts. At runtime,
[Troubleshooting](../reference/troubleshooting.md) lists the messages with their causes.

## What the assistant is told first {/* #what-the-assistant-is-told-first */}

[`llms.txt`](pathname:///llms.txt) opens with these notes, before the rules and the list of pages:

- A Versatia plugin is Kotlin for Paper 26.3 on Java 25, built with Gradle against VersatiaAPI
  (`compileOnly`) and its KSP processor (`ksp`). Kotlin comes from VersatiaCore at runtime: never
  shade it or list it under `libraries:`.
- `plugin.yml`, never `paper-plugin.yml`, lists `VersatiaCore` under `depend:`.
- The main class extends `VersatiaPlugin`, which seals `onEnable` and `onDisable`; what runs at
  start, reload or stop is an `@AutoInvoke` function.
- Read the page of a feature before using it, and use what Versatia provides instead of the Bukkit
  code it replaces ([Coming from Bukkit](coming-from-bukkit.md#bukkit-concept-versatia)).
- Build after every change. A compile-time error states its fix: follow it instead of working
  around it, never by widening visibility, adding reflection or moving code out of a bean.
- A message names styles (`<positive>`, `<accent>`), never colours; configuration is `@Value`
  properties with the defaults in the shipped file, never values written in code.
