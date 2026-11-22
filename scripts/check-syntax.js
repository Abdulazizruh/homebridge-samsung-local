// Syntax check for every shipped JavaScript file (there is no build step).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['index.js', 'src', 'engine', 'homebridge-ui/server.js', 'test', 'scripts'];
const files = [];
const walk = (p) => {
  if (fs.statSync(p).isDirectory()) {
    fs.readdirSync(p).forEach((n) => walk(path.join(p, n)));
  } else if (/\.m?js$/.test(p)) {
    files.push(p);
  }
};
roots.filter((r) => fs.existsSync(r)).forEach(walk);
for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
JSON.parse(fs.readFileSync('config.schema.json', 'utf8'));
console.log(`OK: ${files.length} files`);
