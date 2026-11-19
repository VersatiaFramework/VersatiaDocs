import {useState, type ReactNode} from 'react';
import Head from '@docusaurus/Head';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type {WrapperProps} from '@docusaurus/types';
import {useActivePlugin, useDoc} from '@docusaurus/plugin-content-docs/client';
import Admonition from '@theme/Admonition';
import Link from '@docusaurus/Link';
import {AudienceIcon} from '@site/src/components/Audience/icons';
import {twinPath} from '@site/plugins/twin';
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

/**
 * The page's Markdown twin, which plugins/llms.ts writes at the page's address plus `.md`: named in the head for an
 * assistant that browses, and copied by a button for a reader who pastes the page into a chat.
 */
function MarkdownTwin({permalink}: {permalink: string}): ReactNode {
  const href = twinPath(permalink);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    const text = fetch(href).then(response => {
      if (!response.ok) throw new Error(`${href}: ${response.status}`);
      return response.text();
    });
    try {
      // Handing the clipboard a pending item keeps the click's permission while the file loads (Safari)
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write)
        await navigator.clipboard.write([new ClipboardItem({'text/plain': text.then(markdown => new Blob([markdown], {type: 'text/plain'}))})]);
      else await navigator.clipboard.writeText(await text);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  };
  return (
    <>
      <Head>
        <link rel="alternate" type="text/markdown" href={href} title="This page as Markdown" />
      </Head>
      <div className={styles.twin}>
        <button type="button" className={styles.twinButton} onClick={copy} title="Copy this page as Markdown, to paste it into an AI assistant">
          {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy as Markdown'}
        </button>
        <a className={styles.twinButton} href={href} title="This page as Markdown">
          .md
        </a>
      </div>
    </>
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
      <MarkdownTwin permalink={metadata.permalink} />
      <Content {...props} />
    </>
  );
}
