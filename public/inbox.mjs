import {createSignalInbox, createSourceInbox as createScopedInbox, filterSignals} from '@langboard/app-panel/inbox';
export const provider = 'dokploy';
export const title = { en: 'Deployment statuses', ko: '배포 상태' };
export const visibleItems = (items, query, outcome, source = provider) => filterSignals(items, source, query, outcome);
export const createInbox = (session, changed, source = provider) => createSignalInbox(session, source, changed);
export const createSourceInbox = (session, changed, source) => createScopedInbox(session, source, changed);
