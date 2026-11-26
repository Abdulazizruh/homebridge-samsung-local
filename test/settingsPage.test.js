import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Seen in 1.9.0-beta.5 to beta.7: one apostrophe inside a text of the settings page ended its
// script, and the page opened with no text at all. The page's own script must always parse.
test('settings page: its script parses', () => {
  const html = readFileSync(new URL('../homebridge-ui/public/index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  for (const code of scripts) {
    assert.doesNotThrow(() => new vm.Script(code));
  }
});
