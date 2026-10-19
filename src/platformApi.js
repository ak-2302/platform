const KEY = 'resonance-proposals';
// Keep local development convenient while ensuring a deployed build never
// points a visitor's browser at localhost. Set VITE_API_BASE only when the
// API is deployed on a separate origin; otherwise the same-origin worker is
// used in production.
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? 'https://resonance-api.meiteya.workers.dev' : 'http://127.0.0.1:8787');
const seed = [{id:'#42',title:'Bring the bassline forward in verse 2',author:'Mika Ito',status:'Ready for review',branch:'proposal/42-bassline',baseSha:'25af248f',headSha:'d4c91a'}];
export const songManifest = {id:'night-transit',projectPath:'project/main.od',baseSha:'25af248f',engineCommit:'25af248f6df66b321f921b54930f94fe5c09898f',rendererVersion:'renderer-local-0.1.0'};
export function listProposals(){try{return JSON.parse(localStorage.getItem(KEY))||seed}catch{return seed}}
export async function listProposalsFromApi(){const r=await fetch(`${API_BASE}/api/songs/night-transit/proposals`);if(!r.ok)throw new Error('proposal list failed');return r.json()}
export async function listFiles(){const r=await fetch(`${API_BASE}/api/songs/night-transit/files`);if(!r.ok)throw new Error('file list failed');return r.json()}
export async function listCommits(){const r=await fetch(`${API_BASE}/api/songs/night-transit/commits`);if(!r.ok)throw new Error('commit list failed');return r.json()}
export async function getConfig(){const r=await fetch(`${API_BASE}/api/config`);if(!r.ok)throw new Error('config lookup failed');return r.json()}
export function openProject(){window.postMessage({type:'resonance:open-project',songId:songManifest.id,path:songManifest.projectPath,engineCommit:songManifest.engineCommit},window.location.origin);return {connected:true}}
export function requestProjectSnapshot(){window.postMessage({type:'resonance:request-project-snapshot',songId:songManifest.id},window.location.origin);return {snapshotId:`local-${Date.now()}`}}
export function createProposal({title,description}){const all=listProposals();const n=43+all.length;const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'change';const p={id:`#${n}`,title,description,author:'you',status:'Draft',branch:`proposal/${n}-${slug}`,baseSha:songManifest.baseSha,headSha:`local-${Date.now().toString(16)}`};localStorage.setItem(KEY,JSON.stringify([p,...all]));return p}
export async function createProposalFromApi(input){const r=await fetch(`${API_BASE}/api/songs/night-transit/proposals`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!r.ok)throw new Error('proposal creation failed');return r.json()}
export async function createPullRequest(proposalId){const id=String(proposalId).replace('#','');const r=await fetch(`${API_BASE}/api/songs/night-transit/proposals/%23${id}/pull-request`,{method:'POST'});if(!r.ok)throw new Error('pull request creation failed');return r.json()}
export async function requestRender(proposalId){const id=String(proposalId).replace('#','');const r=await fetch(`${API_BASE}/api/songs/night-transit/proposals/${id}/render`,{method:'POST'});if(!r.ok)throw new Error('render request failed');return r.json()}
export async function getRender(jobId){const r=await fetch(`${API_BASE}/api/renders/${encodeURIComponent(jobId)}`);if(!r.ok)throw new Error('render status failed');return r.json()}
let previewContext; let previewOscillator;
export function playPreview(mode='base'){previewContext ||= new AudioContext(); previewOscillator?.stop(); previewOscillator=previewContext.createOscillator(); const gain=previewContext.createGain(); previewOscillator.type=mode==='proposal'?'triangle':'sine'; previewOscillator.frequency.value=mode==='proposal'?220:196; gain.gain.setValueAtTime(0.0001,previewContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.08,previewContext.currentTime+0.05); gain.gain.exponentialRampToValueAtTime(0.0001,previewContext.currentTime+1.2); previewOscillator.connect(gain).connect(previewContext.destination); previewOscillator.start(); previewOscillator.stop(previewContext.currentTime+1.25)}
