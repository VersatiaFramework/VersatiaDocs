# VersatiaDocs

Documentation site of the **Versatia framework**, built with [Docusaurus](https://docusaurus.io/).
The pages are Markdown files in three documentations, each with its own sidebar:

| Folder          | Address          | Sidebar                   | For                                        |
|-----------------|------------------|---------------------------|--------------------------------------------|
| `docs/`         | `/docs`          | `sidebars.ts`             | the plugin developer, stable features      |
| `experimental/` | `/experimental`  | `sidebarsExperimental.ts` | the plugin developer, experimental features |
| `admin/`        | `/admin`         | `sidebarsAdmin.ts`        | the server admin, without code; experimental modules under `admin/experimental/` |

The landing page is `src/pages/index.tsx` and the site settings, the navbar and the footer of each
audience are in `docusaurus.config.ts`.

Announcements and articles go to the blog, `blog/` at `/blog`, one file per post named
`YYYY-MM-DD-slug.md`. The build fails on a post without a `{/* truncate */}` marker after its
opening, or with an author or tag not declared in `blog/authors.yml` or `blog/tags.yml`. Until the
first post its page is empty and linked from nowhere; the Blog link joins the navbar and the
footers with that post.

The site documents the framework as a whole, for plugin developers and server admins. The repositories of
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

Serves the site at <http://localhost:3000/> and reloads on every saved file.

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
with magic comments, which do not appear on the page (the Markdown twins below turn them into
`✗ wrong` and `✓ fix` comments):

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

## For AI assistants

Every build also writes the documentation as AI assistants read it, through `plugins/llms.ts`:
each page as Markdown at its address plus `.md`, `llms.txt`, `llms-full.txt`,
`admin/llms-full.txt` and `symbols.md` (see
[Writing plugins with an AI assistant](https://versatia.dev/docs/getting-started/ai-assistants)).
A component or magic comment added to the pages gets its Markdown rendering there in the same
change, and the build fails when a section these files quote is missing. `npm start` does not
write them; `npm run build` followed by `npm run serve` shows them.

`symbols.md` comes from `plugins/symbols.json`, the public declarations of VersatiaAPI and the
module APIs, which `npm run symbols` generates from their sources JARs in the local Maven
repository (after `./gradlew publishToMavenLocal` in each). Commit the regenerated file with every
change to the public API; `npm run symbols -- --check` fails while it is stale.

## Link preview

Links to the site shared on Discord, Reddit or social networks show `static/img/social-card.png`
(1200 × 630, `themeConfig.image`). Edit `static/img/social-card.svg` and render it again on
Windows, whose Segoe UI and Cascadia Mono set its text, with headless Edge from this folder in
PowerShell. The paths must be absolute, and the file appears a second or two after the command
returns:

```powershell
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --headless --hide-scrollbars --window-size=1200,630 "--user-data-dir=$env:TEMP\social-card" "--screenshot=$PWD\static\img\social-card.png" "$PWD\static\img\social-card.svg"
```

## Publishing

`.github/workflows/pages.yml` builds the site on every push to `master` and deploys it with
GitHub Pages. In the repository settings, under *Pages*, select **GitHub Actions** as the source
once. `organizationName`, `projectName` and therefore `url`/`baseUrl` in `docusaurus.config.ts`
must match the GitHub repository.
