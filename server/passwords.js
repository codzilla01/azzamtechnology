'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);

const CURRENT_KDF = 'scrypt-32768-8-3';
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
// Accounts without a KDF marker were created by the earlier local preview.
const LEGACY_SCRYPT_OPTIONS = { ...SCRYPT_OPTIONS, p: 1 };
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/;

function validateUsername(username) {
    return typeof username === 'string' && USERNAME_PATTERN.test(username);
}

function validatePassword(password, username) {
    return typeof password === 'string' && Array.from(password).length >= 12 &&
        Buffer.byteLength(password, 'utf8') <= 256 &&
        password.toLowerCase() !== String(username || '').toLowerCase();
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
    return { salt: salt.toString('hex'), hash: hash.toString('hex'), kdf: CURRENT_KDF };
}

async function verifyPassword(password, account) {
    // Always perform scrypt for a valid account, including for an incorrect username.
    const salt = Buffer.from(account.salt, 'hex');
    const expected = Buffer.from(account.hash, 'hex');
    const value = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 256 ? password : '';
    const actual = await scrypt(value, salt, 64, account.kdf ? SCRYPT_OPTIONS : LEGACY_SCRYPT_OPTIONS);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function newVersion() { return crypto.randomBytes(24).toString('base64url'); }
function newToken() { return crypto.randomBytes(32).toString('base64url'); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

function validateAccount(account) {
    return account && validateUsername(account.username) &&
        typeof account.salt === 'string' && /^[a-f0-9]{32}$/.test(account.salt) &&
        typeof account.hash === 'string' && /^[a-f0-9]{128}$/.test(account.hash) &&
        (account.kdf === undefined || account.kdf === CURRENT_KDF) &&
        typeof account.version === 'string' && /^[A-Za-z0-9_-]{32}$/.test(account.version) &&
        typeof account.mustChange === 'boolean';
}

module.exports = { validateUsername, validatePassword, hashPassword, verifyPassword, newVersion, newToken, hashToken, validateAccount };
