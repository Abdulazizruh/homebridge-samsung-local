// Checks that the outside links on the settings page still open: each must answer
// with a page (HTTP 200 after redirects). Run on every push; a failure is shown as
// a warning on the run, so the link can be fixed before the next release.
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../homebridge-ui/public/index.html', import.meta.url), 'utf8');
const links = [...new Set([...page.matchAll(/href="(https:\/\/[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
let bad = 0;
for (const url of links) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 (link check)' } });
    const ok = res.status === 200;
    console.log(`${ok ? 'OK ' : 'BAD'} ${res.status} ${new URL(url).host}${new URL(url).pathname}`);
    if (!ok) { bad += 1; }
  } catch (err) {
    bad += 1;
    console.log(`BAD ${err.name} ${new URL(url).host}${new URL(url).pathname}`);
  }
}
if (bad) {
  console.log(`::warning::${bad} outside link(s) on the settings page did not open. Check them before the next release.`);
  process.exitCode = 1;
}
