import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// A feature added here also shows the Stable / Experimental switch in the navbar (src/components/DocsSwitch)
const sidebars: SidebarsConfig = {
  experimental: [
    'intro',
    {
      type: 'category',
      label: 'Plugins',
      collapsed: false,
      items: ['plugins/index', 'plugins/interactions', 'plugins/trade'],
    },
  ],
};

export default sidebars;
