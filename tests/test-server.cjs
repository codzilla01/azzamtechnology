'use strict';

// Isolated, disposable account for browser tests. These are not production credentials.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');
const { FileStore } = require('../server/store');
const { newVersion } = require('../server/passwords');

(async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'azzam-browser-tests-'));
    const store = new FileStore(directory, { AZZAM_INITIAL_ADMIN_PASSWORD: 'browser-test-password-2026' });
    await store.initialize();
    const account = await store.getAccount();
    await store.replaceAccount(account.version, { ...account, version: newVersion(), mustChange: false });
    const server = createServer(store, {});
    server.listen(8010, '0.0.0.0', () => console.log('Isolated browser test server on 8010'));
    const shutdown = () => server.close(() => fs.rm(directory, { recursive: true, force: true }).finally(() => process.exit(0)));
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
})().catch(error => { console.error(error); process.exitCode = 1; });
