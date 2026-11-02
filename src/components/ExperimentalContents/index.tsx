import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useDocsVersion} from '@docusaurus/plugin-content-docs/client';

/**
 * The features of the experimental docs, read from its pages: every top-level page and every folder's
 * index but the intro. Nothing has to be listed by hand, and an empty track says so.
 */
export default function ExperimentalContents(): ReactNode {
  const features = Object.values(useDocsVersion().docs).filter(
    ({id}) => id !== 'intro' && (!id.includes('/') || id.endsWith('/index')),
  );
  if (features.length === 0)
    return (
      <p>
        Nothing is experimental at the moment: every feature is in the <Link to="/docs">stable documentation</Link>,
        and the switch is hidden until a feature comes here.
      </p>
    );
  return (
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>What it is</th>
        </tr>
      </thead>
      <tbody>
        {features.map(({id, title, description}) => (
          <tr key={id}>
            <td>
              <Link to={`/experimental/${id.replace(/\/?index$/, '')}`}>{title}</Link>
            </td>
            <td>{description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
