import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// GitHub Pages address of this repository; adjust when the repository is published elsewhere
const organizationName = 'VersatiaFramework';
const projectName = 'VersatiaDocs';
const github = `https://github.com/${organizationName}`;

// :::admin and :::developer mark what the server admin and the plugin developer must know (src/theme/Admonition/Types.tsx)
const admonitions = {keywords: ['admin', 'developer'], extendDefaults: true};

// Footer columns per audience (src/theme/Footer/Links): the developer's are the theme's own, the admin guide and pages
// of no audience (the home page) replace them with theirs
const adminGuideLinks = [
  {label: 'Server admin guide', to: '/admin'},
  {label: 'Installation', to: '/admin/installation'},
  {label: 'Configuration files', to: '/admin/configuration-files'},
  {label: 'Commands and permissions', to: '/admin/commands'},
  {label: 'Database module', to: '/admin/database'},
  {label: 'Troubleshooting', to: '/admin/troubleshooting'},
];
const githubLinks = [
  {label: 'VersatiaFramework', href: github},
  {label: 'VersatiaAPI', href: `${github}/VersatiaAPI`},
  {label: 'VersatiaStarter', href: `${github}/VersatiaStarter`},
  {label: 'VersatiaExamples', href: `${github}/VersatiaExamples`},
];
const developerFooter = [
  {
    title: 'Learn',
    items: [
      {label: 'Introduction', to: '/docs'},
      {label: 'Installation', to: '/docs/getting-started/installation'},
      {label: 'Your first plugin', to: '/docs/getting-started/first-plugin'},
      {label: 'Server admin guide', to: '/admin'},
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
  {title: 'GitHub', items: githubLinks},
];
const footerLinks = {
  admin: [
    {title: 'Server admins', items: adminGuideLinks},
    {
      title: 'More',
      items: [
        {label: 'Developer documentation', to: '/docs'},
        {label: 'Versatia on GitHub', href: github},
      ],
    },
  ],
  home: [
    {
      title: 'Developers',
      items: [
        {label: 'Introduction', to: '/docs'},
        {label: 'Installation', to: '/docs/getting-started/installation'},
        {label: 'Your first plugin', to: '/docs/getting-started/first-plugin'},
        {label: 'Examples', to: '/docs/examples'},
      ],
    },
    {title: 'Server admins', items: adminGuideLinks},
    {title: 'GitHub', items: githubLinks},
  ],
};

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

  url: 'https://versatia.dev',
  baseUrl: '/',
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

  customFields: {footerLinks},

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
          admonitions,
        },
        sitemap: {
          ignorePatterns: ['/search/**', '/search'],
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
      // Experimental features live in their own docs instance, reached through the navbar switch, which shows while it holds one
      '@docusaurus/plugin-content-docs',
      {
        id: 'experimental',
        path: 'experimental',
        routeBasePath: 'experimental',
        sidebarPath: './sidebarsExperimental.ts',
        showLastUpdateTime: false,
        editUrl: `${github}/${projectName}/edit/master/`,
        admonitions,
      },
    ],
    [
      // The server admin's documentation: installing, configuring and operating plugins, without code
      '@docusaurus/plugin-content-docs',
      {
        id: 'admin',
        path: 'admin',
        routeBasePath: 'admin',
        sidebarPath: './sidebarsAdmin.ts',
        showLastUpdateTime: false,
        editUrl: `${github}/${projectName}/edit/master/`,
        admonitions,
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Pages that moved keep their old addresses, which READMEs and bookmarks still use
        redirects: [
          {from: '/docs/best-practices', to: '/docs/reference/best-practices'},
          {from: '/docs/troubleshooting', to: '/docs/reference/troubleshooting'},
          {from: '/docs/dependency-injection/compile-time-checks', to: '/docs/reference/compile-time-checks'},
          // Messages became part of the framework
          {from: '/docs/modules/messages', to: '/docs/messages'},
          // The Database module left the experimental docs once finished
          {from: '/experimental/modules/database', to: '/docs/modules/database'},
          {from: '/experimental/modules/database/statements', to: '/docs/modules/database/statements'},
          {from: '/experimental/modules/database/background', to: '/docs/modules/database/background'},
          {from: '/experimental/modules/database/stores', to: '/docs/modules/database/stores'},
          {from: '/experimental/modules/database/migrations', to: '/docs/modules/database/migrations'},
          {from: '/experimental/modules/database/configuration', to: '/docs/modules/database/configuration'},
          {from: '/experimental/modules/database/operations', to: '/docs/modules/database/operations'},
          {from: '/experimental/modules/database/best-practices', to: '/docs/modules/database/best-practices'},
          {from: '/experimental/modules/database/corner-cases', to: '/docs/modules/database'},
          {from: '/docs/modules/database/corner-cases', to: '/docs/modules/database'},
          {from: '/admin/experimental/database', to: '/admin/database'},
          {from: '/admin/experimental/database/configuration', to: '/admin/database/configuration'},
          {from: '/admin/experimental/database/data', to: '/admin/database/data'},
          {from: '/admin/experimental/database/operations', to: '/admin/database/operations'},
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
        docsRouteBasePath: ['/docs', '/experimental', '/admin'],
        docsDir: ['docs', 'experimental', 'admin'],
        // One index per area: each documentation searches its own pages, and pages of none (the home page) all
        searchContextByPaths: [
          {label: 'Stable', path: 'docs'},
          {label: 'Experimental', path: 'experimental'},
          {label: 'Server admins', path: 'admin'},
        ],
        useAllContextsWithNoSearchContext: true,
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
      defaultMode: 'dark',
      respectPrefersColorScheme: false,
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
      // The audience tabs lead; the links after them belong to the developer's documentation and show only there
      items: [
        {
          type: 'custom-audienceTabs',
          position: 'left',
        },
        {
          type: 'custom-audienceLink',
          audience: 'developer',
          to: '/docs/getting-started/installation',
          position: 'left',
          label: 'Getting started',
        },
        {
          type: 'custom-audienceLink',
          audience: 'developer',
          to: '/docs/examples',
          position: 'left',
          label: 'Examples',
        },
        {
          type: 'custom-docsSwitch',
          position: 'right',
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
      links: developerFooter,
      copyright: `Copyright © ${new Date().getFullYear()} ${organizationName}. Versatia framework for Paper 1.21.4, licensed under the Apache License 2.0. Documentation built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['kotlin', 'java', 'groovy', 'yaml', 'properties', 'bash', 'json', 'sql'],
      // Setting magicComments replaces the defaults, so the highlight entry is repeated here
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: {start: 'highlight-start', end: 'highlight-end'},
        },
        {
          className: 'code-block-error-line',
          line: 'error-next-line',
          block: {start: 'error-start', end: 'error-end'},
        },
        {
          className: 'code-block-fix-line',
          line: 'fix-next-line',
          block: {start: 'fix-start', end: 'fix-end'},
        },
      ],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
