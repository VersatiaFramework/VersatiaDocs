import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {LoadContext, Plugin} from '@docusaurus/types';
import type {LoadedContent} from '@docusaurus/plugin-content-docs';

type SidebarItem = {type: string; id?: string; label?: string; items?: SidebarItem[]};

const blocks = /<CodeCards([^>]*)>([\s\S]*?)<\/CodeCards>/g;
const cards = /<CodeCard\b([^>]*)>([\s\S]*?)<\/CodeCard>/g;
const fence = /```(\w*)[^\n]*\n([\s\S]*?)\n```/;
const headings = /^#{2,3} (.+?) \{\/\* #([\w-]+) \*\/\}$/gm;

const attribute = (attributes: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];
const flag = (attributes: string, name: string) =>
  new RegExp(`\\b${name}\\b(?!=)`).test(attributes.replace(/"[^"]*"/g, '""')) || undefined;

/** Every doc of a sidebar in order, with the labels of the categories under the top level that hold it. */
const placesOf = (items: SidebarItem[], trail: string[] = []): [string, string[]][] =>
  items.flatMap(item =>
    item.type === 'category'
      ? placesOf(item.items ?? [], [...trail, item.label ?? ''])
      : item.type === 'doc' && item.id
        ? [[item.id, trail.slice(1)] as [string, string[]]]
        : [],
  );

/**
 * Collects the Versatia/Bukkit pairs of the developer documentation, every `<CodeCards>` holding a
 * `bukkit` card, in the order of the sidebar, for the gallery of Coming from Bukkit.
 */
export default function comparisons(context: LoadContext): Plugin {
  return {
    name: 'versatia-comparisons',
    getPathsToWatch: () => [path.join(context.siteDir, 'docs/**/*.{md,mdx}')],
    async allContentLoaded({allContent, actions}) {
      const {loadedVersions: [version]} = allContent['docusaurus-plugin-content-docs'].default as LoadedContent;
      const docs = new Map(version.docs.map(doc => [doc.id, doc]));
      const found: BukkitComparison[] = [];
      for (const [id, trail] of placesOf(version.sidebars.docs as SidebarItem[])) {
        const doc = docs.get(id);
        if (!doc) continue;
        const text = (await readFile(doc.source.replace('@site', context.siteDir), 'utf8')).replace(/\r\n/g, '\n');
        for (const block of text.matchAll(blocks)) {
          const pair = [...block[2].matchAll(cards)].map(([, own, content]) => {
            const [, language = 'text', code = content.trim()] = fence.exec(content) ?? [];
            return {
              title: attribute(own, 'title') ?? '',
              language,
              code,
              bukkit: flag(own, 'bukkit'),
              output: flag(own, 'output'),
              default: flag(own, 'default'),
            };
          });
          if (!pair.some(card => card.bukkit)) continue;
          const section = [...text.slice(0, block.index).matchAll(headings)].at(-1);
          found.push({
            place: [...trail, doc.title, ...(section ? [section[1]] : [])].join(' › '),
            to: section ? `${doc.permalink}#${section[2]}` : doc.permalink,
            spares: attribute(block[1], 'spares'),
            cards: pair,
          });
        }
      }
      await actions.createData('comparisons.json', JSON.stringify(found));
    },
  };
}
