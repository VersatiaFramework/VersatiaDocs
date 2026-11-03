/** One Versatia/Bukkit pair of the developer documentation, collected at build time by `plugins/comparisons.ts`. */
type BukkitComparison = {
  /** Where the pair is: the sidebar path of its page, then its section. */
  place: string;
  /** The page, and the section when the pair sits under a heading. */
  to: string;
  spares?: string;
  cards: {title: string; language: string; code: string; bukkit?: boolean; output?: boolean; default?: boolean}[];
};

declare module '@generated/versatia-comparisons/default/comparisons.json' {
  const comparisons: BukkitComparison[];
  export default comparisons;
}
