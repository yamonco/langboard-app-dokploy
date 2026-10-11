# Dokploy panel

## Workflow deployment archive policy

`archive.mjs` retains external deployment and log history and returns an explicit
no-external-action receipt. An archived deployment card must never stop, delete,
redeploy or roll back a service. Deployment actions require separate explicit
opt-in and current authority. Signal inbox ingestion never enables workflow
card actions. Host lifecycle event wiring and runtime acceptance remain pending.

Standalone third party Langboard panel service. Node 22.13 or newer; no core checkout, React installation, copied theme, or browser provider credentials. The vendored panel SDK 0.2.0 provides the browser bridge; server SDK 0.1.1 signs explicit signal publications and is never exposed as a browser asset.

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
selected-resource consent and current revisions are required. The existing panel
still reads legacy `dokploy` signals; displaying the new app source is a separate
integration gate. No native legacy route is removed.

Tests use local HTTP-shaped responses and host/provider doubles. Durable service
deployment, actual Dokploy account reads, native persistence readback and browser
acceptance are still required before replacing host ingestion.
