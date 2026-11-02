import type {ReactNode} from 'react';

export type Who = 'admin' | 'developer';

/** A server rack: what the server admin runs and configures. */
function ServerIcon({className}: {className?: string}): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4 3h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 2.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zM10 6.25a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7zM4 13h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm2 2.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm4 .5a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7z"
      />
    </svg>
  );
}

/** Angle brackets: what the plugin developer writes. */
function CodeIcon({className}: {className?: string}): ReactNode {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
    </svg>
  );
}

export function AudienceIcon({who, className}: {who: Who; className?: string}): ReactNode {
  return who === 'admin' ? <ServerIcon className={className} /> : <CodeIcon className={className} />;
}
