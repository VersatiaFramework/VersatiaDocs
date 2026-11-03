import {Children, isValidElement, useId, useState, type KeyboardEvent, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';
import CodeBlock from '@theme/CodeBlock';
import {usePrismTheme} from '@docusaurus/theme-common';
import styles from './styles.module.css';

export type CodeCardProps = {
  /** Tab label: a file name, or what the output is (`Console`). */
  title: string;
  /** Prism language of string content; `text` when omitted. A fenced block names its own. */
  language?: string;
  /** Marks the result of running the code: the tab sits at the right end of the bar. */
  output?: boolean;
  /** The tab shown first; the first tab when none is marked. */
  default?: boolean;
  /** The content: a string, or in MDX an untitled fenced code block. */
  children: ReactNode;
};

/** One tab of {@link CodeCards}; renders nothing on its own. */
export function CodeCard(_: CodeCardProps): ReactNode {
  return null;
}

/**
 * Several files and the output they produce in one block, one tab each: the files on the left, an
 * `output` tab on the right. Every panel stays laid out, so switching tabs never changes the height.
 */
export default function CodeCards({children}: {children: ReactNode}): ReactNode {
  const cards = Children.toArray(children).filter(
    (child): child is ReactElement<CodeCardProps> => isValidElement(child) && child.type === CodeCard,
  );
  const [active, setActive] = useState(() => Math.max(0, cards.findIndex(card => card.props.default)));
  const id = useId();
  const {plain} = usePrismTheme();

  const onKeyDown = (event: KeyboardEvent) => {
    const step = {ArrowRight: 1, ArrowLeft: -1}[event.key];
    if (!step) return;
    const next = (active + step + cards.length) % cards.length;
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <div className={styles.cards} style={{backgroundColor: plain.backgroundColor, color: plain.color}}>
      <div className={styles.bar} role="tablist" onKeyDown={onKeyDown}>
        {cards.map((card, index) => (
          <button
            key={card.props.title}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={index === active ? 0 : -1}
            className={clsx(styles.tab, card.props.output && styles.output, index === active && styles.active)}
            onClick={() => setActive(index)}>
            {card.props.title}
          </button>
        ))}
      </div>
      <div className={styles.panels}>
        {cards.map(({props: {title, language, children: content}}, index) => (
          <div
            key={title}
            id={`${id}-panel-${index}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${index}`}
            aria-hidden={index !== active}
            className={clsx(styles.panel, index !== active && styles.inactive)}>
            {typeof content === 'string' ? <CodeBlock language={language ?? 'text'}>{content}</CodeBlock> : content}
          </div>
        ))}
      </div>
    </div>
  );
}
