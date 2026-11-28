import {readFileSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {LoadContext, Plugin} from '@docusaurus/types';
import type {LoadedContent} from '@docusaurus/plugin-content-docs';
import {twinPath} from './twin';

type SidebarItem = {type: string; id?: string; label?: string; items?: SidebarItem[]; customProps?: {llms?: string}};

type ApiSymbol = {
  name: string;
  package: string;
  kind: string;
  artifact: string;
  receiver?: string;
  signature?: string;
  summary?: string;
  bukkit?: string[];
  entries?: {name: string; summary?: string}[];
  overloads?: number;
};

type Instance = 'default' | 'experimental' | 'admin';

type Page = {
  instance: Instance;
  id: string;
  title: string;
  description: string;
  permalink: string;
  source: string;
  trail: string[];
  optional: boolean;
  counterpart?: string;
  text: string;
  markdown: string;
};

type Card = {title: string; language: string; code: string; bukkit: boolean; output: boolean};
type Pair = {place: string; url: string; spares?: string; cards: Card[]};

const ORG = 'https://github.com/VersatiaFramework';
const AUDIENCES: Record<Instance, string> = {
  default: 'Developer documentation',
  experimental: 'Experimental developer documentation',
  admin: 'Server admin guide',
};
const LABELS: Record<string, string> = {admin: 'For the server admin', developer: 'For the plugin developer'};
// Extension names too common to import on the strength of `.name` alone, unless their receiver type or package is in the snippet
const GENERIC = new Set(['get', 'set', 'update', 'list', 'single', 'singleOrNull', 'bind', 'into', 'store', 'require', 'validate',
  'cycle', 'inject', 'failure', 'log', 'await', 'present', 'text', 'scope', 'messages', 'registry', 'reload']);
const TYPE_KINDS = new Set(['class', 'interface', 'object', 'annotation', 'enum', 'fun interface', 'typealias']);

const codeCardsBlock = /<CodeCards([^>]*)>([\s\S]*?)<\/CodeCards>/g;
const codeCard = /<CodeCard\b([^>]*)>([\s\S]*?)<\/CodeCard>/g;
const cardFence = /```(\w*)[^\n]*\n([\s\S]*?)\n```/;
const exampleCard = /<ExampleCard\b([^>]*)>([\s\S]*?)<\/ExampleCard>/g;
const pinnedHeading = /^(#{2,4}) (.+?) \{\/\* #([\w-]+) \*\/\}$/gm;

const attribute = (attributes: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];
const flag = (attributes: string, name: string) => new RegExp(`\\b${name}\\b(?!=)`).test(attributes.replace(/"[^"]*"/g, '""'));
const normalized = (file: string) => path.resolve(file).toLowerCase();
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every doc of a sidebar in order, with the categories holding it from the top level down and whether one of them is optional for assistants. */
function placesOf(items: SidebarItem[], trail: string[] = [], optional = false): {id: string; trail: string[]; optional: boolean}[] {
  return items.flatMap(item =>
    item.type === 'category'
      ? placesOf(item.items ?? [], [...trail, item.label ?? ''], optional || item.customProps?.llms === 'optional')
      : item.type === 'doc' && item.id
        ? [{id: item.id, trail, optional}]
        : [],
  );
}

/**
 * The documentation for AI assistants: every page as Markdown at its address plus `.md`, `llms.txt` (an index with the
 * notes, rules and Bukkit replacements an assistant needs first), `llms-full.txt` and `admin/llms-full.txt` (everything in
 * one file) and `symbols.md` (every public declaration, from plugins/symbols.json). Whatever a component shows on the site
 * becomes text here, so nothing an assistant needs lives only in a colour, a tab or a script.
 */
export default function llms(context: LoadContext): Plugin {
  const site = context.siteConfig.url.replace(/\/$/, '');
  const index = JSON.parse(readFileSync(path.join(context.siteDir, 'plugins/symbols.json'), 'utf8')) as {
    version: string;
    symbols: ApiSymbol[];
  };
  const topLevel = new Map<string, ApiSymbol[]>();
  const extensions = new Map<string, ApiSymbol[]>();
  for (const symbol of index.symbols) {
    const map = symbol.receiver ? extensions : topLevel;
    map.set(symbol.name, [...(map.get(symbol.name) ?? []), symbol]);
  }

  let pages: Page[] = [];
  const bySource = new Map<string, Page>();
  const byRoute = new Map<string, Page>();
  const routeKey = (route: string) => route.replace(/\/+$/, '') || '/';
  const mdUrl = (page: Page) => `${site}${twinPath(page.permalink)}`;
  const page = (route: string) => {
    const found = byRoute.get(routeKey(route));
    if (!found) throw new Error(`plugins/llms.ts links to ${route}, which is no page; update the link`);
    return found;
  };

  /** A link target of `from` as an absolute address, pointing at the Markdown twin when it is a page. */
  function resolve(target: string, from: Page): string {
    if (target.startsWith('pathname://')) return `${site}${target.slice('pathname://'.length)}`;
    if (/^[a-z][a-z\d+.-]*:/i.test(target)) return target;
    const hash = target.includes('#') ? target.slice(target.indexOf('#')) : '';
    const route = target.slice(0, target.length - hash.length);
    if (!route) return `${mdUrl(from)}${hash}`;
    if (route.startsWith('/')) {
      const known = byRoute.get(routeKey(route));
      return known ? `${mdUrl(known)}${hash}` : `${site}${route}${hash}`;
    }
    const known = bySource.get(normalized(path.resolve(path.dirname(from.source), decodeURI(route))));
    return known ? `${mdUrl(known)}${hash}` : new URL(target, `${site}${from.permalink}`).href;
  }

  const rewriteLinks = (line: string, from: Page) =>
    line.replace(
      /(!?)\[((?:[^[\]]|\[[^\]]*])*)]\(([^()\s]+(?:\([^()]*\))?)(\s+"[^"]*")?\)/g,
      (_all, bang: string, text: string, target: string, title = '') => `${bang}[${text}](${resolve(target, from)}${title})`,
    );

  /** The Versatia imports a Kotlin snippet needs, by the names it uses and does not declare. */
  function importsFor(source: string): string[] {
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, '')
      .replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\\n])*"/g, literal => (literal.match(/\$\{[^}]*}/g) ?? []).join(' '));
    const declared = new Set([
      ...[...code.matchAll(/\b(?:class|interface|object|typealias|fun|val|var)\s+(?:<[^>]*>\s*)?(?:[\w.]+\.)?(\w+)/g)].map(match => match[1]),
      ...[...code.matchAll(/[(,]\s*(?:@\w+(?:\([^)]*\))?\s+)*(?:(?:private|internal|protected|override|vararg)\s+)*(?:va[lr]\s+)?(\w+)\s*:/g)].map(
        match => match[1],
      ),
      ...[...code.matchAll(/\{\s*([\w, ]+?)\s*->/g)].flatMap(match => match[1].split(',').map(name => name.trim())),
    ]);
    const found = new Set<string>();
    const packages = new Set<string>();
    const add = (symbol?: ApiSymbol) => {
      if (!symbol) return;
      found.add(`${symbol.package}.${symbol.name}`);
      packages.add(symbol.package);
    };
    const receiverType = (symbol: ApiSymbol) => (symbol.receiver ?? '').replace(/<.*$/, '').replace(/\?$/, '');
    const single = (candidates: ApiSymbol[]) => {
      if (new Set(candidates.map(symbol => symbol.package)).size === 1) return candidates[0];
      const named = candidates.filter(symbol => new RegExp(`\\b${escapeRegExp(receiverType(symbol))}\\b`).test(code));
      return new Set(named.map(symbol => symbol.package)).size === 1 ? named[0] : undefined;
    };
    for (const [, name] of code.matchAll(/(?<![\w.])@?([A-Z]\w*)\b/g))
      if (!declared.has(name)) add(single((topLevel.get(name) ?? []).filter(symbol => TYPE_KINDS.has(symbol.kind) || /^[A-Z_\d]+$/.test(name))));
    for (const [, name] of code.matchAll(/(?<![\w.])([a-z]\w*)\s*(?=[({<])/g))
      if (!declared.has(name)) add(single((topLevel.get(name) ?? []).filter(symbol => !TYPE_KINDS.has(symbol.kind))));
    const mainClass = /:\s*VersatiaPlugin\s*\(/.test(code);
    for (const [name, candidates] of extensions) {
      const usable = candidates.filter(symbol => {
        if (symbol.receiver === 'VersatiaEngine.Companion') return new RegExp(`\\bVersatiaEngine\\.${name}\\b`).test(code);
        if (symbol.receiver === 'Plugin')
          return (
            new RegExp(`\\bplugin\\.${name}\\b`).test(code) ||
            (mainClass && !declared.has(name) && new RegExp(`(?<![\\w.])${name}\\b(?!\\s*[:=](?!=))`).test(code))
          );
        if (!new RegExp(`[\\w)\\]?!]\\.${name}\\b`).test(code)) return false;
        return !GENERIC.has(name) || packages.has(symbol.package) || new RegExp(`\\b${escapeRegExp(receiverType(symbol))}\\b`).test(code);
      });
      if (usable.length) add(single(usable));
    }
    return [...found].sort();
  }

  /** A fenced block for the Markdown twin: wrong and fixed lines say so in a comment, Kotlin gets its Versatia imports. */
  function codeBlock(indent: string, marker: string, info: string, lines: string[]): string[] {
    const meta = info.replace(/\s*\{[\d,\s-]+}/g, '').replace(/\s*showLineNumbers\b/g, '').trim();
    const language = meta.split(/\s+/)[0] ?? '';
    const title = attribute(meta, 'title');
    const code: string[] = [];
    let next: string | undefined;
    let block: string | undefined;
    for (const raw of lines) {
      const line = raw.startsWith(indent) ? raw.slice(indent.length) : raw.trimStart();
      const magic = /^\s*(\/\/|#|--|<!--)\s*(error|fix|highlight)-(next-line|start|end)\s*(?:-->)?\s*$/.exec(line);
      if (magic) {
        const [, prefix, kind, which] = magic;
        const label = kind === 'error' ? '✗ wrong' : kind === 'fix' ? '✓ fix' : undefined;
        const comment = label && (prefix === '<!--' ? `<!-- ${label} -->` : `${prefix} ${label}`);
        if (which === 'next-line') next = comment;
        else block = which === 'start' ? comment : undefined;
        continue;
      }
      const mark = next ?? block;
      next = undefined;
      code.push(mark && line.trim() ? `${line}  ${mark}` : line);
    }
    if (/^(kotlin|kt)$/.test(language) && !title?.endsWith('.kts') && !code.some(line => /^import\s/.test(line))) {
      const imports = importsFor(code.join('\n')).map(name => `import ${name}`);
      if (imports.length) {
        const at = code[0]?.startsWith('package ') ? 1 : 0;
        code.splice(at, 0, ...(at ? [''] : []), ...imports, '');
      }
    }
    return [`${indent}${marker}${meta}`, ...code.map(line => (line ? `${indent}${line}` : line)), `${indent}${marker}`];
  }

  const cardsOf = (inner: string): Card[] =>
    [...inner.matchAll(codeCard)].map(([, own, content]) => {
      const [, language = 'text', code = content.trim()] = cardFence.exec(content) ?? [];
      return {title: attribute(own, 'title') ?? '', language: language || 'text', code, bukkit: flag(own, 'bukkit'), output: flag(own, 'output')};
    });

  const fenceOf = (card: Card) => `\`\`\`${card.language} title="${card.title}${card.output ? ' (output)' : ''}"\n${card.code}\n\`\`\`\n`;

  /** Every Versatia/Plain Paper pair of the developer documentation in the order of the sidebar, as the gallery of Coming from Bukkit shows them. */
  function pairs(): Pair[] {
    return pages
      .filter(doc => doc.instance === 'default')
      .flatMap(doc =>
        [...doc.text.matchAll(codeCardsBlock)].flatMap(block => {
          const cards = cardsOf(block[2]);
          if (!cards.some(card => card.bukkit)) return [];
          const section = [...doc.text.slice(0, block.index).matchAll(pinnedHeading)].at(-1);
          return [
            {
              place: [...doc.trail.slice(1), doc.title, ...(section ? [section[2]] : [])].join(' › '),
              url: `${mdUrl(doc)}${section ? `#${section[3]}` : ''}`,
              spares: attribute(block[1], 'spares'),
              cards,
            },
          ];
        }),
      );
  }

  const gallery = () =>
    pairs()
      .map(pair =>
        [
          `### ${pair.place}`,
          '',
          `[Read the section](${pair.url}).${pair.spares ? ` What you no longer write: ${pair.spares}.` : ''}`,
          '',
          '**Versatia**',
          '',
          ...pair.cards.filter(card => !card.bukkit).map(fenceOf),
          '**Plain Paper** (what the Versatia code replaces; not code to write)',
          '',
          ...pair.cards.filter(card => card.bukkit).map(fenceOf),
        ].join('\n'),
      )
      .join('\n');

  function experimentalContents(): string {
    const features = pages.filter(doc => doc.instance === 'experimental' && doc.id !== 'intro' && (!doc.id.includes('/') || doc.id.endsWith('/index')));
    if (!features.length)
      return `Nothing is experimental at the moment: every feature is in the [stable documentation](${mdUrl(page('/docs'))}).`;
    return ['| Feature | What it is |', '|---|---|', ...features.map(doc => `| [${doc.title}](${mdUrl(doc)}) | ${doc.description} |`)].join('\n');
  }

  /** One line of prose or a heading outside code: components, HTML and MDX comments become text, links absolute addresses. */
  const inline = (line: string, from: Page) =>
    rewriteLinks(
      line
        .replace(/\s*\{\/\*\s*#([\w-]+)\s*\*\/}/g, ' {#$1}')
        .replace(/\{\/\*[\s\S]*?\*\/}/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<Audience\s+who="(\w+)"[^>]*\/>/g, (_all, who: string) => `(${who === 'admin' ? 'server admin' : 'plugin developer'})`)
        .replace(/<TwinEngines\s*\/>/g, '[twin](/docs/modules/database/configuration#mysql-and-mariadb)')
        .replace(/<Since\s+v="([^"]+)"\s*\/>/g, '(since $1)')
        .replace(/<Link\s+to="([^"]+)"[^>]*>([\s\S]*?)<\/Link>/g, '[$2]($1)')
        .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
        .replace(/<h(\d)>([\s\S]*?)<\/h\1>/g, '**$2**')
        .replace(/<\/?(?:div|p|span)\b[^>]*>/g, '')
        .replace(/<br\s*\/?>/g, ''),
      from,
    );

  /** The Markdown twin of a page. */
  function toMarkdown(doc: Page): string {
    let text = doc.text.replace(/^---\n[\s\S]*?\n---\n/, '');
    text = text.replace(codeCardsBlock, (_all, own: string, inner: string) => {
      const cards = cardsOf(inner);
      const spares = attribute(own, 'spares');
      const paired = cards.some(card => card.bukkit);
      return [...cards.filter(card => !card.bukkit).map(fenceOf), ...(paired && spares ? [`What you no longer write, compared with plain Paper: ${spares}.\n`] : [])].join('\n');
    });
    text = text.replace(exampleCard, (_all, own: string, inner: string) => {
      const repo = attribute(own, 'repo') ?? '';
      const file = attribute(own, 'file');
      const label = attribute(own, 'fileLabel') ?? file?.split('/').pop();
      const start = file ? ` Start with [${label}](${ORG}/${repo}/blob/HEAD/${file}).` : '';
      return `**Example:** [${repo}](${ORG}/${repo}): ${inner.trim().replace(/\s*\n\s*/g, ' ')}${start}`;
    });
    text = text.replace(/^<BukkitGallery\s*\/>$/m, gallery).replace(/^<ExperimentalContents\s*\/>$/m, experimentalContents);

    const out: string[] = [];
    let quote = false;
    const push = (...lines: string[]) => {
      for (const line of lines)
        if (!quote) out.push(line);
        else if (line) out.push(`> ${line}`);
        else if (out.at(-1) !== '>') out.push('>');
    };
    let fence: {indent: string; marker: string; info: string; lines: string[]} | undefined;
    let titled = false;
    let html = 0;
    for (const line of text.split('\n')) {
      if (fence) {
        if (new RegExp(`^\\s*${escapeRegExp(fence.marker[0])}{${fence.marker.length},}\\s*$`).test(line)) {
          push(...codeBlock(fence.indent, fence.marker, fence.info, fence.lines));
          fence = undefined;
        } else fence.lines.push(line);
        continue;
      }
      const opening = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
      if (opening) {
        fence = {indent: opening[1], marker: opening[2], info: opening[3].trim(), lines: []};
        continue;
      }
      if (/^import\s.+\sfrom\s+['"][^'"]+['"];?\s*$/.test(line) || /^export\s/.test(line)) continue;
      if (!titled && /^# /.test(line)) {
        titled = true;
        continue;
      }
      if (/^\s*<\/?(?:Tabs|ExampleGrid)\b[^>]*>\s*$/.test(line) || /^\s*<\/TabItem>\s*$/.test(line)) continue;
      const tab = /^\s*<TabItem\b([^>]*)>\s*$/.exec(line);
      if (tab) {
        push(`**${attribute(tab[1], 'label') ?? attribute(tab[1], 'value')}**`, '');
        continue;
      }
      const admonition = /^:::(\w+)(?:\[(.*)]|\s+(.+))?\s*$/.exec(line);
      if (admonition && !quote) {
        const [, type, bracketed, spaced] = admonition;
        const label = LABELS[type] ?? `${type[0].toUpperCase()}${type.slice(1)}`;
        const title = bracketed ?? spaced;
        push('');
        quote = true;
        push(`**${title ? `${label}: ${title}` : label}**`, '');
        continue;
      }
      if (/^:::\s*$/.test(line) && quote) {
        if (out.at(-1) === '>') out.pop();
        quote = false;
        push('');
        continue;
      }
      const opened = (line.match(/<div\b/g) ?? []).length;
      const closed = (line.match(/<\/div>/g) ?? []).length;
      const converted = inline(line, doc);
      push(html > 0 || opened ? converted.trimStart() : converted);
      html += opened - closed;
    }

    const banners = [
      ...(doc.instance === 'experimental' || (doc.instance === 'admin' && doc.id.startsWith('experimental/'))
        ? ['> **Experimental:** this page describes an experimental feature. It may change or disappear in any release without notice, and the stable documentation does not cover it.']
        : []),
      ...(doc.counterpart
        ? [`> ${doc.instance === 'admin' ? 'Writing a plugin? This topic in the developer documentation' : 'Running a server? This topic in the server admin guide'}: ${resolve(doc.counterpart, doc)}`]
        : []),
    ];
    const header = [
      `# ${doc.title}`,
      '',
      ...(doc.description ? [`> ${doc.description}`, ''] : []),
      `*${[AUDIENCES[doc.instance], ...doc.trail].join(' › ')}* · ${site}${doc.permalink}`,
      '',
      ...banners.flatMap(banner => [banner, '']),
    ];
    return `${[...header, ...out].join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
  }

  /** The body of the section `id` of a page's Markdown twin, without its heading. */
  function section(doc: Page, id: string): string[] {
    const lines = doc.markdown.split('\n');
    const start = lines.findIndex(line => line.endsWith(` {#${id}}`) && line.startsWith('#'));
    if (start < 0) throw new Error(`plugins/llms.ts reads the section #${id} of ${doc.source}, which has none; update plugins/llms.ts`);
    const level = /^#+/.exec(lines[start])![0].length;
    const end = lines.findIndex((line, i) => i > start && new RegExp(`^#{1,${level}} `).test(line));
    return lines.slice(start + 1, end < 0 ? undefined : end);
  }

  /** The leading list of a section, the notes llms.txt opens with. */
  const firstList = (lines: string[]) => {
    const from = lines.findIndex(line => line.startsWith('- '));
    const to = lines.findIndex((line, i) => i > from && line.trim() === '');
    return from < 0 ? [] : lines.slice(from, to < 0 ? undefined : to);
  };

  /**
   * The rules under "Writing a plugin" in Best practices, one line per topic: the bold leads of its list, else the rows of
   * its table, else the first sentence of its text.
   */
  function rules(): string[] {
    const practices = page('/docs/reference/best-practices');
    const topics: {title: string; id: string; lines: string[]}[] = [];
    let inCode = false;
    for (const line of section(practices, 'writing-a-plugin')) {
      if (/^\s*(`{3,}|~{3,})/.test(line)) inCode = !inCode;
      const heading = /^### (.+?) \{#([\w-]+)}$/.exec(line);
      if (heading) topics.push({title: heading[1], id: heading[2], lines: []});
      else if (!inCode && !/^\s*(`{3,}|~{3,})/.test(line)) topics.at(-1)?.lines.push(line);
    }
    return topics.map(({title, id, lines}) => {
      const leads = lines.map(line => /^- \*\*(.+?)\*\*/.exec(line)?.[1]?.replace(/[.,:;]+$/, '')).filter(Boolean);
      const rows = lines.filter(line => /^\|/.test(line) && !/^\|[\s|:-]+\|$/.test(line)).slice(1)
        .map(row => row.split('|').slice(1, -1).map(cell => cell.trim()))
        .map(([what, convention, example]) => `${what}: ${convention}${example ? ` (${example})` : ''}`);
      const text = lines.join('\n').split(/\n\s*\n/).map(paragraph => paragraph.trim().replace(/\s*\n\s*/g, ' '))
        .find(paragraph => paragraph && !/^[-|>*#]/.test(paragraph));
      const first = text && (/^(.+?[.!?])(?=\s+[A-Z([`]|$)/.exec(text)?.[1] ?? text);
      const rule = leads.length ? `${leads.join('; ')}.` : rows.length ? `${rows.join('; ')}.` : (first ?? '');
      return `- **${title}** ([details](${mdUrl(practices)}#${id})): ${rule}`;
    });
  }

  const call = (symbol: ApiSymbol) => `VersatiaEngine.${symbol.name}${symbol.kind === 'function' ? (symbol.signature?.includes(`${symbol.name}()`) ? '()' : '(...)') : ''}`;

  const inlineCode = new Map<Page, string>();

  /**
   * The developer page teaching a name, for the symbol index: the one naming it in code, inline or fenced, most often.
   * The reference pages are left out, since they name every feature.
   */
  function homeOf(name: string): Page | undefined {
    if (GENERIC.has(name)) return undefined;
    const word = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
    let best: Page | undefined;
    let most = 0;
    for (const doc of pages.filter(candidate => candidate.instance === 'default' && !candidate.optional && !candidate.id.startsWith('reference/'))) {
      if (!inlineCode.has(doc)) {
        const fenced = [...doc.text.matchAll(/^\s*```[^\n]*\n([\s\S]*?)\n\s*```/gm)].map(block => block[1]);
        const prose = doc.text.replace(/^\s*```[^\n]*\n[\s\S]*?\n\s*```/gm, '');
        inlineCode.set(doc, [...fenced, ...[...prose.matchAll(/`[^`\n]+`/g)].map(span => span[0])].join(' '));
      }
      const count = inlineCode.get(doc)!.match(word)?.length ?? 0;
      if (count > most) [best, most] = [doc, count];
    }
    return best;
  }

  function symbolsMarkdown(): string {
    const artifacts: Record<string, string> = {
      VersatiaAPI: `Every plugin compiles against it with \`compileOnly\`, together with the \`ksp\` processor ([Installation](${mdUrl(page('/docs/getting-started/installation'))}#in-your-build)).`,
      'VersatiaModule-Database': `A plugin using the Database module compiles against VersatiaStarter instead, which brings this API ([Database module](${mdUrl(page('/docs/modules/database'))})).`,
      VersatiaInteractions: `Experimental. A plugin adding an action to its menu or listening to its events compiles against it with \`compileOnly\` ([VersatiaInteractions](${mdUrl(page('/experimental/plugins/interactions'))})).`,
      VersatiaTrade: `Experimental. A plugin listening to its events or giving its items an identity compiles against it with \`compileOnly\` ([VersatiaTrade](${mdUrl(page('/experimental/plugins/trade'))})).`,
      VersatiaRegions: `Experimental. A plugin reading regions or listening to its events compiles against it with \`compileOnly\` ([VersatiaRegions](${mdUrl(page('/experimental/plugins/regions'))})).`,
    };
    const lines = [
      '# Versatia symbol index',
      '',
      `> Every public declaration of VersatiaAPI ${index.version}, of the module APIs and of the plugins built on Versatia: package, signature and the first sentence of its KDoc, generated from the published sources. Import a declaration as \`import <package>.<name>\`.`,
      '',
      'Extensions on `VersatiaEngine.Companion` are called on the class, `VersatiaEngine.broadcast(...)`; extensions on `Plugin` on a plugin, `plugin.runTaskLater(...)`, and in the main class without `plugin.`. Declarations marked `@VersatiaInternalApi` are left out: they are plumbing for KSP and VersatiaCore.',
    ];
    let artifact = '';
    let pkg = '';
    for (const symbol of index.symbols) {
      if (symbol.artifact !== artifact) {
        artifact = symbol.artifact;
        lines.push('', `## ${artifact}`, '', artifacts[artifact] ?? '');
        pkg = '';
      }
      if (symbol.package !== pkg) {
        pkg = symbol.package;
        lines.push('', `### ${pkg}`, '');
      }
      const home = homeOf(symbol.name);
      const entries = symbol.entries?.length
        ? ` Entries: ${symbol.entries.map(entry => `\`${entry.name}\`${entry.summary ? ` (${entry.summary.replace(/\.$/, '')})` : ''}`).join(', ')}.`
        : '';
      const see = home ? `[${home.title}](${mdUrl(home)})` : '';
      const text = symbol.summary ? `: ${symbol.summary}${entries}${see ? ` See ${see}.` : ''}` : entries ? `:${entries}${see ? ` See ${see}.` : ''}` : see ? `: see ${see}.` : '';
      lines.push(`- \`${symbol.signature ?? symbol.name}\`${symbol.overloads ? ` (${symbol.overloads} overloads)` : ''}${text}`);
    }
    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
  }

  function llmsTxt(): string {
    const intro = page('/docs');
    const summary = intro.markdown
      .split('\n\n')
      .find(paragraph => /^[*A-Z]/.test(paragraph) && !paragraph.startsWith('*Developer'))
      ?.replace(/\s*\n\s*/g, ' ');
    const notes = firstList(section(page('/docs/getting-started/ai-assistants'), 'what-the-assistant-is-told-first'));
    const bukkit = page('/docs/getting-started/coming-from-bukkit');
    const table = section(bukkit, 'bukkit-concept-versatia').filter(line => line.startsWith('|'));
    const facade = index.symbols
      .filter(symbol => symbol.bukkit)
      .map(symbol => `- ${symbol.bukkit!.map(replaced => `\`${replaced}\``).join(', ')} → \`${call(symbol)}\`${symbol.summary ? `: ${symbol.summary}` : ''}`);
    const groups = new Map<string, Page[]>();
    for (const doc of pages) {
      const group = doc.optional
        ? 'Optional'
        : doc.instance === 'admin'
          ? AUDIENCES.admin
          : doc.instance === 'experimental'
            ? 'Experimental'
            : (doc.trail[0] ?? 'Introduction');
      if (doc.instance === 'experimental' && doc.id === 'intro' && pages.filter(other => other.instance === 'experimental').length === 1) continue;
      groups.set(group, [...(groups.get(group) ?? []), doc]);
    }
    const optional = groups.get('Optional');
    groups.delete('Optional');
    if (optional) groups.set('Optional', optional);
    const label = (doc: Page) => [...new Set([...doc.trail.slice(doc.instance === 'default' && !doc.optional ? 1 : 0), doc.title])].join(' › ');
    return `${[
      '# Versatia',
      '',
      `> ${summary ?? context.siteConfig.tagline}`,
      '',
      `This index of ${site} is written for AI assistants. Every page it lists is Markdown at its address plus \`.md\`, holding everything the site shows; Kotlin snippets there carry the Versatia imports they need, while Paper, Adventure and Kotlin imports are left to you.`,
      '',
      '**First notes:**',
      '',
      ...notes,
      '',
      `**Rules** (the leads of [Best practices](${mdUrl(page('/docs/reference/best-practices'))}); each topic links to the details):`,
      '',
      ...rules(),
      '',
      `**Instead of plain Bukkit code** ([Coming from Bukkit](${mdUrl(bukkit)})):`,
      '',
      ...table,
      '',
      '**Server-wide calls:** `VersatiaEngine` (import `dev.versatia.VersatiaEngine` and the member) replaces these Bukkit calls:',
      '',
      ...facade,
      '',
      '**Everything in one file:**',
      '',
      `- [llms-full.txt](${site}/llms-full.txt): the whole developer documentation, then the symbol index`,
      `- [admin/llms-full.txt](${site}/admin/llms-full.txt): the whole server admin guide`,
      `- [symbols.md](${site}/symbols.md): package, signature and summary of every public declaration of VersatiaAPI, the module APIs and the plugins built on Versatia`,
      ...[...groups].flatMap(([group, docs]) => ['', `## ${group}`, '', ...docs.map(doc => `- [${label(doc)}](${mdUrl(doc)})${doc.description ? `: ${doc.description}` : ''}`)]),
    ].join('\n')}\n`;
  }

  const full = (title: string, summary: string, docs: Page[], after?: string) =>
    `# ${title}\n\n> ${summary}\n\n${[...docs.map(doc => doc.markdown), ...(after ? [after] : [])].join('\n---\n\n')}`;

  return {
    name: 'versatia-llms',
    getPathsToWatch: () => [path.join(context.siteDir, '{docs,admin,experimental}/**/*.{md,mdx}'), path.join(context.siteDir, 'plugins/symbols.json')],
    async allContentLoaded({allContent}) {
      const instances = allContent['docusaurus-plugin-content-docs'] as Record<Instance, LoadedContent>;
      pages = [];
      bySource.clear();
      byRoute.clear();
      for (const instance of ['default', 'experimental', 'admin'] as const) {
        const {loadedVersions: [version]} = instances[instance];
        const placed = Object.values(version.sidebars).flatMap(items => placesOf(items as SidebarItem[]));
        const unplaced = version.docs.filter(doc => !placed.some(place => place.id === doc.id)).map(doc => ({id: doc.id, trail: [], optional: false}));
        for (const place of [...placed, ...unplaced]) {
          const doc = version.docs.find(candidate => candidate.id === place.id);
          if (!doc) continue;
          const source = doc.source.replace('@site', context.siteDir);
          const entry: Page = {
            instance,
            id: doc.id,
            title: doc.title,
            description: doc.description,
            permalink: doc.permalink,
            source,
            trail: place.trail,
            optional: place.optional,
            counterpart: (doc.frontMatter as {counterpart?: string}).counterpart,
            text: (await readFile(source, 'utf8')).replace(/\r\n/g, '\n'),
            markdown: '',
          };
          pages.push(entry);
          bySource.set(normalized(source), entry);
          byRoute.set(routeKey(doc.permalink), entry);
        }
      }
      for (const doc of pages) doc.markdown = toMarkdown(doc);
    },
    async postBuild({outDir}) {
      const write = async (file: string, text: string) => {
        const target = path.join(outDir, file);
        await mkdir(path.dirname(target), {recursive: true});
        await writeFile(target, text);
      };
      const symbols = symbolsMarkdown();
      const developer = pages.filter(doc => doc.instance !== 'admin' && !(doc.instance === 'experimental' && doc.id === 'intro'));
      await Promise.all([
        ...pages.map(doc => write(twinPath(doc.permalink), doc.markdown)),
        write('llms.txt', llmsTxt()),
        write('symbols.md', symbols),
        write(
          'llms-full.txt',
          full('Versatia developer documentation', `Every page of ${site}/docs in the order of the sidebar, then the symbol index. Each page starts with its title and address.`, developer, symbols),
        ),
        write(
          'admin/llms-full.txt',
          full('Versatia server admin guide', `Every page of ${site}/admin in the order of the sidebar. Each page starts with its title and address.`, pages.filter(doc => doc.instance === 'admin')),
        ),
      ]);
    },
  };
}
