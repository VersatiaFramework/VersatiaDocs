import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// An experimental module's pages go under experimental/, where they open with the experimental warning (src/theme/DocItem/Content)
const sidebars: SidebarsConfig = {
  admin: [
    'index',
    'installation',
    'configuration-files',
    'commands',
    {
      type: 'category',
      label: 'Modules',
      collapsed: false,
      items: [
        'messages',
        {
          type: 'category',
          label: 'Database',
          link: {type: 'doc', id: 'database/index'},
          items: ['database/configuration', 'database/data', 'database/operations'],
        },
      ],
    },
    'troubleshooting',
  ],
};

export default sidebars;
