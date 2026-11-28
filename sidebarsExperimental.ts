import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// A feature added here also shows the Stable / Experimental switch in the navbar (src/components/DocsSwitch)
const sidebars: SidebarsConfig = {
  experimental: [
    'intro',
    {
      type: 'category',
      label: 'Plugins',
      collapsed: false,
      items: [
        'plugins/index',
        'plugins/interactions',
        'plugins/trade',
        'plugins/chat',
        'plugins/regions',
        {type: 'category', label: 'VersatiaRpg', items: ['plugins/rpg/index', 'plugins/rpg/characters', 'plugins/rpg/combat', 'plugins/rpg/stats', 'plugins/rpg/items', 'plugins/rpg/skills']},
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      collapsed: false,
      items: ['modules/item-views'],
    },
  ],
};

export default sidebars;
