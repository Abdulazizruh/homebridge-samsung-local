/**
 * The keyboard part of the session ("RTI"). Its payloads are small archives
 * in Apple's binary property-list format.
 * Layout taken from pyatv (MIT) and atvr4samsung (MIT); see NOTICE.md.
 */
import bplistCreator from 'bplist-creator';
import { parseBuffer } from 'bplist-parser';

const uid = (n) => ({ UID: n });

/** What the iPhone is told when a text field opens: a session and the text already in the field. */
export function documentState(sessionUuid, text) {
  return bplistCreator({
    $top: { sessionUUID: uid(1), documentState: uid(2) },
    $objects: ['$null', Buffer.from(sessionUuid), { docSt: uid(3) }, { contextBeforeInput: uid(4) }, String(text ?? '')],
  });
}

/** One edit made on the iPhone keyboard: replace everything, delete from the end, add at the end. */
export function readEdit(archive) {
  const [data] = parseBuffer(Buffer.from(archive));
  const objects = data?.$objects;
  if (!Array.isArray(objects)) { throw new TypeError('not an archive'); }
  const follow = (path) => {
    let element = data.$top;
    for (const key of path) {
      element = element?.[key];
      if (element && typeof element === 'object' && Object.keys(element).length === 1 && Number.isInteger(element.UID)) {
        element = objects[element.UID];
      }
      if (element === undefined || element === null) { return null; }
    }
    return element === '$null' ? null : element;
  };
  const assert = follow(['textOperations', 'textToAssert']);
  const insert = follow(['textOperations', 'keyboardOutput', 'insertionText']);
  const remove = follow(['textOperations', 'keyboardOutput', 'deletionCount']);
  return {
    assert: typeof assert === 'string' ? assert : null,
    insert: typeof insert === 'string' ? insert : null,
    remove: Number.isInteger(remove) && remove > 0 ? remove : 0,
  };
}

/** The field's text after an edit. Counted in whole characters, so an Arabic letter or an emoji is one. */
export function applyEdit(text, edit, max = 1024) {
  let chars = Array.from(edit.assert ?? text ?? '');
  if (edit.remove) { chars = chars.slice(0, Math.max(0, chars.length - edit.remove)); }
  if (edit.insert) { chars = chars.concat(Array.from(edit.insert)); }
  return chars.slice(0, max).join('');
}

/** How many characters at the end of `text` are also the start of `insert` (the longest such run). */
export function overlap(text, insert) {
  const t = Array.from(text ?? ''); const i = Array.from(insert ?? '');
  for (let k = Math.min(t.length, i.length); k > 0; k -= 1) {
    if (t.slice(t.length - k).join('') === i.slice(0, k).join('')) { return k; }
  }
  return 0;
}

/**
 * Some iPhone keyboards send, with every letter, the whole word typed so far
 * (and once more when the word is settled) instead of the one new letter.
 * Read that way, the word replaces its own beginning at the end of the field.
 */
export function applyWholeWord(text, insert, max = 1024) {
  const chars = Array.from(text ?? '');
  const k = overlap(text, insert);
  return chars.slice(0, chars.length - k).concat(Array.from(insert)).slice(0, max).join('');
}
