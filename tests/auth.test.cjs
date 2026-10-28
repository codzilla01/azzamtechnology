'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('../server');
const { createApp } = require('../server/app');
const { FileStore, RedisStore, createStoreFromEnv } = require('../server/store');
const { hashToken } = require('../server/passwords');

const TEMP_PASSWORD = 'initial-test-password-2026';
const NEW_PASSWORD = 'new-unique-test-password-2026';

async function startServer(t, store, env = {}) {
    const server = createServer(store, env);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(() => new Promise(resolve => server.close(resolve)));
    return base;
}
async function fileFixture(t, env = { AZZAM_INITIAL_ADMIN_PASSWORD: TEMP_PASSWORD }) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'azzam-auth-test-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const store = new FileStore(directory, env);
    await store.initialize();
    return { directory, store, base: await startServer(t, store) };
}
function request(base, endpoint, { method = 'GET', body, cookie, origin, headers = {} } = {}) {
    return fetch(base + endpoint, {
        method, redirect: 'manual', headers: {
            ...(method !== 'GET' && method !== 'HEAD' ? { Origin: origin === undefined ? base : origin, 'Content-Type': 'application/json' } : {}),
            ...(cookie ? { Cookie: cookie } : {}), ...headers
        }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
    });
}
function getCookie(response) {
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie);
    return setCookie.split(';')[0];
}
async function login(base, username = 'admin', password = TEMP_PASSWORD, extra = {}) {
    return request(base, '/api/auth/login', { method: 'POST', body: { username, password }, ...extra });
}
async function change(base, cookie, username = 'admin', currentPassword = TEMP_PASSWORD, newPassword = NEW_PASSWORD, extra = {}) {
    return request(base, '/api/auth/change', { method: 'POST', cookie, body: { username, currentPassword, newPassword }, ...extra });
}

test('local bootstrap creates a unique temporary password in a private file and stores only a salted hash', async t => {
    const a = await fileFixture(t, {});
    const b = await fileFixture(t, {});
    const credentialsA = JSON.parse(await fs.readFile(path.join(a.directory, 'initial-credentials.json'), 'utf8'));
    const credentialsB = JSON.parse(await fs.readFile(path.join(b.directory, 'initial-credentials.json'), 'utf8'));
    assert.equal(credentialsA.username, 'admin');
    assert.notEqual(credentialsA.password, credentialsB.password);
    assert.ok(credentialsA.password.length >= 24);
    assert.equal((await fs.stat(a.directory)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(path.join(a.directory, 'initial-credentials.json'))).mode & 0o777, 0o600);
    assert.equal((await fs.stat(path.join(a.directory, 'account.json'))).mode & 0o777, 0o600);
    const account = await a.store.getAccount();
    assert.equal(account.mustChange, true);
    assert.ok(!JSON.stringify(account).includes(credentialsA.password));
    const response = await login(a.base, credentialsA.username, credentialsA.password);
    assert.equal(response.status, 200);
    const update = await change(a.base, getCookie(response), 'admin', credentialsA.password, NEW_PASSWORD);
    assert.equal(update.status, 200);
    await assert.rejects(fs.stat(path.join(a.directory, 'initial-credentials.json')), { code: 'ENOENT' });
});

test('a previously created local preview account remains usable and upgrades on password change', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'azzam-legacy-kdf-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(TEMP_PASSWORD, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const account = { username: 'admin', salt: salt.toString('hex'), hash: hash.toString('hex'), version: crypto.randomBytes(24).toString('base64url'), mustChange: true };
    await fs.writeFile(path.join(directory, 'account.json'), JSON.stringify(account), { mode: 0o600 });
    const store = new FileStore(directory, {});
    await store.initialize();
    const base = await startServer(t, store);
    const response = await login(base);
    assert.equal(response.status, 200);
    const update = await change(base, getCookie(response));
    assert.equal(update.status, 200);
    assert.equal((await store.getAccount()).kdf, 'scrypt-32768-8-3');
    assert.equal((await login(base, 'admin', NEW_PASSWORD)).status, 200);
});

test('local credentials cannot be written inside the project or through a project symlink', async t => {
    const directory = await fs.mkdtemp(path.join(__dirname, '..', '.auth-denied-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const store = new FileStore(directory, {});
    await assert.rejects(store.initialize(), /outside the project directory/);
    await assert.rejects(fs.stat(path.join(directory, 'initial-credentials.json')), { code: 'ENOENT' });
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'azzam-link-test-'));
    t.after(() => fs.rm(outside, { recursive: true, force: true }));
    const link = path.join(outside, 'redirect');
    await fs.symlink(directory, link, 'dir');
    const linked = new FileStore(link, {});
    await assert.rejects(linked.initialize(), /outside the project directory/);
});

test('dashboard and source files cannot be fetched without a valid server session', async t => {
    const { base } = await fileFixture(t);
    for (const route of ['/admin.html', '/api/admin']) {
        const response = await request(base, route);
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/login.html');
        assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    for (const route of ['/private/admin.html', '/server/app.js', '/server.js', '/tests/auth.test.cjs', '/assets/%2e%2e/private/admin.html']) {
        assert.equal((await request(base, route)).status, 404, route);
    }
    const forged = await request(base, '/admin.html?admin_verified=true', { cookie: 'azzam_admin_session=' + 'x'.repeat(43) });
    assert.equal(forged.status, 302);
    assert.equal((await request(base, '/')).status, 200);
    assert.equal((await request(base, '/login.html')).status, 200);
    assert.equal((await request(base, '/assets/vendor/fontawesome/css/all.min.css')).status, 200);
    assert.equal((await request(base, '/assets/vendor/fontawesome/webfonts/fa-solid-900.woff2')).status, 200);
    assert.equal((await request(base, '/images/product-placeholder.svg')).status, 200);
    assert.deepEqual(await (await request(base, '/api/auth/session')).json(), { authenticated: false });
});

test('first login requires a password change; changes revoke old sessions, survive restarts, and logout revokes the current session', async t => {
    const { directory, base } = await fileFixture(t);
    assert.equal((await login(base, 'admin', 'incorrect-password')).status, 401);
    const one = await login(base);
    assert.equal(one.status, 200);
    assert.deepEqual(await one.json(), { authenticated: true, username: 'admin', mustChange: true });
    assert.match(one.headers.get('set-cookie'), /HttpOnly/);
    assert.match(one.headers.get('set-cookie'), /SameSite=Strict/);
    const cookie1 = getCookie(one);
    const two = await login(base);
    const cookie2 = getCookie(two);
    let response = await request(base, '/admin.html', { cookie: cookie1 });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login.html?setup=1');
    assert.equal((await change(base, cookie1, 'manager', TEMP_PASSWORD, '')).status, 400);
    assert.equal((await change(base, cookie1, 'manager', TEMP_PASSWORD, 'short')).status, 400);
    assert.equal((await change(base, cookie1, 'manager', TEMP_PASSWORD, TEMP_PASSWORD)).status, 400);
    response = await change(base, cookie1, 'manager', TEMP_PASSWORD, NEW_PASSWORD);
    assert.equal(response.status, 200);
    const cookie3 = getCookie(response);
    assert.notEqual(cookie1, cookie3);
    assert.equal((await request(base, '/admin.html', { cookie: cookie3 })).status, 200);
    assert.equal((await request(base, '/admin.html', { cookie: cookie1 })).status, 302);
    assert.equal((await request(base, '/admin.html', { cookie: cookie2 })).status, 302);
    assert.equal((await login(base)).status, 401);
    assert.equal((await login(base, 'manager', NEW_PASSWORD)).status, 200);

    // Changing only the username still requires the current password and revokes sessions.
    response = await change(base, cookie3, 'new.manager', NEW_PASSWORD, '');
    assert.equal(response.status, 200);
    const cookie4 = getCookie(response);
    assert.equal((await request(base, '/admin.html', { cookie: cookie3 })).status, 302);
    assert.equal((await login(base, 'manager', NEW_PASSWORD)).status, 401);
    assert.equal((await login(base, 'new.manager', NEW_PASSWORD)).status, 200);

    const restartedStore = new FileStore(directory, {});
    const restarted = await startServer(t, restartedStore);
    assert.equal((await request(restarted, '/admin.html', { cookie: cookie4 })).status, 302);
    response = await login(restarted, 'new.manager', NEW_PASSWORD);
    assert.equal(response.status, 200);
    assert.equal((await response.clone().json()).mustChange, false);
    const restartCookie = getCookie(response);
    response = await request(restarted, '/api/auth/logout', { method: 'POST', cookie: restartCookie, body: {} });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await request(restarted, '/admin.html', { cookie: restartCookie })).status, 302);
    assert.ok(!(await fs.readFile(path.join(directory, 'account.json'), 'utf8')).includes(NEW_PASSWORD));
});

test('expired sessions no longer grant access', async t => {
    const { store, base } = await fileFixture(t);
    const initial = await login(base);
    const setup = await change(base, getCookie(initial));
    const cookie = getCookie(setup);
    assert.equal((await request(base, '/admin.html', { cookie })).status, 200);
    const token = cookie.slice(cookie.indexOf('=') + 1);
    store.sessions.get(hashToken(token)).expires = Date.now() - 1;
    const response = await request(base, '/admin.html', { cookie });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login.html');
});

test('concurrent credential changes cannot overwrite each other', async t => {
    const { base } = await fileFixture(t);
    const initial = await login(base);
    const setup = await change(base, getCookie(initial));
    const cookie = getCookie(setup);
    const results = await Promise.all([
        change(base, cookie, 'owner-a', NEW_PASSWORD, 'another-password-a-2026'),
        change(base, cookie, 'owner-b', NEW_PASSWORD, 'another-password-b-2026')
    ]);
    assert.equal(results.filter(response => response.status === 200).length, 1);
    assert.ok(results.filter(response => response.status !== 200).every(response => [401, 409].includes(response.status)));
    const winner = results.findIndex(response => response.status === 200);
    const username = winner === 0 ? 'owner-a' : 'owner-b';
    const password = winner === 0 ? 'another-password-a-2026' : 'another-password-b-2026';
    assert.equal((await login(base, username, password)).status, 200);
});

test('CSRF, non-JSON and insecure production requests are rejected; production cookie is secure', async t => {
    const { store } = await fileFixture(t);
    const env = { NODE_ENV: 'production', AZZAM_TRUST_PROXY: '1' };
    const base = await startServer(t, store, env);
    const secureOrigin = base.replace('http:', 'https:');
    const forwarded = { 'x-forwarded-proto': 'https' };
    assert.equal((await request(base, '/login.html')).status, 403);
    const secureLogin = await request(base, '/login.html', { headers: forwarded });
    assert.equal(secureLogin.status, 200);
    assert.match(secureLogin.headers.get('strict-transport-security'), /max-age=/);
    assert.equal((await login(base, 'admin', TEMP_PASSWORD)).status, 403);
    assert.equal((await login(base, 'admin', TEMP_PASSWORD, { origin: 'https://attacker.example', headers: forwarded })).status, 403);
    assert.equal((await login(base, 'admin', TEMP_PASSWORD, { origin: secureOrigin, headers: { ...forwarded, 'sec-fetch-site': 'cross-site' } })).status, 403);
    assert.equal((await login(base, 'admin', TEMP_PASSWORD, { origin: secureOrigin, headers: { ...forwarded, 'content-type': 'text/plain' } })).status, 415);
    assert.equal((await request(base, '/api/auth/login', { method: 'POST', origin: secureOrigin, body: '{not-json', headers: forwarded })).status, 400);
    const response = await login(base, 'admin', TEMP_PASSWORD, { origin: secureOrigin, headers: forwarded });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /; Secure/);
    assert.match(response.headers.get('set-cookie'), /; HttpOnly/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    const cookie = getCookie(response);
    assert.equal((await change(base, cookie, 'admin', TEMP_PASSWORD, NEW_PASSWORD, { origin: 'https://attacker.example', headers: forwarded })).status, 403);
    assert.equal((await request(base, '/api/auth/logout', { method: 'POST', cookie, body: {}, origin: 'https://attacker.example', headers: forwarded })).status, 403);
});

test('Vercel-style parsed bodies and throwing body getters are handled safely', async t => {
    const { store } = await fileFixture(t);
    const app = createApp({ store, env: {} });
    const server = http.createServer((req, res) => {
        Object.defineProperty(req, 'body', {
            get() {
                if (req.url === '/malformed') throw new Error('Invalid JSON');
                return { username: 'admin', password: TEMP_PASSWORD };
            }
        });
        app(req, res, 'login');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await request(base, '/parsed', { method: 'POST', body: {} })).status, 200);
    const bad = await request(base, '/malformed', { method: 'POST', body: {} });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).code, 'INVALID_REQUEST');
});

test('incorrect attempts are rate limited and successful login resets the counter', async t => {
    const { base } = await fileFixture(t);
    for (let i = 0; i < 3; i++) assert.equal((await login(base, 'admin', 'wrong')).status, 401);
    assert.equal((await login(base)).status, 200);
    for (let i = 0; i < 6; i++) assert.equal((await login(base, 'admin', 'wrong')).status, 401);
    const blocked = await login(base);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

// Emulates the Redis REST commands shared between independent serverless instances.
function fakeRedis() {
    const values = new Map();
    return async (_url, options) => {
        assert.equal(options.headers.Authorization, 'Bearer test-redis-token');
        const [command, ...args] = JSON.parse(options.body);
        let result;
        if (command === 'GET') result = values.has(args[0]) ? values.get(args[0]) : null;
        else if (command === 'SET') {
            const [key, value, mode] = args;
            if (mode === 'NX' && values.has(key)) result = null;
            else { values.set(key, value); result = 'OK'; }
        } else if (command === 'DEL') { result = Number(values.delete(args[0])); }
        else if (command === 'EVAL') {
            const [script, , key, value, replacement] = args;
            if (script.includes("redis.call('INCR'")) {
                const count = Number(values.get(key) || 0) + 1;
                values.set(key, String(count));
                result = [count, Number(value)];
            } else {
                const account = values.has(key) ? JSON.parse(values.get(key)) : null;
                result = Number(Boolean(account && account.version === value));
                if (result) values.set(key, replacement);
            }
        } else throw new Error('Unexpected fake Redis command ' + command);
        return new Response(JSON.stringify({ result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
}

test('Redis-backed instances share bootstrap, rate limits, sessions, and credential changes', async t => {
    const redis = fakeRedis();
    const env = { AZZAM_INITIAL_ADMIN_PASSWORD: TEMP_PASSWORD };
    const a = new RedisStore('https://redis.example', 'test-redis-token', env, redis);
    const b = new RedisStore('https://redis.example', 'test-redis-token', env, redis);
    const [accountA, accountB] = await Promise.all([a.getAccount(), b.getAccount()]);
    assert.deepEqual(accountA, accountB);
    const baseA = await startServer(t, a);
    const baseB = await startServer(t, b);
    const initial = await login(baseA);
    assert.equal(initial.status, 200);
    const cookie = getCookie(initial);
    assert.equal((await (await request(baseB, '/api/auth/session', { cookie })).json()).mustChange, true);
    const updated = await change(baseB, cookie, 'shared-admin', TEMP_PASSWORD, NEW_PASSWORD);
    assert.equal(updated.status, 200);
    const replacement = getCookie(updated);
    assert.equal((await request(baseA, '/admin.html', { cookie: replacement })).status, 200);
    assert.equal((await request(baseA, '/admin.html', { cookie })).status, 302);
    const rotated = new RedisStore('https://redis.example', 'test-redis-token', { AZZAM_INITIAL_ADMIN_PASSWORD: 'ignored-password-2026' }, redis);
    assert.equal((await rotated.getAccount()).username, 'shared-admin');
    const attempts = await Promise.all([a.takeAttempt('a', 1, 30), b.takeAttempt('a', 1, 30)]);
    assert.equal(attempts.filter(result => result.allowed).length, 1);
});

test('serverless storage is fail-closed when configuration is missing or Redis is unavailable', async t => {
    assert.throws(() => createStoreFromEnv({ VERCEL: '1' }), /Redis/);
    assert.throws(() => new RedisStore('http://redis.example', 'token'), /secure/);
    const missing = await startServer(t, undefined, { VERCEL: '1' });
    const forwarded = { 'x-forwarded-proto': 'https' };
    const redirect = await request(missing, '/admin.html', { headers: forwarded });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/login.html');
    const unavailable = await request(missing, '/api/auth/session', { headers: forwarded });
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { code: 'AUTH_UNAVAILABLE' });
    const store = new RedisStore('https://redis.example', 'test-redis-token', {}, async () => { throw new Error('network'); });
    const base = await startServer(t, store);
    const response = await login(base);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: 'AUTH_UNAVAILABLE' });
    assert.equal((await request(base, '/admin.html', { cookie: 'azzam_admin_session=' + 'x'.repeat(43) })).status, 503);
});
