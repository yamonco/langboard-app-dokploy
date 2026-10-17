const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const rows = value => { if (!Array.isArray(value) || value.length > 250) throw new Error('Invalid or oversized Dokploy inventory'); return value; };

/** Safe diagnostics: never include URLs, response bodies or credentials. */
export class DokployReadError extends Error {
  constructor(status) {
    const reason = status === 401 ? 'authentication_required' : status === 403 ? 'access_denied' :
      status === 429 ? 'rate_limited' : status >= 500 ? 'provider_unavailable' : 'request_rejected';
    super(`Dokploy read failed: ${reason} (HTTP ${status})`);
    this.name = 'DokployReadError';
    this.code = reason;
    this.status = status;
  }
}

/** Read-only official API. Server configuration supplies the origin and key. */
export function dokployApi({ origin, token }, request = fetch) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.origin !== origin || typeof token !== 'string' || !/^[A-Za-z0-9_.-]{1,4096}$/.test(token)) throw new Error('Exact HTTPS origin and API key required');
  async function get(endpoint, params = {}) {
    const response = await request(`${origin}/api/${endpoint}?${new URLSearchParams(params)}`, {
      method: 'GET', headers: { 'x-api-key': token, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new DokployReadError(response.status);
    }
    // Bound decoded bytes, not only row counts or Content-Length.
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 1048576) throw new Error('Dokploy response exceeds byte limit');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  return {
    async readDeployments({ projectId, environmentId, resourceType, externalId }) {
      if (![projectId, environmentId, externalId].every(id) || !['application', 'compose'].includes(resourceType)) throw new Error('Invalid deployment scope');
      const projects = rows(await get('project.all'));
      if (!projects.some(row => row?.projectId === projectId)) throw new Error('Project unavailable');
      const environments = rows(await get('environment.byProjectId', { projectId }));
      if (!environments.some(row => row?.environmentId === environmentId)) throw new Error('Environment unavailable');
      const environment = await get('environment.one', { environmentId });
      if (environment?.environmentId !== environmentId || environment.projectId !== projectId ||
          !rows(environment[resourceType === 'application' ? 'applications' : 'compose']).some(row => row?.[resourceType + 'Id'] === externalId)) throw new Error('Resource hierarchy changed');
      return rows(await get(resourceType === 'application' ? 'deployment.all' : 'deployment.allByCompose', { [resourceType + 'Id']: externalId }));
    },
  };
}
