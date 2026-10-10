import {createSignalInbox, filterSignals} from '@langboard/app-panel/inbox';
export const provider = 'dokploy';
export const title = { en: 'Deployment statuses', ko: '배포 상태' };
export const visibleItems = (items, query, outcome) => filterSignals(items, provider, query, outcome);
export const createInbox = (session, changed) => createSignalInbox(session, provider, changed);
