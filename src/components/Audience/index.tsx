import type {ReactNode} from 'react';
import clsx from 'clsx';
import {AudienceIcon, type Who} from './icons';
import styles from './styles.module.css';

const LABELS: Record<Who, string> = {admin: 'Server admin', developer: 'Plugin developer'};

/**
 * Who a heading, a table row or a sentence is for: the server admin (files in the data folder, commands,
 * permissions) or the plugin developer (sources, resources in the JAR, annotations, code). On a heading it stays on
 * the heading line; `below` puts it on its own line under a table cell or a paragraph. See Best practices.
 */
export default function Audience({who, below = false}: {who: Who; below?: boolean}): ReactNode {
  return (
    <span className={clsx(styles.audience, styles[who], below && styles.below)} title={`For the ${LABELS[who].toLowerCase()}`}>
      <AudienceIcon who={who} className={styles.icon} />
      {LABELS[who]}
    </span>
  );
}
