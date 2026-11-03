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
          items: [
            'dependency-injection/index',
            'dependency-injection/scopes',
            'dependency-injection/qualifiers',
            'dependency-injection/cross-plugin',
          ],
        },
        {
          type: 'category',
          label: 'Lifecycle and reload',
          items: ['lifecycle/auto-invoke', 'lifecycle/phases', 'lifecycle/reload', 'lifecycle/event-order'],
        },
        {
          type: 'category',
          label: 'Configuration values',
          items: ['configuration/index', 'configuration/types', 'configuration/changes'],
        },
        'resources',
        'events',
        {
          type: 'category',
          label: 'Tasks and coroutines',
          items: ['tasks/index', 'tasks/coroutines', 'tasks/conditions'],
        },
        'optional-plugins',
        'commands',
        {
          type: 'category',
          label: 'Messages',
          items: ['messages/index', 'messages/arguments'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      items: [
        'modules/index',
        {
          type: 'category',
          label: 'Database',
          items: [
            'modules/database/index',
            'modules/database/statements',
            'modules/database/rows',
            'modules/database/background',
            'modules/database/stores',
            'modules/database/player-stores',
            'modules/database/migrations',
            'modules/database/engine-overrides',
            'modules/database/queries',
            'modules/database/configuration',
            'modules/database/tokens',
            'modules/database/operations',
            'modules/database/best-practices',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Utilities',
      items: ['utilities/index', 'utilities/configuration', 'utilities/collections', 'utilities/misc'],
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
