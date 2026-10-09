import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: ['getting-started/installation', 'getting-started/first-plugin'],
    },
    {
      type: 'category',
      label: 'Dependency injection',
      collapsed: false,
      link: {type: 'doc', id: 'dependency-injection/index'},
      items: [
        'dependency-injection/scopes',
        'dependency-injection/qualifiers',
        'dependency-injection/cross-plugin',
        'dependency-injection/compile-time-checks',
      ],
    },
    {
      type: 'category',
      label: 'Lifecycle',
      collapsed: false,
      items: ['lifecycle/auto-invoke', 'lifecycle/phases'],
    },
    {
      type: 'category',
      label: 'Utilities',
      link: {type: 'doc', id: 'utilities/index'},
      items: ['utilities/configuration', 'utilities/collections', 'utilities/misc'],
    },
    'examples/index',
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
    'best-practices',
    'troubleshooting',
    'contributing/building',
  ],
};

export default sidebars;
