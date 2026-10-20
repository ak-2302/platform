import { readFileSync, writeFileSync } from 'node:fs';

// web-git-graph allocates lane zero to the first row. Reserve it for main's
// head instead, so an unmerged branch can appear above main without stealing
// main's leftmost lane or breaking the actual parent connections.
for (const file of ['node_modules/@web-git-graph/web/dist/index.js', 'node_modules/@web-git-graph/web/dist/register.js']) {
  let source = readFileSync(file, 'utf8');
  const initial = 'const active = (options.previous?.lanes ?? []).map((lane) => ({ ...lane }));\n  let nextColour = options.previous?.nextColour ?? 0;';
  const reserved = 'const active = (options.previous?.lanes ?? (options.mainHead ? [{ lane: 0, target: options.mainHead, colour: 0, fromRow: 0 }] : [])).map((lane) => ({ ...lane }));\n  let nextColour = options.previous?.nextColour ?? (options.mainHead ? 1 : 0);';
  const call = 'this.#layout = layoutGitGraph(this.#page.commits);';
  const callWithMain = 'this.#layout = layoutGitGraph(this.#page.commits, { mainHead: this.#page.head });';
  if (!source.includes(reserved)) {
    if (!source.includes(initial)) throw new Error(`Unsupported web-git-graph layout in ${file}`);
    source = source.replace(initial, reserved);
  }
  if (!source.includes(callWithMain)) {
    if (!source.includes(call)) throw new Error(`Unsupported web-git-graph call in ${file}`);
    source = source.replace(call, callWithMain);
  }
  writeFileSync(file, source);
}
