import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import DocsSwitch from '@site/src/components/DocsSwitch';
import {AudienceLink, AudienceTabs} from '@site/src/components/AudienceNav';

// Registers the `custom-` navbar types of docusaurus.config.ts; every built-in type stays as it is
export default {
  ...ComponentTypes,
  'custom-docsSwitch': DocsSwitch,
  'custom-audienceTabs': AudienceTabs,
  'custom-audienceLink': AudienceLink,
};
