import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type Feature = {
  title: string;
  description: ReactNode;
  to: string;
  linkText: string;
};

const features: Feature[] = [
  {
    title: 'Dependency injection',
    description: (
      <>
        Constructor injection with three scopes: <code>@LocalBean</code>, <code>@ExposeSingleton</code> and{' '}
        <code>@ExposePrototype</code>. Beans can be shared between plugins; <code>@Qualifier</code> and{' '}
        <code>@Primary</code> resolve ambiguity.
      </>
    ),
    to: '/docs/dependency-injection',
    linkText: 'Learn about beans',
  },
  {
    title: 'Lifecycle hooks',
    description: (
      <>
        <code>@AutoInvoke(phase)</code> runs a function at plugin start, reload or stop with its parameters
        injected. There is nothing to override in the main class.
      </>
    ),
    to: '/docs/lifecycle/auto-invoke',
    linkText: 'Auto-invoked functions',
  },
  {
    title: 'Errors at build time',
    description: (
      <>
        Dependency cycles, ambiguous injections and beans that cannot be constructed fail the build with a
        message pointing at the line. Nothing broken reaches a server.
      </>
    ),
    to: '/docs/dependency-injection/compile-time-checks',
    linkText: 'Compile-time checks',
  },
  {
    title: 'Encapsulation kept',
    description: (
      <>
        Beans, constructors and functions may be <code>private</code>. Generated code calls visible members
        directly and falls back to reflection only where it has to.
      </>
    ),
    to: '/docs/internals/descriptor',
    linkText: 'The descriptor',
  },
  {
    title: 'Utilities over Paper',
    description: (
      <>
        Strict configuration getters, deep-merging maps, scheduler and logging shorthands, primary-thread
        checks and reflection helpers, usable without the runtime.
      </>
    ),
    to: '/docs/utilities',
    linkText: 'Utilities',
  },
  {
    title: 'Extensible core',
    description: (
      <>
        Annotations are enhancements interpreted by processors, and scopes can be inherited to define your
        own. The descriptor format is a versioned contract.
      </>
    ),
    to: '/docs/internals/enhancements',
    linkText: 'Enhancements and processors',
  },
];

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {features.map((feature) => (
            <div key={feature.title} className="col col--4 margin-bottom--lg">
              <div className={styles.card}>
                <Heading as="h3">{feature.title}</Heading>
                <p>{feature.description}</p>
                <Link to={feature.to}>{feature.linkText} →</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
