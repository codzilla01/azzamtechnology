'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('the public deployment bundle excludes the private dashboard and server source', () => {
    execFileSync(process.execPath, ['scripts/build-public.js'], { cwd: root });
    const output = path.join(root, 'public');
    for (const name of ['admin.html', 'private', 'server', 'server.js', 'tests', 'package.json', '.git']) {
        assert.equal(fs.existsSync(path.join(output, name)), false, `${name} must not be public`);
    }
    for (const name of ['index.html', 'login.html', 'auth.js', 'auth.css', 'images/product-placeholder.svg', 'assets/vendor/fontawesome/css/all.min.css']) {
        assert.equal(fs.existsSync(path.join(output, name)), true, `${name} must be included`);
    }
    const index = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    assert.doesNotMatch(index, /api\.telegram\.org|TELEGRAM_BOT_TOKEN|admin_verified|skip-login-btn/);
    const routes = require('../vercel.json').routes;
    assert.ok(routes.some(route => route.dest === '/api/admin' && new RegExp(route.src).test('/admin.html')));
    assert.equal(require('../vercel.json').outputDirectory, 'public');
});
