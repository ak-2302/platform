import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const songRepo = resolve(process.env.SONG_REPO_PATH || '../song-demo');
const git = (...args) => execFileSync('git', args, { cwd: songRepo, encoding: 'utf8' }).trim();
const rawRefs = git('for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/remotes/origin');
const branches = rawRefs.split('\n').filter((line) => line.startsWith('origin/') && !line.startsWith('origin/HEAD '))
  .map((line) => { const [remoteName, target] = line.split(' '); return { name: `refs/heads/${remoteName.slice(7)}`, target, kind: 'head' }; })
  .sort((a, b) => a.name === 'refs/heads/main' ? -1 : b.name === 'refs/heads/main' ? 1 : a.name.localeCompare(b.name));
if (!branches.length || branches[0].name !== 'refs/heads/main') throw new Error('song-demo origin/main is required');

const fields = git('log', '--format=%H%x1f%P%x1f%an%x1f%aI%x1f%cI%x1f%s%x1e', ...branches.map((ref) => ref.target));
const entries = fields.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
  const [oid, parents, author, authoredAt, committedAt, message] = record.split('\x1f');
  return { oid, parents: parents ? parents.split(' ') : [], message, kind: 'commit', author: { name: author }, authoredAt, committedAt,
    url: `https://github.com/ak-2302/song-demo/commit/${oid}` };
});
const bySha = new Map(entries.map((commit) => [commit.oid, commit]));
const head = branches[0].target;
const children = new Map(entries.map((commit) => [commit.oid, 0]));
for (const commit of entries) for (const parent of commit.parents) if (children.has(parent)) children.set(parent, children.get(parent) + 1);
const ready = entries.filter((commit) => children.get(commit.oid) === 0);
const commits = [];
const emitted = new Set();
while (ready.length) {
  ready.sort((a, b) => Date.parse(b.committedAt) - Date.parse(a.committedAt));
  const commit = ready.shift();
  if (emitted.has(commit.oid)) continue;
  emitted.add(commit.oid);
  commits.push(commit);
  for (const parent of commit.parents) if (children.has(parent)) {
    children.set(parent, children.get(parent) - 1);
    if (children.get(parent) === 0) ready.push(bySha.get(parent));
  }
}
if (commits.length !== entries.length) throw new Error(`Incomplete song-demo history: ${commits.length}/${entries.length}`);
const output = resolve('public/git-graph.json');
mkdirSync(resolve('public'), { recursive: true });
writeFileSync(output, JSON.stringify({ commits, refs: [...branches, ...originRefs], head, hasMore: false, repositoryId: 'ak-2302/song-demo', repositoryName: 'ak-2302/song-demo' }));
console.log(`Generated ${commits.length} commits from ${branches.length} branches: ${output}`);
