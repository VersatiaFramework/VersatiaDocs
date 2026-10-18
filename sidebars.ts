import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: ['getting-started/installation', 'getting-started/first-plugin', 'getting-started/coming-from-bukkit', 'examples/index'],
    },
    {
      type: 'category',
      label: 'Core concepts',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Dependency injection',
          link: {type: 'doc', id: 'dependency-injection/index'},
          items: [
            'dependency-injection/scopes',
            'dependency-injection/qualifiers',
            'dependency-injection/cross-plugin',
          ],
        },
        {
          type: 'category',
          label: 'Lifecycle and reload',
          items: ['lifecycle/auto-invoke', 'lifecycle/phases', 'lifecycle/reload'],
        },
        'configuration',
        'resources',
        'events',
        'tasks',
        'optional-plugins',
        'commands',
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      link: {type: 'doc', id: 'modules/index'},
      items: ['modules/messages'],
    },
    {
      type: 'category',
      label: 'Utilities',
      link: {type: 'doc', id: 'utilities/index'},
      items: ['utilities/configuration', 'utilities/collections', 'utilities/misc'],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: ['reference/compile-time-checks', 'reference/troubleshooting', 'reference/best-practices'],
    },
    {
      type: 'category',
      label: 'Under the hood',
      items: [
        'internals/architecture',
        'internals/descriptor',
        'internals/enhancements',
        'internals/runtime',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: ['contributing/building'],
    },
  ],
};

export default sidebars;
