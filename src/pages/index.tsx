import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

const sample = `class ShopPlugin : VersatiaPlugin() {

    @AutoInvoke(EventType.PLUGIN_RELOAD_OR_START)
    private fun start(prices: PriceList) {
        logger.info("Loaded \${prices.size} prices")
    }
}

@LocalBean
class PriceList(config: ShopConfig)

@LocalBean
class ShopConfig`;

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.hero)}>
      <div className="container">
        <div className="row">
          <div className={clsx('col col--6', styles.heroText)}>
            <Heading as="h1" className={styles.title}>
              {siteConfig.title}
            </Heading>
            <p className={styles.subtitle}>{siteConfig.tagline}</p>
            <p className={styles.lead}>
              A Kotlin framework for Paper 1.21.4 plugins. Dependency injection and lifecycle hooks
              resolved at compile time, executed by a small runtime, with nothing discovered on the
              server.
            </p>
            <div className={styles.buttons}>
              <Link className="button button--primary button--lg" to="/docs/getting-started/installation">
                Get started
              </Link>
              <Link className="button button--secondary button--outline button--lg" to="/docs">
                Read the introduction
              </Link>
            </div>
          </div>
          <div className={clsx('col col--6', styles.heroCode)}>
            <CodeBlock language="kotlin" title="ShopPlugin.kt">
              {sample}
            </CodeBlock>
          </div>
        </div>
      </div>
    </header>
  );
}

const steps = [
  {
    title: 'Annotate',
    text: 'Mark classes with a bean scope and functions with @AutoInvoke. Constructor parameters are the dependencies.',
  },
  {
    title: 'Build',
    text: 'The VersatiaAPI KSP processor validates the graph and generates a descriptor next to your main class. Cycles and ambiguity stop the build.',
  },
  {
    title: 'Run',
    text: 'VersatiaCore reads the descriptor when the plugin enables, creates the beans in dependency order and calls your functions.',
  },
];

function HowItWorks() {
  return (
    <section className={styles.steps}>
      <div className="container">
        <Heading as="h2" className="text--center margin-bottom--lg">
          How it works
        </Heading>
        <div className="row">
          {steps.map((step, index) => (
            <div key={step.title} className="col col--4">
              <div className={styles.step}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <Heading as="h3">{step.title}</Heading>
                <p>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout description="Versatia: a Kotlin framework for Paper 1.21.4 plugins with compile-time dependency injection and lifecycle hooks.">
      <Hero />
      <main>
        <HowItWorks />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
