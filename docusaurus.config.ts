import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// GitHub Pages address of this repository; adjust when the repository is published elsewhere
const organizationName = 'VersatiaFramework';
const projectName = 'VersatiaDocs';
const github = `https://github.com/${organizationName}`;

const config: Config = {
  title: 'Versatia',
  tagline: 'Declare what your Paper plugin has. Versatia takes care of when and how.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
    faster: {
      // The @swc/html native binding refuses to load on machines whose user profile grants access to app containers
      swcHtmlMinimizer: false,
    },
  },

  // GitHub Pages serves the lowercase host; canonical links and the sitemap must agree
  url: `https://${organizationName.toLowerCase()}.github.io`,
  baseUrl: `/${projectName}/`,
  organizationName,
  projectName,
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: false,
          editUrl: `${github}/${projectName}/edit/master/`,
        },
        sitemap: {
          ignorePatterns: [`/${projectName}/search/**`, `/${projectName}/search`],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Pages that moved keep their old addresses, which READMEs and bookmarks still use
        redirects: [
          {from: '/docs/best-practices', to: '/docs/reference/best-practices'},
          {from: '/docs/troubleshooting', to: '/docs/reference/troubleshooting'},
          {from: '/docs/dependency-injection/compile-time-checks', to: '/docs/reference/compile-time-checks'},
        ],
      },
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: '/docs',
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 10,
      },
    ],
  ],

  themeConfig: {
    metadata: [
      {name: 'keywords', content: 'Paper, Minecraft, plugin, Kotlin, framework, dependency injection, KSP, Bukkit'},
    ],
    colorMode: {
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
      },
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    },
    navbar: {
      title: 'Versatia',
      logo: {
        alt: 'Versatia',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          to: '/docs/getting-started/installation',
          position: 'left',
          label: 'Getting started',
        },
        {
          to: '/docs/examples',
          position: 'left',
          label: 'Examples',
        },
        {
          href: github,
          position: 'right',
          label: 'GitHub',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {label: 'Introduction', to: '/docs'},
            {label: 'Installation', to: '/docs/getting-started/installation'},
            {label: 'Your first plugin', to: '/docs/getting-started/first-plugin'},
          ],
        },
        {
          title: 'Features',
          items: [
            {label: 'Dependency injection', to: '/docs/dependency-injection'},
            {label: 'Auto-invoked functions', to: '/docs/lifecycle/auto-invoke'},
            {label: 'Configuration values', to: '/docs/configuration'},
            {label: 'Event listeners', to: '/docs/events'},
            {label: 'Tasks and coroutines', to: '/docs/tasks'},
            {label: 'Modules', to: '/docs/modules'},
            {label: 'Utilities', to: '/docs/utilities'},
          ],
        },
        {
          title: 'Reference',
          items: [
            {label: 'Architecture', to: '/docs/internals/architecture'},
            {label: 'Best practices', to: '/docs/reference/best-practices'},
            {label: 'Troubleshooting', to: '/docs/reference/troubleshooting'},
            {label: 'Building the framework', to: '/docs/contributing/building'},
          ],
        },
        {
          title: 'GitHub',
          items: [
            {label: 'VersatiaFramework', href: github},
            {label: 'VersatiaAPI', href: `${github}/VersatiaAPI`},
            {label: 'VersatiaStarter', href: `${github}/VersatiaStarter`},
            {label: 'VersatiaExamples', href: `${github}/VersatiaExamples`},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ${organizationName}. Versatia framework for Paper 1.21.4. Documentation built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['kotlin', 'java', 'groovy', 'yaml', 'properties', 'bash', 'json'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
