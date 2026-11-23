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
  // The names of the fields the phone filled in, two levels deep, without any of their values:
  // enough to tell one kind of message from another, and nothing of what was typed.
  const resolve = (v) => (v && typeof v === 'object' && Object.keys(v).length === 1 && Number.isInteger(v.UID) ? objects[v.UID] : v);
  const named = (v) => (v && typeof v === 'object' && !Buffer.isBuffer(v) && !Array.isArray(v) ? Object.keys(v).filter((k) => k !== '$class' && resolve(v[k]) !== '$null') : []);
  const ops = resolve(data.$top?.textOperations);
  const shape = named(ops).sort().map((k) => {
    const inner = named(resolve(ops[k])).sort();
    return inner.length ? `${k}(${inner.join(',')})` : k;
  }).join(' ').replace(/[^\w(), .-]/g, '?').slice(0, 300);
  return {
    shape,
    keyboard: named(ops).includes('inputSourceState'), // said by the keyboard itself: a key was pressed
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

/**
 * How a real iPhone (iOS 26) words its typing, read from the logs of a real
 * phone by field names and lengths only:
 *  - a key press carries the keyboard's own state (`inputSourceState`) and the
 *    one change: a letter added, letters removed, or a suggestion accepted;
 *  - whenever its text changed, the phone then says the whole text as it now
 *    stands, in a message without keyboard state. After a letter it is one longer,
 *    after a deletion one shorter, after an accepted suggestion it holds the
 *    suggested word, and it is right wherever the cursor was.
 * So that second message is a picture of the text and replaces the field; it
 * was once added to it, which doubled everything. A phone that never sends
 * keyboard state (older systems, pyatv's remote) has no such pictures: its
 * insertions are plain typing and are added as before.
 */
export class Typing {
  constructor() { this.keyboard = false; }

  /** The field after this edit, and whether the edit was a picture of the whole text. */
  apply(field, edit, max = 1024) {
    if (edit.keyboard) { this.keyboard = true; }
    const picture = this.keyboard && !edit.keyboard && edit.insert !== null && !edit.remove && edit.assert === null;
    return { picture, text: picture ? Array.from(edit.insert).slice(0, max).join('') : applyEdit(field, edit, max) };
  }
}
