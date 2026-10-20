import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 18878;
const base = `http://127.0.0.1:${port}`;
let child;

before(async () => {
  child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("API server did not start")),
      5000,
    );
    child.stdout.on("data", (data) => {
      if (String(data).includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on("error", reject);
  });
});

after(() => child?.kill());

test("API supports proposal and render flow", async () => {
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.projectReady, true);
  assert.equal(healthBody.manifestReady, true);
  const files = await (await fetch(`${base}/api/songs/night-transit/files`)).json();
  assert.equal(files.length, 4);
  const proposal = await (
    await fetch(`${base}/api/songs/night-transit/proposals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Integration test texture" }),
    })
  ).json();
  assert.match(proposal.branch, /^proposal\//);
  const pullRequest = await (
    await fetch(
      `${base}/api/songs/night-transit/proposals/%23${proposal.id.slice(1)}/pull-request`,
      { method: "POST" },
    )
  ).json();
  assert.equal(pullRequest.mode, "local");
  assert.equal(pullRequest.baseSha, proposal.baseSha);
  const job = await (
    await fetch(
      `${base}/api/songs/night-transit/proposals/${proposal.id.slice(1)}/render`,
      { method: "POST" },
    )
  ).json();
  assert.equal(job.status, "queued");
  await new Promise((resolve) => setTimeout(resolve, 350));
  const ready = await (await fetch(`${base}/api/renders/${job.jobId}`)).json();
  assert.equal(ready.status, "ready");
});
