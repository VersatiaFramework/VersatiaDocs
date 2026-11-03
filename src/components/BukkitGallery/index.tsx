import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import comparisons from '@generated/versatia-comparisons/default/comparisons.json';
import CodeCards, {CodeCard, linesOf, SideSwitch} from '@site/src/components/CodeCards';
import styles from './styles.module.css';

const pairs = comparisons.map(({cards, ...pair}) => ({
  ...pair,
  cards: cards.map(({code, ...card}, index) => (
    <CodeCard key={index} {...card}>
      {code}
    </CodeCard>
  )),
}));
const all = pairs.flatMap(pair => pair.cards);
const lines = {versatia: linesOf(all.filter(card => !card.props.bukkit)), bukkit: linesOf(all.filter(card => card.props.bukkit))};

/** Every Versatia/Bukkit pair of the documentation in the order of the sidebar, each linking to the section it comes from. */
export default function BukkitGallery(): ReactNode {
  return (
    <>
      <div className={styles.all}>
        <span>All {pairs.length} examples together</span>
        <SideSwitch lines={lines} />
      </div>
      {pairs.map(({place, to, spares, cards}, index) => (
        <figure key={index} className={styles.pair}>
          <figcaption className={styles.place}>
            <Link to={to}>{place}</Link>
          </figcaption>
          <CodeCards spares={spares}>{cards}</CodeCards>
        </figure>
      ))}
    </>
  );
}
