import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeCards, {CodeCard} from '@site/src/components/CodeCards';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import {AudienceIcon, type Who} from '@site/src/components/Audience/icons';

import styles from './index.module.css';

const sample = `class ShopPlugin : VersatiaPlugin() {

    @AutoInvoke(Phase.PLUGIN_RELOAD_OR_START)
    private fun start(prices: PriceList) =
        logger.info("Loaded \${prices.size} prices")
}

@LocalBean
class PriceList(private val config: ShopConfig) {
    val size get() = config.prices.size
}

@LocalBean
class ShopConfig {
    @Value("prices")
    var prices: Map<String, Int> = emptyMap()
}`;

const config = `prices:
  diamond: 120
  bread: 2
  iron-ingot: 15`;

const output = `[14:02:11 INFO]: [Shop] Enabling Shop v1.0.0
[14:02:11 INFO]: [Shop] Loaded 3 prices`;

const paths: {who: Who; question: string; text: string; to: string; cta: string}[] = [
  {
    who: 'developer',
    question: 'I write plugins',
    text: 'Build Paper plugins in Kotlin: beans, configuration values, commands, tasks and modules.',
    to: '/docs',
    cta: 'Developer documentation',
  },
  {
    who: 'admin',
    question: 'I run a server',
    text: 'A plugin needs VersatiaCore? Install it, configure the plugins built on it and reload them without a restart.',
    to: '/admin',
    cta: 'Server admin guide',
  },
];

/** The home page asks who the reader is instead of guessing: one card per audience, each opening its documentation. */
function Paths() {
  return (
    <nav className={styles.paths} aria-label="Where to start">
      <p className={styles.pathsQuestion}>What brings you here?</p>
      <div className={styles.pathCards}>
        {paths.map(path => (
          <Link key={path.who} to={path.to} className={clsx(styles.path, styles[path.who])}>
            <span className={styles.pathTitle}>
              <AudienceIcon who={path.who} className={styles.pathIcon} />
              {path.question}
            </span>
            <span className={styles.pathText}>{path.text}</span>
            <span className={styles.pathCta}>{path.cta} →</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

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
            <Paths />
          </div>
          <div className={clsx('col col--6', styles.heroCode)}>
            <CodeCards>
              <CodeCard title="ShopPlugin.kt" language="kotlin">{sample}</CodeCard>
              <CodeCard title="config.yml" language="yaml">{config}</CodeCard>
              <CodeCard title="Console" output>{output}</CodeCard>
            </CodeCards>
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
    <Layout
      title="Kotlin framework for Paper plugins"
      description="Versatia: a Kotlin framework for Paper 1.21.4 plugins with compile-time dependency injection, configuration values, lifecycle hooks, automatic listeners and modules.">
      <Hero />
      <main>
        <HowItWorks />
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
