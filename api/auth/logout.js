'use strict';
const { createApp } = require('../../server/app');
const handle = createApp();
module.exports = (req, res) => handle(req, res, 'logout');
