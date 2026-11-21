// Prints the CHANGELOG.md section for one version, for use as GitHub release notes.
// Usage: node scripts/release-notes.js 1.0.0
import fs from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '');
const lines = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith(`## ${version} `) || l.trim() === `## ${version}`);
if (!version || start < 0) {
  process.exit(0); // no section: leave the release as it is
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) {
  end = lines.length;
}
process.stdout.write(`${lines.slice(start + 1, end).join('\n').trim()}\n`);
