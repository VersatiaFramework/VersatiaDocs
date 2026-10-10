import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// GitHub Pages address of this repository; adjust when the repository is published elsewhere
const organizationName = 'VersatiaFramework';
const projectName = 'VersatiaDocs';

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

  url: `https://${organizationName}.github.io`,
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
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
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
            {label: 'Utilities', to: '/docs/utilities'},
          ],
        },
        {
          title: 'Reference',
          items: [
            {label: 'Architecture', to: '/docs/internals/architecture'},
            {label: 'Best practices', to: '/docs/best-practices'},
            {label: 'Troubleshooting', to: '/docs/troubleshooting'},
            {label: 'Building the framework', to: '/docs/contributing/building'},
          ],
        },
      ],
      copyright: `Versatia framework for Paper 1.21.4. Documentation built with Docusaurus.`,
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
