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
 * A real iPhone (iOS 26) follows a keystroke with a second message that is not
 * typing. Read from the logs of a real phone, by field names and lengths only:
 *  - a keystroke carries the keyboard's own state (`inputSourceState`) and the one letter;
 *  - the message after it carries no keyboard state, and as its text everything
 *    inserted since the keyboard opened, deletions not taken out. It grows by one
 *    with each letter and never shrinks, so it is no picture of the field either.
 * So it is told apart by what it is: an insertion without keyboard state, right
 * after a keystroke, ending with what that keystroke added. Never by comparing
 * it with the field, and never by timing. pyatv's remote sends no such message.
 */
export class Echoes {
  constructor() { this.last = null; }

  /** True when this edit is the message that follows a keystroke and adds nothing. */
  isEcho(edit) {
    const plain = Boolean(edit.insert) && !edit.remove && edit.assert === null;
    const echo = plain && !edit.keyboard && this.last !== null && edit.insert.endsWith(this.last);
    this.last = plain && edit.keyboard ? edit.insert : null; // one such message per keystroke
    return echo;
  }
}
