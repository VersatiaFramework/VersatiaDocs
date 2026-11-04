import {Children, isValidElement, useId, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode} from 'react';
import clsx from 'clsx';
import CodeBlock from '@theme/CodeBlock';
import {usePrismTheme} from '@docusaurus/theme-common';
import {switchSide, useKeptInPlace, useSide, type Side} from './side';
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
  /** Belongs to the Bukkit side of a pair: the same behaviour written with plain Paper, shown by the switch. */
  bukkit?: boolean;
  /** The content: a string, or in MDX an untitled fenced code block. */
  children: ReactNode;
};

/** One tab of {@link CodeCards}; renders nothing on its own. */
export function CodeCard(_: CodeCardProps): ReactNode {
  return null;
}

type Card = ReactElement<CodeCardProps>;

const sideOf = (card: Card): Side => (card.props.bukkit ? 'bukkit' : 'versatia');

/** The text of a card: a string, or the code of the fenced block MDX made of it. */
function sourceOf(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(sourceOf).join('');
  return isValidElement<{children?: ReactNode}>(node) ? sourceOf(node.props.children) : '';
}

function languageOf(node: ReactNode): string | undefined {
  if (!isValidElement<{className?: string; children?: ReactNode}>(node)) return undefined;
  return /language-(\w+)/.exec(node.props.className ?? '')?.[1] ?? Children.toArray(node.props.children).map(languageOf).find(Boolean);
}

const counted = new Set(['kotlin', 'java']);
const uncounted = /^\s*(import|package)\s|^\s*\/\/ (error|fix|highlight)-/;

/** Lines of the Kotlin and Java cards, without blank lines, imports, package declarations and magic comments. */
export function linesOf(cards: Card[]): number {
  return cards
    .filter(({props}) => !props.output && counted.has(props.language ?? languageOf(props.children) ?? ''))
    .flatMap(({props}) => sourceOf(props.children).split('\n'))
    .filter(line => line.trim() && !uncounted.test(line)).length;
}

const options: {side: Side; label: string}[] = [
  {side: 'versatia', label: 'Versatia'},
  {side: 'bukkit', label: 'Plain Paper'},
];

/** The Versatia/Bukkit switch with the lines of code of each side; flipping one flips every pair for the rest of the visit. */
export function SideSwitch({lines}: {lines: Record<Side, number>}): ReactNode {
  const side = useSide();
  const ref = useRef<HTMLDivElement>(null);
  useKeptInPlace(ref, side);
  const choose = (next: Side) => {
    if (next !== side && ref.current) switchSide(next, ref.current);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = side === 'versatia' ? 'bukkit' : 'versatia';
    choose(next);
    ref.current?.querySelector<HTMLElement>(`[data-side="${next}"]`)?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Code written with"
      title="Lines of code, without blank lines and imports"
      className={clsx(styles.switch, side === 'bukkit' && styles.bukkit)}
      onKeyDown={onKeyDown}>
      {options.map(option => (
        <button
          key={option.side}
          type="button"
          role="radio"
          aria-checked={option.side === side}
          tabIndex={option.side === side ? 0 : -1}
          data-side={option.side}
          className={styles.option}
          onClick={() => choose(option.side)}>
          {option.label}
          <span className={styles.lines}>{lines[option.side]}</span>
        </button>
      ))}
    </div>
  );
}

const withCode = (text: string) => text.split('`').map((part, index) => (index % 2 ? <code key={index}>{part}</code> : part));

/**
 * Several files and the output they produce in one block, one tab each: the files on the left, an
 * `output` tab on the right. Every panel of a side stays laid out, so switching tabs never changes
 * the height. Cards marked `bukkit` form the Bukkit side of a pair, behind a switch that also
 * shows `spares`, what the reader no longer writes.
 */
export default function CodeCards({children, spares}: {children: ReactNode; spares?: string}): ReactNode {
  const cards = Children.toArray(children).filter(
    (child): child is Card => isValidElement(child) && child.type === CodeCard,
  );
  const paired = cards.some(card => card.props.bukkit);
  const chosen = useSide();
  const side = paired ? chosen : 'versatia';
  const indexesOf = (of: Side) => cards.flatMap((card, index) => (sideOf(card) === of ? [index] : []));
  const first = (of: Side) => indexesOf(of).find(index => cards[index].props.default) ?? indexesOf(of)[0] ?? 0;
  const [active, setActive] = useState(() => ({versatia: first('versatia'), bukkit: first('bukkit')}));
  const shown = indexesOf(side);
  const current = active[side];
  const id = useId();
  const {plain} = usePrismTheme();

  const select = (index: number) => setActive({...active, [side]: index});
  const onKeyDown = (event: KeyboardEvent) => {
    const step = {ArrowRight: 1, ArrowLeft: -1}[event.key];
    if (!step) return;
    const next = shown[(shown.indexOf(current) + step + shown.length) % shown.length];
    select(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <div className={styles.cards} style={{backgroundColor: plain.backgroundColor, color: plain.color}}>
      <div className={styles.bar}>
        <div className={styles.tabs} role="tablist" onKeyDown={onKeyDown}>
          {shown.map(index => (
            <button
              key={index}
              id={`${id}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={index === current}
              aria-controls={`${id}-panel-${index}`}
              tabIndex={index === current ? 0 : -1}
              className={clsx(styles.tab, cards[index].props.output && styles.output, index === current && styles.active)}
              onClick={() => select(index)}>
              {cards[index].props.title}
            </button>
          ))}
        </div>
        {paired && (
          <SideSwitch
            lines={{
              versatia: linesOf(cards.filter(card => !card.props.bukkit)),
              bukkit: linesOf(cards.filter(card => card.props.bukkit)),
            }}
          />
        )}
      </div>
      <div className={styles.panels}>
        {cards.map((card, index) => (
          <div
            key={index}
            id={`${id}-panel-${index}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${index}`}
            aria-hidden={index !== current}
            className={clsx(styles.panel, sideOf(card) !== side ? styles.hidden : index !== current && styles.inactive)}>
            {typeof card.props.children === 'string' ? (
              <CodeBlock language={card.props.language ?? 'text'}>{card.props.children}</CodeBlock>
            ) : (
              card.props.children
            )}
          </div>
        ))}
      </div>
      {paired && spares && (
        <p className={clsx(styles.spares, side !== 'bukkit' && styles.hidden)}>
          What you no longer write: {withCode(spares)}.
        </p>
      )}
    </div>
  );
}
