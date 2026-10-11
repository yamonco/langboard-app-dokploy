import { createHash } from 'node:crypto';
import { signalPublisher } from '@langboard/app-server';

export const signalPolicy = {
  version: 1, resource_types: ['application', 'compose'],
  event_types: ['deployment.queued', 'deployment.started', 'deployment.succeeded', 'deployment.failed', 'deployment.cancelled'],
  outcome_states: { queued: 'queued', running: 'running', success: 'passed', failure: 'failed', cancelled: 'cancelled' },
  commit_mode: 'empty', time_basis: 'provider_occurrence',
};

export function normalizeDeployment(row, scope) {
  if (!['application', 'compose'].includes(scope.resourceType) || row?.[scope.resourceType + 'Id'] !== scope.externalId ||
      typeof row.deploymentId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(row.deploymentId)) throw new Error('Invalid deployment identity');
  let event, outcome, timestamp;
  if (row.status === 'running') {
    event = row.startedAt ? 'started' : 'queued'; outcome = row.startedAt ? 'running' : 'queued'; timestamp = row.startedAt || row.createdAt;
  } else {
    const terminal = { done: ['succeeded', 'success'], error: ['failed', 'failure'], cancelled: ['cancelled', 'cancelled'] };
    if (!Object.hasOwn(terminal, row.status)) throw new Error('Unsupported deployment status');
    [event, outcome] = terminal[row.status]; timestamp = row.finishedAt;
  }
  if (typeof timestamp !== 'string' || timestamp.length > 40 || !/(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error('Explicit deployment timestamp required');
  const evidence = { event_type: 'deployment.' + event, occurred_at: new Date(timestamp).toISOString(), external_id: row.deploymentId, outcome, commit_sha: '' };
  return { ...evidence, event_id: createHash('sha256').update(JSON.stringify({ type: scope.resourceType, resource: scope.externalId, ...evidence })).digest('hex') };
}

/** Persist the bounded batch first. Recovery reuses saved envelopes, never re-reads. */
export async function refreshDeployments({ api, scope, host, saveEnvelopes }, request = fetch) {
  const rows = await api.readDeployments(scope);
  if (!Array.isArray(rows) || rows.length > 250) throw new Error('Invalid or oversized deployment inventory');
  const normalized = rows.map(row => normalizeDeployment(row, scope));
  normalized.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.event_id.localeCompare(a.event_id));
  const envelopes = normalized.slice(0, 25).map(evidence => ({ version: 1, board_uid: scope.boardUID,
    resource_uid: scope.resourceUID, app_revision: scope.appRevision, binding_revision: scope.bindingRevision, ...evidence }));
  await saveEnvelopes(envelopes);
  const publish = signalPublisher(host, request), receipts = [];
  for (const envelope of envelopes) receipts.push(await publish(envelope));
  return { receipts, truncated: normalized.length > 25, limit: 25 };
}
