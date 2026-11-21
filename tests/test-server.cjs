'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');
const { FileStore } = require('../server/store');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'azzam-pw-'));
const env = { ...process.env, AZZAM_ADMIN_PASSCODE: 'test-passcode-1234' };
const store = new FileStore(dataDir, env);
const server = createServer(store, env);

store.initialize().then(() => {
    server.listen(8010, '0.0.0.0', () => console.log('Browser test server on 8010'));
}).catch(err => {
    console.error(err);
    process.exit(1);
});

const shutdown = () => {
    server.close(() => {
        fs.rmSync(dataDir, { recursive: true, force: true });
        process.exit(0);
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
