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

## Publishing

`.github/workflows/pages.yml` builds the site on every push to `master` and deploys it with
GitHub Pages. In the repository settings, under *Pages*, select **GitHub Actions** as the source
once. `organizationName`, `projectName` and therefore `url`/`baseUrl` in `docusaurus.config.ts`
must match the GitHub repository.
