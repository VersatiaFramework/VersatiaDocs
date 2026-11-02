import type {ComponentProps, ReactNode} from 'react';
import Links from '@theme-original/Footer/Links';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useActiveAudience} from '@site/src/components/AudienceNav';

type Columns = ComponentProps<typeof Links>['links'];

/** The developer's documentation keeps the footer of the theme config; the admin guide and the home page show their own columns. */
export default function LinksWrapper({links}: ComponentProps<typeof Links>): ReactNode {
  const audience = useActiveAudience();
  const {footerLinks} = useDocusaurusContext().siteConfig.customFields as {footerLinks: Record<'admin' | 'home', Columns>};
  return <Links links={audience === 'developer' ? links : footerLinks[audience ?? 'home']} />;
}
