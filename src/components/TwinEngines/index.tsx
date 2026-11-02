import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

/**
 * Marks a MySQL or MariaDB row, column or rule of the Database module as one of the twin engines, linking to the
 * section that lists everything the two do specially.
 */
export default function TwinEngines(): ReactNode {
  return (
    <Link
      className={styles.twin}
      to="/docs/modules/database/configuration#mysql-and-mariadb"
      title="MySQL and MariaDB: twin engines with their own rules">
      twin
    </Link>
  );
}
