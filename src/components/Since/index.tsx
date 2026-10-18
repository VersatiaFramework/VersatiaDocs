import type {ReactNode} from 'react';
import styles from './styles.module.css';

/**
 * The VersatiaAPI version a feature arrived in, as a quiet outlined label: on a heading it stays
 * on the heading line, anywhere else (`below`) it goes on its own line under the element. Used
 * from 1.1.0 on; see Best practices.
 */
export default function Since({v, below = false}: {v: string; below?: boolean}): ReactNode {
  return <span className={below ? styles.below : styles.since}>Since {v}</span>;
}
