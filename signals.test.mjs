import test from 'node:test';
import assert from 'node:assert/strict';
import { dokployApi, DokployReadError } from './provider-api.mjs';
import { normalizeDeployment, refreshDeployments } from './signals.mjs';
import { declaration, configuration } from './server.mjs';

const scope = { projectId:'p1', environmentId:'e1', resourceType:'application', externalId:'a1', boardUID:'12345678901', resourceUID:'12345678902', appRevision:'a'.repeat(64), bindingRevision:'b'.repeat(64) };
const row = { applicationId:'a1', deploymentId:'d1', status:'done', finishedAt:'2026-10-11T01:00:00Z', logPath:'/private/log', title:'private' };
const host = { origin:'https://host.example', token:'lbac_' + 'x'.repeat(43) };
test('official read verifies hierarchy and never sends provider writes', async () => {
  const calls = [], bodies = [[{projectId:'p1'}], [{environmentId:'e1'}], {environmentId:'e1', projectId:'p1', applications:[{applicationId:'a1'}]}, [row]];
  const api = dokployApi({origin:'https://provider.example', token:'secret'}, async (url, init) => { calls.push([url, init]); return Response.json(bodies.shift()); });
  assert.deepEqual(await api.readDeployments(scope), [row]);
  assert.ok(calls.every(([,init]) => init.method === 'GET' && init.redirect === 'error' && init.headers['x-api-key'] === 'secret'));
  assert.match(calls.at(-1)[0], /deployment.all\?applicationId=a1$/);
});
test('foreign hierarchy, response size and invalid scope stop before deployment reads', async () => {
  let calls = 0;
  const api = dokployApi({origin:'https://provider.example', token:'secret'}, async () => { calls++; return Response.json([]); });
  await assert.rejects(api.readDeployments(scope), /Project unavailable/); assert.equal(calls, 1);
  await assert.rejects(api.readDeployments({...scope, resourceType:'server'}), /scope/); assert.equal(calls, 1);
  const large = dokployApi({origin:'https://provider.example', token:'secret'}, async () => new Response('x'.repeat(1048577)));
  await assert.rejects(large.readDeployments(scope), /byte limit/);
});
test('normalization emits only finite metadata and stable identity', () => {
  const result = normalizeDeployment(row, scope);
  assert.equal(result.event_type, 'deployment.succeeded'); assert.equal(result.outcome, 'success');
  assert.equal(result.event_id, normalizeDeployment({...row, title:'changed'}, scope).event_id);
  assert.equal(result.commit_sha, ''); assert.equal(result.logPath, undefined);
  assert.throws(() => normalizeDeployment({...row, applicationId:'other'}, scope));
  assert.throws(() => normalizeDeployment({...row, finishedAt:'2026-10-11T01:00:00'}, scope));
  assert.throws(() => normalizeDeployment({...row, status:'future'}, scope));
});
test('persist before publish; unknown response never repeats read or send', async () => {
  let reads = 0, sends = 0; const saved = [];
  const api = {readDeployments: async () => { reads++; return [row]; }};
  await assert.rejects(refreshDeployments({api, scope, host, saveEnvelopes:async envelopes => saved.push(...envelopes)}, async () => { sends++; assert.equal(saved.length, 1); throw new Error('lost response'); }), /lost response/);
  assert.equal(reads, 1); assert.equal(sends, 1);
  await assert.rejects(refreshDeployments({api, scope, host, saveEnvelopes:async () => {throw new Error('disk failure')}}, async () => {sends++;}), /disk failure/);
  assert.equal(sends, 1);
});
test('publication is independent of workflow cards and default off', () => {
  const config = configuration();
  assert.equal(declaration(config).signal_policy, undefined);
  const manifest = declaration(config, {publishSignals:true});
  assert.ok(manifest.capabilities.includes('signals.publish'));
  assert.equal(manifest.card_lifecycle, undefined);
  assert.equal(manifest.capabilities.includes('cards.create'), false);
  assert.equal(manifest.capabilities.includes('execution.run'), false);
});

test('native nullable deployment times do not suppress valid events or invent occurrence times', async () => {
  const rows = [row, {...row, deploymentId:'cancelled', status:'cancelled', finishedAt:null},
    {...row, deploymentId:'legacy', finishedAt:null}];
  let saved;
  const result = await refreshDeployments({api:{readDeployments:async () => rows}, scope, host,
    saveEnvelopes:async values => {saved=values;}}, async () => Response.json({signal_uid:'signal00001',duplicate:false}));
  assert.equal(saved.length, 1); assert.equal(saved[0].external_id, 'd1');
  assert.deepEqual(result.unreported, [
    {deployment_id:'cancelled',reason:'provider_timestamp_missing'},
    {deployment_id:'legacy',reason:'provider_timestamp_missing'}]);
  assert.equal(result.receipts.length, 1);
  for (const bad of [{...rows[1],applicationId:'foreign'}, {...row,finishedAt:'malformed'}]) {
    await assert.rejects(refreshDeployments({api:{readDeployments:async () => [bad]}, scope, host,
      saveEnvelopes:async () => assert.fail('invalid evidence must not be saved')}, async () => assert.fail('must not publish')));
  }
});

test('compose endpoint and bounded signed batch preserve deployment time without logs', async () => {
  const composeScope = {...scope, resourceType:'compose', externalId:'c1'};
  const bodies = [[{projectId:'p1'}], [{environmentId:'e1'}], {environmentId:'e1', projectId:'p1', compose:[{composeId:'c1'}]}, []];
  let endpoint;
  const api = dokployApi({origin:'https://provider.example', token:'secret'}, async url => {endpoint = url; return Response.json(bodies.shift());});
  assert.deepEqual(await api.readDeployments(composeScope), []);
  assert.match(endpoint, /deployment.allByCompose\?composeId=c1$/);
  const rows = Array.from({length:26}, (_, index) => ({...row, deploymentId:'d'+index}));
  let saved, sends = 0;
  const result = await refreshDeployments({api:{readDeployments:async () => rows}, scope, host, saveEnvelopes:async values => {saved = values;}}, async (url, init) => {
    sends++; assert.equal(saved.length, 25);
    assert.equal(url, 'https://host.example/apps/v1/boards/12345678901/signals');
    assert.ok(init.headers['x-langboard-webhook-signature'].startsWith('v1='));
    const body = JSON.parse(init.body); assert.equal(body.occurred_at, '2026-10-11T01:00:00.000Z');
    assert.equal(body.logPath, undefined); return Response.json({signal_uid:'signal00001',duplicate:false});
  });
  assert.equal(sends, 25); assert.equal(result.truncated, true);
  for (const [status, expected] of [['done','success'],['error','failure'],['cancelled','cancelled']]) assert.equal(normalizeDeployment({...row, status}, scope).outcome, expected);
  assert.equal(normalizeDeployment({...row, status:'running', createdAt:row.finishedAt}, scope).outcome, 'queued');
  assert.equal(normalizeDeployment({...row, status:'running', startedAt:row.finishedAt}, scope).outcome, 'running');
});

test('ambiguous batch receipt stops later publications and preserves the full saved batch', async () => {
  const rows = [row, {...row, deploymentId:'d2'}, {...row, deploymentId:'d3'}];
  let reads = 0, sends = 0, saved;
  await assert.rejects(refreshDeployments({api:{readDeployments:async () => {reads++;return rows;}},scope,host,
    saveEnvelopes:async envelopes => {saved=envelopes;}},async () => {
      sends++;return Response.json(sends===1?{signal_uid:'signal00001',duplicate:false}:{});
    }),/outcome unknown: invalid receipt/);
  assert.equal(reads,1);assert.equal(sends,2);assert.equal(saved.length,3);
  assert.equal(new Set(saved.map(value=>value.event_id)).size,3);
});


test('provider failures report safe actionable status and never persist or publish', async () => {
  for (const [status, code] of [[401, 'authentication_required'], [403, 'access_denied'], [429, 'rate_limited'], [503, 'provider_unavailable'], [404, 'request_rejected']]) {
    let reads = 0, writes = 0, cancelled = false;
    const api = dokployApi({origin:'https://provider.example', token:'secret'}, async () => {
      reads++;
      return new Response(new ReadableStream({cancel() {cancelled = true;}}), {status});
    });
    await assert.rejects(refreshDeployments({api, scope, host, saveEnvelopes:async () => {writes++;}}, async () => {writes++;}), error => {
      assert.ok(error instanceof DokployReadError);
      assert.equal(error.code, code);
      assert.equal(error.status, status);
      assert.ok(!error.message.includes('secret') && !error.message.includes('provider.example'));
      return true;
    });
    assert.equal(reads, 1); assert.equal(writes, 0); assert.equal(cancelled, true);
  }
});
