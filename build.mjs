import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/lib', { recursive: true });
copyFileSync('lib/engine.mjs', 'public/lib/engine.mjs');
console.log('Game ready: public/ + api/');
