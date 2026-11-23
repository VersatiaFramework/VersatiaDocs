import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// The pages of an experimental module or plugin go under experimental/, where they open with the experimental warning (src/theme/DocItem/Content)
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
          items: ['database/index', 'database/configuration', 'database/connections', 'database/data', 'database/operations'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Experimental',
      collapsed: false,
      items: ['experimental/interactions', 'experimental/trade'],
    },
    'troubleshooting',
  ],
};

export default sidebars;
