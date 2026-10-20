import { useEffect, useRef, useState } from "react";
import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";
import { API_BASE } from "../platformApi";

const REPOSITORY = "ak-2302/song-demo";
const GRAPH_COLUMNS = "commit";
const GRAPH_STYLE =
  ".history{grid-template-rows:0 minmax(0,1fr)!important}.header{display:none!important}.row{border-bottom:0!important}.row:hover,.row.preview,.row.context-active,.row.selected{background:transparent!important}.subject .message,.commit-body,.oid{display:none!important}.col-description{display:none!important}.col-commit{font-size:0!important}.subject{padding:0 10px!important}.refs{font-size:10px!important}";

async function loadHistory({ signal, refs } = {}) {
  const response = await fetch(
    new URL(`${import.meta.env.BASE_URL}git-graph.json`, window.location.href),
    { signal },
  );
  if (!response.ok) throw new Error("Git history could not be loaded");

  const page = await response.json();
  if (!refs?.length) return page;

  const commits = new Map(page.commits.map((commit) => [commit.oid, commit]));
  const visible = new Set();
  const stack = page.refs
    .filter((ref) => refs.includes(ref.name))
    .map((ref) => ref.target);

  while (stack.length) {
    const oid = stack.pop();
    if (visible.has(oid)) continue;
    visible.add(oid);
    stack.push(...(commits.get(oid)?.parents || []));
  }

  return {
    ...page,
    commits: page.commits.filter((commit) => visible.has(commit.oid)),
  };
}

function createProvider() {
  const github = new GitHubGitGraphProvider({ repository: REPOSITORY });
  return {
    getCapabilities: () => github.getCapabilities(),
    getHistory: loadHistory,
    getCommitDetails: (...args) => github.getCommitDetails(...args),
    compare: (...args) => github.compare(...args),
    getFileDiff: (...args) => github.getFileDiff(...args),
  };
}

function useGraphSelection(graphRef) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return undefined;

    const onSelect = (event) => setSelected(event.detail.commit);
    graph.addEventListener("gitgraph-commit-select", onSelect);
    return () => graph.removeEventListener("gitgraph-commit-select", onSelect);
  }, [graphRef]);

  return selected;
}

function useGraphProvider(graphRef) {
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return undefined;

    graph.provider = createProvider();
    const style = document.createElement("style");
    style.textContent = GRAPH_STYLE;
    graph.shadowRoot?.append(style);
    return () => style.remove();
  }, [graphRef]);
}

export function CommitGraph({ expanded = false }) {
  const graphRef = useRef(null);
  const selected = useGraphSelection(graphRef);
  useGraphProvider(graphRef);

  return (
    <div className={`web-git-graph-panel${expanded ? " expanded" : ""}`}>
      <web-git-graph
        ref={graphRef}
        theme="light"
        density="comfortable"
        columns={GRAPH_COLUMNS}
        date-format="relative"
        avatars={false}
      />
      {selected && (
        <div className="web-graph-audio">
          <div>
            <span>Selected commit</span>
            <b>{selected.oid?.slice(0, 8)}</b>
          </div>
          <audio
            controls
            preload="none"
            src={`${API_BASE}/audio/night-transit-base.wav`}
            aria-label="Selected commit render"
          />
        </div>
      )}
    </div>
  );
}
