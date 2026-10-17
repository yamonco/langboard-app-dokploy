# Dokploy panel

## Workflow deployment archive policy

`archive.mjs` retains external deployment and log history and returns an explicit
no-external-action receipt. An archived deployment card must never stop, delete,
redeploy or roll back a service. Deployment actions require separate explicit
opt-in and current authority. Signal inbox ingestion never enables workflow
card actions. Host lifecycle event wiring and runtime acceptance remain pending.

Standalone third party Langboard panel service. Node 22.13 or newer; no core checkout, React installation, copied theme, or browser provider credentials. The vendored panel SDK 0.2.3 provides the browser bridge; server SDK 0.1.2 signs explicit signal publications and is never exposed as a browser asset.

```sh
npm ci
HOST_ORIGIN=https://board.example PUBLIC_URL=https://panel.example PORT=8780 npm start
HOST_ORIGIN=https://board.example PUBLIC_URL=https://panel.example npm run manifest --silent > manifest.json
npm test
```

`HOST_ORIGIN` is the exact approved host origin. `PUBLIC_URL` is the deployed HTTPS panel origin; HTTPS termination may be handled by a reverse proxy. `HOST` defaults to loopback; set `HOST=0.0.0.0` in a container. `PORT` defaults to 8780. Local development defaults to host `http://127.0.0.1:5173` and declaration URL `https://panel.example`; configure a real public URL before approval. The manifest is also available at `/manifest.json`. No provider credentials or authenticated API endpoints are served here.

Register the generated external declaration (`dokploy-panel`) for instance approval, then grant board panel rendering and explicitly check the separate signal read consent checkbox. Rendering consent alone cannot read signals. This companion panel requires an existing authorized provider connection, eligible board resource bindings and the native provider read/resource grants, in addition to the external panel read consent. External panel consent never creates provider authority. Provider onboarding remains a host responsibility. The host must support `session.request('signals.list', {provider: 'dokploy', after?: cursor})` and supply its actual React, Button, Badge, Input and mount widget exports. The SDK imports from `/sdk/index.mjs`; the server exposes the installed package file with public module CORS for an opaque iframe. Host styling and theme follow automatically through the SDK.

Dokploy shows deployment statuses from authorized inbox records, with text and status filters, manual refresh, and cursor pagination. It requests on opening and on explicit actions; there is no polling. Disposable search/status filters use session state. Abort cleanup releases the mounted React tree; SDK request timeout and disposal cancel pending work. Inbox semantics exclude signals already linked to visible cards and may return empty pages with a next cursor. Times retain source values and observation/event basis; they are evidence timestamps, not an assertion of current provider state.

Unsupported mutations: PR merge, deployment execution, issue resolution and provider configuration. The default panel profile does not create cards. No pull request API is available; this panel displays inbox evidence only. It sends no synthetic GlitchTip events. Read authorization, provider ingestion, real deployed host integration, light/dark behavior and browser lifecycle acceptance must be verified in the target deployment; Node checks validate service routes, headers, SDK availability, declarations and request/filter/pagination/abort contracts, and do not establish browser or production proof.

Public static assets permit CORS `*` without credentials. CSP frame ancestors is limited to the configured host. Exact route allowlisting excludes arbitrary files. Deploy this repository independently with its package tarball and lockfile; run `npm ci` before starting.

Local browser verification used the real compiled host widget module and opaque iframe lifecycle with disposable sample inbox records. It confirmed dark theme changes, filters, and denial clearing prior data; it did not exercise a deployed account or real provider ingestion.

Panel declaration 0.1.1 explicitly limits signal_sources to dokploy. Approve the newer declaration and review board signal consent again on SDK 0.2.20 hosts. The declaration neither grants provider account access nor installs an adapter. Inbox state remains independent from app-owned cards and HITL.


## Serving an optional workflow declaration

The default HTTP `/manifest.json` and `--manifest` output remain the read-only
signal inbox profile. Use `--workflow-cards` for both generation and service
startup when offering app-owned workflow cards:

```sh
npm run manifest --silent -- --workflow-cards > workflow-manifest.json
npm start -- --workflow-cards
```

Programmatic callers use `panelServer(config, { workflowCards: true })`. The
HTTP declaration is generated at startup from that same explicit profile.
These flags offer capabilities for approval; they do not register an app,
create a card, grant consent, connect a provider or activate external actions.

The deployment profile declares the `deployment` card type with a mandatory
`retain` archive policy. It requests `cards.read` and `cards.create`, and never
requests execution, interaction or archive webhook authority. Archiving a
card keeps its external deployment and logs intact. The declaration makes
card creation available to a separately authenticated app integration on a
compatible host; this panel service does not ingest deployment events or
create cards automatically. Live app registration and creation remain gates.

## Explicit external deployment reads

`provider-api.mjs` implements read-only official endpoints using a server-configured
exact HTTPS origin and API key. It verifies project/environment/resource membership
before reading `deployment.all` or `deployment.allByCompose`. Redirects, unknown
resource types and inventories over 250 rows or 1 MiB are rejected. No logs,
deployment execution, deletion or retry endpoints are used. See the
[official deployment API](https://docs.dokploy.com/docs/api/reference-deployment).

`refreshDeployments` in `signals.mjs` accepts a trusted current resource/board mapping
and a required durable `saveEnvelopes` callback. It normalizes the full bounded
response before persisting its latest 25 envelopes, then submits them sequentially
through the shared signed API. Metadata includes provider deployment time, ID and
finite outcome only; commits are empty rather than inferred. A failed or unknown
publication stops the batch. Recovery explicitly reuses the saved envelopes, not
a repeated provider read. Partial submissions remain recoverable by event identity.

`--publish-signals` offers schema 2 version 0.2.1 with a finite signal policy and
`signals.publish`. It is independent from `--workflow-cards`; neither flag grants
authority or starts a worker. Registration, explicit native connection credentials,
selected-resource consent and current revisions are required. The publishing profile lets the panel select legacy `dokploy` or external
`dokploy-panel` signals, with separate histories and cursors. Browser acceptance
on the intended host remains an integration gate. No native legacy route is removed.

Tests use local HTTP-shaped responses and host/provider doubles. Durable service
deployment, actual Dokploy account reads, native persistence readback and browser
acceptance are still required before replacing host ingestion.

The source-scoped pager comes from panel SDK 0.2.3. Source switching resets cursors, suppresses late state and removes abort listeners; no polling is added. Host permission checks remain authoritative.

Signal publication requires a native signal_uid and boolean duplicate receipt.
An HTTP success without that receipt is an unknown outcome; preserve the saved
envelope and reconcile before explicit replay. No automatic retry is performed.

## Durable one-shot observation CLI

Run `node observation.mjs observe CONFIG FILE` for one explicitly configured
resource. CONFIG includes exact HTTPS `hostOrigin`, `providerOrigin` and the
`scope` fields required by the provider reader plus `boardUID`, `resourceUID`,
`appRevision` and `bindingRevision`. Server credentials are environment-only:
`LANGBOARD_APP_TOKEN` and `DOKPLOY_READ_TOKEN`. No polling is started.

The SDK 0.1.3 store exclusively creates an owner-only, size-limited FILE and
syncs it before publication. `node observation.mjs resend CONFIG FILE` loads
the same batch without reading the provider. It rejects changed host/provider
origins or mapping revisions and stops at the first rejected/unknown receipt.
Partial batches replay accepted event identities for native deduplication.
Keep the file until native readback resolves all receipts; never replace an
unknown event with a new observation. CLI output contains receipt IDs only.
Local tests establish this recovery boundary, not live provider or deployment
acceptance.

Dokploy deployment timestamps are nullable, including cancelled or older records.
An observation reports these records in `unreported` with their deployment ID and
`provider_timestamp_missing`; it still persists and publishes other valid events.
It never substitutes the observation time or deployment creation time for a missing
terminal occurrence. Invalid identities, unsupported statuses and malformed times
still reject the batch before saving. Explicit resend replays only the saved valid
envelopes; it does not recover missing provider timestamps or claim those records
were published. Retain the observation output alongside its batch.
See the [official v0.30.8 deployment schema](https://github.com/Dokploy/dokploy/blob/v0.30.8/packages/server/src/db/schema/deployment.ts)
and [status update implementation](https://github.com/Dokploy/dokploy/blob/v0.30.8/packages/server/src/services/deployment.ts).

## Installable static package

Run `npm ci` and `npm run package` with Node 22 and Python 3.12 or newer.
The command uses the pinned standalone SDK wheel to build a deterministic ZIP in `dist/`.
Publish that ZIP as a release asset whose stable tag matches the declaration version.
The ZIP installs only public panel assets and the declaration. Server executors and credentials
remain in a separately operated service. The installed host provides its verified UI origin;
board permissions and resource selection remain explicit after central installation.


## Migration acceptance against a real deployment

Use the target instance's official Application or Compose resource; do not mirror
its deployment controller in this app. Record the installed Dokploy version and
selected project/environment/resource IDs separately from credentials. Configure
read credentials through the existing connection owner and secret reference.

The observation CLI reports safe HTTP categories for authentication (401), access
(403), throttling (429), unavailable provider (5xx), and other rejected requests.
It never prints provider response bodies, URLs or tokens. Failed provider reads
cancel the response body and stop before durable batch creation or publication.
There is no automatic retry; correct the connection or respect provider throttling
before a new explicit observation. Unknown publication receipts still require the
existing saved-batch reconciliation path.

For a deployment migration, retain evidence for each separate boundary:

- Select the actual target resource and confirm foreign resources are denied.
- Observe one real deployment, retain the batch, publish it and read the native
  signal back on the intended board. Explicit replay must report duplicates.
- Open the installed panel, verify filters and pagination, close/reopen it and
  check that no polling or disposed requests remain. Check desktop and mobile.
- Revoke the connection and confirm stale panel data is cleared while native
  cards, comments, relationships and prior signal history remain available.
- If workflow cards are enabled, archive a deployment card and verify that the
  external deployment/service is retained. Inbox evidence alone grants no action.

Database, attachments, OAuth state, editor ownership and cutover/rollback belong
to the deployment operator's preservation contract. A successful signal does not
prove that migration, restore integrity or customer access passed. Keep the live
acceptance checklist open until these outcomes have independent readback.
