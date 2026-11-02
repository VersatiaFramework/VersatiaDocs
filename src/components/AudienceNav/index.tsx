import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useLocation} from '@docusaurus/router';
import DefaultNavbarItem from '@theme/NavbarItem/DefaultNavbarItem';
import type {Props as DefaultNavbarItemProps} from '@theme/NavbarItem/DefaultNavbarItem';
import {AudienceIcon, type Who} from '@site/src/components/Audience/icons';
import styles from './styles.module.css';

const AUDIENCES: {who: Who; label: string; to: string}[] = [
  {who: 'developer', label: 'Developers', to: '/docs'},
  {who: 'admin', label: 'Server admins', to: '/admin'},
];

/** The audience whose documentation the page belongs to (the experimental docs are the developer's), or none on the home page. */
export function useActiveAudience(): Who | undefined {
  const {pathname} = useLocation();
  const bases = [useBaseUrl('/admin'), useBaseUrl('/docs'), useBaseUrl('/experimental')];
  const [admin, ...developer] = bases.map(base => pathname === base || pathname.startsWith(`${base}/`));
  if (admin) return 'admin';
  return developer.some(Boolean) ? 'developer' : undefined;
}

type NavbarItemProps = {
  /** Set by the navbar when the item is rendered in the mobile sidebar. */
  mobile?: boolean;
  /** Closes the mobile sidebar after a choice. */
  onClick?: () => void;
};

/** The navbar's first item: one tab per audience, opening its documentation; the tab of the page's audience is highlighted. */
export function AudienceTabs({mobile, onClick}: NavbarItemProps): ReactNode {
  const active = useActiveAudience();
  const tabs = AUDIENCES.map(({who, label, to}) => (
    <Link
      key={who}
      to={to}
      onClick={onClick}
      className={clsx(mobile ? 'menu__link' : 'navbar__link', styles.tab, styles[who], active === who && styles.active)}
      aria-current={active === who ? 'true' : undefined}>
      <AudienceIcon who={who} className={styles.icon} />
      {label}
    </Link>
  ));
  if (mobile) return tabs.map(tab => <li key={tab.key} className="menu__list-item">{tab}</li>);
  return <div className={clsx('navbar__item', styles.tabs)}>{tabs}</div>;
}

/** A navbar link shown only on the pages of one audience's documentation. */
export function AudienceLink({audience, ...props}: DefaultNavbarItemProps & {audience: Who}): ReactNode {
  return useActiveAudience() === audience ? <DefaultNavbarItem {...props} /> : null;
}
