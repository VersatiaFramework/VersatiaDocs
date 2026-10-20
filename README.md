# VersatiaDocs

Documentation site of the **Versatia framework**, built with [Docusaurus](https://docusaurus.io/).
The pages are Markdown files under `docs/`, the landing page is `src/pages/index.tsx`, the
navigation is `sidebars.ts` and the site settings are in `docusaurus.config.ts`.

The site documents the framework as a whole and is written for plugin authors. The repositories of
the individual projects (VersatiaAPI, VersatiaCore and the example plugins) keep their own
`docs/*.md` with implementation notes.

## Requirements

- Node.js 20 or newer

```bash
npm ci
```

## Writing

```bash
npm start
```

Serves the site at <http://localhost:3000/VersatiaDocs/> and reloads on every saved file.

```bash
npm run build
```

Builds into `build/` and fails on broken links, anchors or pages, exactly as the publishing
workflow does. `npm run serve` serves that build locally.

Pages support Docusaurus Markdown: admonitions (`:::tip`), tabs (`<Tabs>`/`<TabItem>`), Mermaid
diagrams in ```` ```mermaid ```` fences and code blocks with a `title="..."`.

### Wrong and right snippets

Wherever a mistake is easy to make (a convention, a pitfall, a corner case), show the wrong code
and the right code as two consecutive code blocks, not tabs, so both are visible at once. Title
them `Wrong` and `Right`, or a short description starting with these words, and mark the lines
with magic comments, which do not appear on the page:

````md
```kotlin title="Wrong: stops every coroutine of the plugin"
// error-next-line
fun stop() = scope.cancel()
```

```kotlin title="Right: cancels the job it launched"
// fix-next-line
fun stop() = job?.cancel()
```
````

`error-next-line` (or `error-start` ... `error-end` around several lines) colours the faulty line
red, `fix-next-line` (`fix-start` ... `fix-end`) the fix green, like a diff. They work with `//`
and `#` comments, so in Kotlin, YAML and properties alike; `highlight-next-line` keeps its usual
meaning. The comments are defined in `docusaurus.config.ts` (`prism.magicComments`) and coloured
in `src/css/custom.css`. Keep the snippets short and add one sentence on why the first is wrong,
with the real error message when there is one.

## Publishing

`.github/workflows/pages.yml` builds the site on every push to `master` and deploys it with
GitHub Pages. In the repository settings, under *Pages*, select **GitHub Actions** as the source
once. `organizationName`, `projectName` and therefore `url`/`baseUrl` in `docusaurus.config.ts`
must match the GitHub repository.
