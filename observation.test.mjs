import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runObservation } from './observation.mjs';
const config = { hostOrigin: 'https://host.example', providerOrigin: 'https://deploy.example',
 scope: { boardUID: 'board000001', resourceUID: 'resour00001', appRevision: 'a'.repeat(64), bindingRevision: 'b'.repeat(64),
 projectId: 'project', environmentId: 'env', resourceType: 'application', externalId: 'app' } };
const credentials = { hostToken: 'lbac_' + 'a'.repeat(43), providerToken: 'private-provider-test' };
test('partial batch failure saves all events and explicit recovery retains identities', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'dokploy-observation-'));
 try {
  const path = join(directory, 'batch.json'); let reads = 0; const bodies = [];
  const request = async (url, options) => {
   if (url.startsWith(config.providerOrigin)) {
    reads++; const endpoint = new URL(url).pathname;
    const data = endpoint.endsWith('project.all') ? [{ projectId: 'project' }] :
     endpoint.endsWith('environment.byProjectId') ? [{ environmentId: 'env' }] :
     endpoint.endsWith('environment.one') ? { environmentId: 'env', projectId: 'project', applications: [{ applicationId: 'app' }] } :
     ['one','two','three'].map((deploymentId, i) => ({ deploymentId, applicationId: 'app', status: 'done', finishedAt: `2026-10-11T00:00:0${i}Z`, logs: 'private' }));
    return new Response(JSON.stringify(data));
   }
   bodies.push(options.body); assert.equal((await stat(path)).mode & 0o777, 0o600);
   if (bodies.length === 2) throw new Error('Unknown receipt');
   return new Response(JSON.stringify({ signal_uid: 'signal00001', duplicate: true }));
  };
  const args = { path, config, credentials };
  await assert.rejects(runObservation(args, request), /Unknown receipt/);
  const saved = await readFile(path, 'utf8');
  assert.equal(JSON.parse(saved).envelopes.length, 3);
  assert.ok(!saved.includes('private') && !saved.includes(credentials.hostToken));
  const result = await runObservation({ ...args, resend: true }, request);
  assert.equal(result.receipts.length, 3); assert.equal(reads, 4);
  assert.deepEqual(bodies[0], bodies[2]); assert.deepEqual(bodies[1], bodies[3]);
  await assert.rejects(runObservation({ ...args, config: { ...config, hostOrigin: 'https://other.example' }, resend: true }, request), /destination changed/);
  assert.equal(bodies.length, 5); assert.equal(await readFile(path, 'utf8'), saved);
 } finally { await rm(directory, { recursive: true, force: true }); }
});
