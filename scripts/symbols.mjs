// Writes plugins/symbols.json, the symbol index of the Markdown export (plugins/llms.ts): every public top-level
// declaration of VersatiaAPI, the module APIs and the plugins built on Versatia, read from the sources JARs in the local
// Maven repository.
// `--check` only compares, failing when the committed index is stale (scripts/build-all.sh runs it after publishing).
import {readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';

const version = process.env.VERSATIA_VERSION ?? '0.0.1';
const repository = process.env.MAVEN_LOCAL ?? path.join(homedir(), '.m2', 'repository');
const artifacts = ['VersatiaAPI', 'VersatiaModule-Database', 'VersatiaInteractions', 'VersatiaTrade'];
const output = fileURLToPath(new URL('../plugins/symbols.json', import.meta.url));

/** The `.kt` files of a ZIP archive by path; Gradle stores or deflates every entry. */
function kotlinFiles(archive) {
  const zip = readFileSync(archive);
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error(`${archive} is not a ZIP archive`);
  const files = new Map();
  for (let i = 0, entry = zip.readUInt32LE(end + 16); i < zip.readUInt16LE(end + 10); i++) {
    const nameLength = zip.readUInt16LE(entry + 28);
    const name = zip.toString('utf8', entry + 46, entry + 46 + nameLength);
    const method = zip.readUInt16LE(entry + 10);
    const size = zip.readUInt32LE(entry + 20);
    const local = zip.readUInt32LE(entry + 42);
    entry += 46 + nameLength + zip.readUInt16LE(entry + 30) + zip.readUInt16LE(entry + 32);
    if (!name.endsWith('.kt')) continue;
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    files.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8'));
  }
  return files;
}

const hidden = /^(?:[a-z]+\s+)*(?:internal|private|protected)\s/;
const declaration =
  /^((?:(?:public|inline|suspend|operator|infix|tailrec|data|sealed|abstract|open|enum|annotation|value|const|fun(?= interface))\s+)*)(class|interface|object|typealias|fun|val|var)\s+(.+)$/;

/** Index just past the bracket closing the one at `from`, counting `open`/`close` pairs. */
function closing(text, from, open = '(', close = ')') {
  for (let i = from, depth = 0; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return i + 1;
  }
  return text.length;
}

/** Index just past the type parameters `<...>` starting at `from`, or `from` when there are none. */
const pastTypeParameters = (text, from) => (text[from] === '<' ? closing(text, from, '<', '>') : from);

/** The declaration starting at line `i`, joined to one line until its brackets balance; comments dropped. */
function joined(lines, i) {
  let text = '';
  for (let j = i; j < Math.min(lines.length, i + 40); j++) {
    text += `${j > i ? ' ' : ''}${lines[j].replace(/\s+\/\/.*$/, '').trim()}`;
    const open = (text.match(/[([]/g) ?? []).length - (text.match(/[)\]]/g) ?? []).length;
    if (open <= 0 && !/[,(]$/.test(text)) break;
  }
  return text.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/,? \)/g, ')');
}

/** The first sentence of a KDoc block, with `[Name]` links written as code. */
function summary(kdoc) {
  const text = kdoc
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map(line => line.replace(/^\s*\*\s?/, '').trim())
    .filter(line => !line.startsWith('@'))
    .join(' ')
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
    .replace(/\[([\w.]+)]/g, '`$1`')
    .replace(/\s+/g, ' ')
    .trim();
  return text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? (text || undefined);
}

/** `Bukkit.getPlayer(...)` for every Bukkit call in a facade member's body, arguments elided. */
const bukkitCalls = body =>
  [...body.matchAll(/\bBukkit((?:\.\w+\((?:[^()]|\([^()]*\))*\))+)/g)].map(
    ([, chain]) => `Bukkit${chain.replace(/\(((?:[^()]|\([^()]*\))+)\)/g, '(...)')}`,
  );

/** Every public top-level declaration of one Kotlin file. */
function declarations(source, artifact) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const code = withoutNestedComments(lines);
  const pkg = /^package\s+([\w.]+)/m.exec(source)?.[1] ?? '';
  const found = [];
  let kdoc;
  let annotations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('/**')) {
      let block = line;
      while (!block.includes('*/') && i + 1 < lines.length) block += `\n${lines[++i]}`;
      kdoc = block;
      continue;
    }
    if (line.startsWith('@') && !line.startsWith('@file:')) {
      annotations.push(line);
      continue;
    }
    if (!/^[a-z]/.test(line) || /^(package|import)\s/.test(line)) {
      if (line.trim() === '' || /^[}\]]/.test(line) || /^(package|import)\s/.test(line)) [kdoc, annotations] = [undefined, []];
      continue;
    }
    const match = declaration.exec(line);
    const internal = annotations.some(annotation => annotation.startsWith('@VersatiaInternalApi'));
    const doc = kdoc;
    [kdoc, annotations] = [undefined, []];
    if (!match || hidden.test(line) || internal) continue;
    const [, mods, keyword] = match;
    const text = joined(code, i).replace(/@\w+(?:\([^()]*\))?\s+(?=(?:val|var|vararg)?\s*\w+\s*:)/g, '');
    const rest = text.slice(text.indexOf(keyword, mods.length) + keyword.length).trim();
    const symbol = {name: '', package: pkg, kind: '', artifact};
    if (['class', 'interface', 'object', 'typealias'].includes(keyword)) {
      symbol.name = /^\w+/.exec(rest)?.[0] ?? '';
      const after = pastTypeParameters(rest, symbol.name.length);
      if (mods.includes('annotation')) {
        symbol.kind = 'annotation';
        const parameters = rest[after] === '(' ? rest.slice(after, closing(rest, after)) : '';
        symbol.signature = `@${symbol.name}${parameters.replace(/\b(?:val|var) /g, '')}`;
      } else {
        symbol.kind = mods.includes('enum') ? 'enum' : mods.includes('fun') ? 'fun interface' : keyword;
        let tail = rest.slice(after).trim();
        if (/^(?:(?:private|internal|protected) )?(?:constructor\s*)?\(/.test(tail)) tail = tail.slice(closing(tail, tail.indexOf('('))).trim();
        const supertypes = /^:\s*([^{=]+)/.exec(tail)?.[1]?.trim();
        symbol.signature = `${mods.replace('fun ', '')}${keyword} ${rest.slice(0, after)}${supertypes ? ` : ${supertypes}` : ''}`.trim();
        if (symbol.kind === 'enum') symbol.entries = enumEntries(lines, i);
      }
    } else {
      const head = pastTypeParameters(rest, 0);
      const end = keyword === 'fun' ? rest.indexOf('(', head) : rest.slice(head).search(/[:=]|\sget\(|\sby\s|$/) + head;
      const target = rest.slice(head, end).trim();
      const dot = target.lastIndexOf('.');
      symbol.name = target.slice(dot + 1).replace(/`/g, '');
      if (dot > 0) symbol.receiver = target.slice(0, dot).trim();
      symbol.kind = keyword === 'fun' ? 'function' : 'property';
      let signature;
      if (keyword === 'fun') {
        const parameters = closing(rest, end);
        const returns = /^\s*:\s*(.+?)(?:\s=\s|\s=$|\s\{|\swhere\s|$)/.exec(rest.slice(parameters))?.[1];
        signature = `${rest.slice(0, parameters)}${returns ? `: ${returns.trim()}` : ''}`;
      } else {
        const type = /^\s*:\s*(.+?)(?:\s=\s|\sget\(|\sby\s|$)/.exec(rest.slice(end))?.[1];
        signature = `${target}${type ? `: ${type.trim()}` : ''}`;
      }
      symbol.signature = `${mods}${keyword} ${signature}`.replace(/\s+/g, ' ').trim();
      if (symbol.receiver === 'VersatiaEngine.Companion') {
        const calls = bukkitCalls(bodyOf(code, i));
        if (calls.length) symbol.bukkit = calls;
      }
    }
    if (symbol.signature && symbol.signature.length > 400) delete symbol.signature;
    const first = doc && summary(doc);
    if (first) symbol.summary = first;
    if (symbol.name) found.push(symbol);
  }
  return found;
}

/** The lines of a top-level declaration: up to the next blank line or the line closing its body. */
function bodyOf(lines, i) {
  const body = [lines[i]];
  for (let j = i + 1; j < lines.length && lines[j].trim() !== '' && (/^\s/.test(lines[j]) || lines[j] === '}'); j++) {
    body.push(lines[j]);
    if (lines[j] === '}') break;
  }
  return body.join('\n');
}

/** The lines with every comment that does not start a line of its own at the top level blanked, so KDoc inside a declaration never reads as code. */
function withoutNestedComments(lines) {
  const code = [...lines];
  for (let i = 0; i < code.length; i++) {
    if (!/^\s/.test(code[i])) continue;
    code[i] = code[i].replace(/\/\*.*?\*\//g, '');
    if (!code[i].includes('/*')) continue;
    code[i] = code[i].slice(0, code[i].indexOf('/*'));
    while (++i < code.length && !code[i].includes('*/')) code[i] = '';
    if (i < code.length) code[i] = code[i].slice(code[i].indexOf('*/') + 2);
  }
  return code;
}

/** The entries of an enum class declared at line `i` with their KDoc summaries, leaving out those marked `@VersatiaInternalApi`. */
function enumEntries(lines, i) {
  const rest = lines.slice(i).join('\n');
  const body = entryList(rest.slice(rest.indexOf('{') + 1));
  const entries = [];
  for (const [, kdoc, internal, name] of body.matchAll(/(\/\*\*[\s\S]*?\*\/\s*)?(@VersatiaInternalApi\s+)?\b([A-Z][A-Z0-9_]*)\b(?:\([^()]*(?:\([^()]*\)[^()]*)*\))?\s*,?/g)) {
    if (internal) continue;
    const note = kdoc && summary(kdoc.trim());
    entries.push(note ? {name, summary: note} : {name});
  }
  return entries;
}

/** The text of an enum body up to the `;` or `}` ending its entries, skipping comments. */
function entryList(body) {
  for (let k = 0; k < body.length; k++) {
    const end = body.startsWith('/*', k) ? body.indexOf('*/', k) + 1 : body.startsWith('//', k) ? body.indexOf('\n', k) : k;
    if (end < k) break;
    if (end > k) k = end;
    else if (body[k] === ';' || body[k] === '}') return body.slice(0, k);
  }
  return body;
}

/** One entry per name, package and receiver: overloads keep the first summary and signature and add their Bukkit calls. */
function merged(symbols) {
  const byKey = new Map();
  for (const symbol of symbols) {
    const key = `${symbol.package}|${symbol.receiver ?? ''}|${symbol.name}|${symbol.kind}`;
    const known = byKey.get(key);
    if (!known) {
      byKey.set(key, symbol);
      continue;
    }
    known.summary ??= symbol.summary;
    known.overloads = (known.overloads ?? 1) + 1;
    if (symbol.bukkit) known.bukkit = [...new Set([...(known.bukkit ?? []), ...symbol.bukkit])];
  }
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...byKey.values()].sort(
    (a, b) => order(a.artifact, b.artifact) || order(a.package, b.package) || order(a.name, b.name) || order(a.receiver ?? '', b.receiver ?? ''),
  );
}

const symbols = merged(
  artifacts.flatMap(artifact => {
    const jar = path.join(repository, 'dev', 'versatia', artifact, version, `${artifact}-${version}-sources.jar`);
    try {
      // A plugin's sources JAR also holds its generated descriptor, which is no API
      return [...kotlinFiles(jar)]
        .filter(([, source]) => !source.startsWith('// Generated by VersatiaAPI'))
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .flatMap(([, source]) => declarations(source, artifact));
    } catch (error) {
      throw new Error(`Cannot read ${jar} (${error.message}); run ./gradlew publishToMavenLocal in ${artifact} first`);
    }
  }),
);
const json = `${JSON.stringify({version, artifacts, symbols}, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let committed = '';
  try {
    committed = readFileSync(output, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    // a missing index is stale too
  }
  if (committed !== json) {
    console.error(`${path.relative(process.cwd(), output)} does not match the published sources; run npm run symbols and commit it`);
    process.exit(1);
  }
  console.log(`Symbol index up to date (${symbols.length} symbols)`);
} else {
  writeFileSync(output, json);
  console.log(`Wrote ${symbols.length} symbols to ${path.relative(process.cwd(), output)}`);
}
