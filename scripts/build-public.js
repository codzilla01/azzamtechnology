'use strict';

// Vercel publishes ONLY this generated directory as static files. In particular,
// the private dashboard template, API source and any auth data are never static.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
const files = ['index.html', 'login.html', 'chat-bot.html', 'i18n.js', 'i18n.css', 'auth.js', 'auth.css', 'storefront.css'];
const directories = ['assets', 'images'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
function rejectSymlinks(source) {
    const stat = fs.lstatSync(source);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in public assets: ${source}`);
    if (stat.isDirectory()) for (const name of fs.readdirSync(source)) rejectSymlinks(path.join(source, name));
}
for (const name of [...files, ...directories]) {
    const source = path.join(root, name);
    rejectSymlinks(source);
    fs.cpSync(source, path.join(output, name), { recursive: true });
}
console.log('Public static files prepared; the admin template remains server-only.');
