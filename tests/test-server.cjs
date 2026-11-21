'use strict';

const { createServer } = require('../server');

const server = createServer();
server.listen(8010, '0.0.0.0', () => console.log('Browser test server on 8010'));
const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
