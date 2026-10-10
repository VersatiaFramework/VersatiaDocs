import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const ORG = 'https://github.com/VersatiaFramework';

export type ExampleCardProps = {
  /** Repository name, e.g. `VersatiaExample-DI-Beans`. */
  repo: string;
  /** One sentence: what the example shows. */
  children: ReactNode;
  /** Path of the file to read first, relative to the repository root. */
  file?: string;
  /** Label shown instead of the file name, e.g. when `file` points at a directory. */
  fileLabel?: string;
};

function GitHubMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

/** A card pointing at the example repository that shows the feature described on the page. */
export default function ExampleCard({repo, children, file, fileLabel}: ExampleCardProps): ReactNode {
  const repoUrl = `${ORG}/${repo}`;
  const fileName = fileLabel ?? file?.split('/').pop();
  return (
    <aside className={styles.card}>
      <div className={styles.header}>
        <GitHubMark />
        <span className={styles.kicker}>Example</span>
        <Link className={styles.repo} to={repoUrl}>
          {repo}
        </Link>
      </div>
      <p className={styles.blurb}>{children}</p>
      <div className={styles.actions}>
        <Link className="button button--primary button--sm" to={repoUrl}>
          Open the repository
        </Link>
        {file && (
          <Link className="button button--secondary button--sm" to={`${repoUrl}/blob/master/${file}`}>
            Start with <code>{fileName}</code>
          </Link>
        )}
      </div>
    </aside>
  );
}

export type ExampleGridProps = {children: ReactNode};

/** Lays example cards out in two columns, for the catalogue page. */
export function ExampleGrid({children}: ExampleGridProps): ReactNode {
  return <div className={styles.grid}>{children}</div>;
}
