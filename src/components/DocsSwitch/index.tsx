import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useLocation} from '@docusaurus/router';
import {useAllDocsData} from '@docusaurus/plugin-content-docs/client';
import {useActiveAudience} from '@site/src/components/AudienceNav';
import styles from './styles.module.css';

export type DocsSwitchProps = {
  /** Set by the navbar when the item is rendered in the mobile sidebar. */
  mobile?: boolean;
  /** Closes the mobile sidebar after a choice. */
  onClick?: () => void;
};

const STABLE = '/docs';
const EXPERIMENTAL = '/experimental';

function useExperimental(): boolean {
  const {pathname} = useLocation();
  const base = useBaseUrl(EXPERIMENTAL);
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Whether the experimental docs hold a feature; with only their intro there is nothing to switch to. */
function useHasExperimental(): boolean {
  return useAllDocsData().experimental.versions[0].docs.some(({id}) => id !== 'intro');
}

function Options({experimental, onClick}: {experimental: boolean; onClick?: () => void}): ReactNode {
  return (
    <div className={styles.switch} role="group" aria-label="Documentation track">
      <Link
        to={STABLE}
        className={clsx(styles.option, !experimental && styles.active)}
        aria-current={experimental ? undefined : 'true'}
        onClick={onClick}>
        Stable
      </Link>
      <Link
        to={EXPERIMENTAL}
        className={clsx(styles.option, experimental && styles.active, experimental && styles.experimental)}
        aria-current={experimental ? 'true' : undefined}
        onClick={onClick}>
        <span className={styles.dot} aria-hidden="true" />
        Experimental
      </Link>
    </div>
  );
}

/**
 * The navbar control that moves the reader between the stable and the experimental documentation, shown while
 * anything is experimental; the server admin's documentation has no experimental track.
 */
export default function DocsSwitch({mobile, onClick}: DocsSwitchProps): ReactNode {
  const experimental = useExperimental();
  const hasExperimental = useHasExperimental();
  if (useActiveAudience() === 'admin' || !hasExperimental) return null;
  if (mobile) {
    return (
      <li className={clsx('menu__list-item', styles.mobile)}>
        <span className={styles.caption}>Documentation track</span>
        <Options experimental={experimental} onClick={onClick} />
      </li>
    );
  }
  return (
    <div className={clsx('navbar__item', styles.item)}>
      <Options experimental={experimental} />
    </div>
  );
}
