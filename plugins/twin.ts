/**
 * Where plugins/llms.ts writes the Markdown twin of the page at `permalink`: its address without a trailing slash,
 * plus `.md`. Shared with the page's Copy as Markdown button (src/theme/DocItem/Content).
 */
export const twinPath = (permalink: string) => `${permalink.replace(/\/+$/, '') || '/index'}.md`;
