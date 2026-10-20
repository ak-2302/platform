import { createHmac, timingSafeEqual } from "node:crypto";
import { App } from "@octokit/app";

export function verifyWebhookSignature(
  payload,
  signature,
  secret = process.env.GITHUB_WEBHOOK_SECRET,
) {
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function githubConfigured() {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_PRIVATE_KEY &&
      process.env.GITHUB_INSTALLATION_ID,
  );
}

export async function githubRequest(path, options = {}) {
  if (!githubConfigured()) throw new Error("GitHub App credentials are not configured");
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { accept: "application/vnd.github+json", ...options.headers },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json();
}

export async function createProposalPullRequest({
  proposal,
  repository = "music-collab/song-demo",
}) {
  if (!githubConfigured())
    return {
      mode: "local",
      number: Number(proposal.id.slice(1)),
      url: `http://localhost:5173/proposals/${proposal.id.slice(1)}`,
      branch: proposal.branch,
      baseSha: proposal.baseSha,
      headSha: proposal.headSha,
    };
  const [owner, repo] = repository.split("/");
  const app = new App({
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
  const octokit = await app.getInstallationOctokit(
    Number(process.env.GITHUB_INSTALLATION_ID),
  );
  const base = await octokit.rest.git.getRef({ owner, repo, ref: `heads/main` });
  if (base.data.object.sha !== proposal.baseSha)
    throw new Error("GitHub main changed after proposal snapshot");
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${proposal.branch}`,
    sha: proposal.baseSha,
  });
  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `${proposal.id} ${proposal.title}`,
    head: proposal.branch,
    base: "main",
    body: proposal.description || "Created by re:sonance.",
  });
  return {
    mode: "github",
    number: pr.data.number,
    url: pr.data.html_url,
    branch: proposal.branch,
    baseSha: proposal.baseSha,
    headSha: proposal.headSha,
  };
}
