import type {ReactNode} from 'react';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type {WrapperProps} from '@docusaurus/types';
import {useActivePlugin, useDoc} from '@docusaurus/plugin-content-docs/client';
import Admonition from '@theme/Admonition';
import Link from '@docusaurus/Link';
import {AudienceIcon} from '@site/src/components/Audience/icons';
import styles from './styles.module.css';

type Props = WrapperProps<typeof ContentType>;

/** Every page of the experimental docs instance, and of the admin guide's experimental/ folder, opens with the same warning, so no page can leave it out. */
function ExperimentalBanner(): ReactNode {
  const {metadata} = useDoc();
  return (
    <Admonition type="warning" title="Experimental">
      <p>
        This page describes an experimental feature. It may change or disappear in any release without notice, and the
        stable documentation does not cover it.
        {metadata.id !== 'intro' && (
          <>
            {' '}
            <Link to="/experimental">What experimental means</Link>.
          </>
        )}
      </p>
    </Admonition>
  );
}

/**
 * A page with a twin in the other audience's documentation names it in its front matter (`counterpart: /admin/commands`)
 * and links to it first, for a reader whom a search brought to the wrong one.
 */
function Counterpart({to, admin}: {to: string; admin: boolean}): ReactNode {
  const who = admin ? 'developer' : 'admin';
  return (
    <p className={`${styles.counterpart} ${styles[who]}`}>
      <AudienceIcon who={who} className={styles.icon} />
      {admin ? 'Writing a plugin?' : 'Running a server?'}{' '}
      <Link to={to}>{admin ? 'This topic in the developer documentation' : 'This topic in the server admin guide'}</Link>
    </p>
  );
}

export default function ContentWrapper(props: Props): ReactNode {
  const pluginId = useActivePlugin()?.pluginId;
  const {metadata, frontMatter} = useDoc();
  const {counterpart} = frontMatter as {counterpart?: string};
  const experimental = pluginId === 'experimental' || (pluginId === 'admin' && metadata.id.startsWith('experimental/'));
  return (
    <>
      {experimental && <ExperimentalBanner />}
      {counterpart && <Counterpart to={counterpart} admin={pluginId === 'admin'} />}
      <Content {...props} />
    </>
  );
}
