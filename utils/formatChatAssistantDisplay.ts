/**
 * Presentation-only Chat layout. Does not rewrite stored history.
 *
 * Conservative list recovery:
 * - Keep ordinary mid-prose `·` (e.g. `smart casual · navy`).
 * - Keep existing `\n\n` paragraphs and line-starting bullets.
 * - Only unstick a first inline `·`/`•` when later line-starting bullets
 *   already show a list, matching `…accidental. · Give the eye…\n· …`.
 * - Separate the first list item from preceding prose with `\n\n`; keep
 *   later bullets on single `\n`. Do not invent prose paragraph breaks.
 * Ambiguous text is left unchanged.
 */

const LINE_START_BULLET_RE = /(?:^|\n)[ \t]*[·•][ \t]+\S/;
const STUCK_LIST_BULLET_RE = /([.!?…])([ \t]+)([·•])([ \t]+)(?=\S)/g;

export function formatChatAssistantDisplayText(raw: string): string {
  const original = String(raw || '');
  if (!original.trim()) return '';

  let text = original;
  if (LINE_START_BULLET_RE.test(text)) {
    text = text.replace(STUCK_LIST_BULLET_RE, (full, punct, _sp1, bullet, _sp2, offset, whole) => {
      const before = String(whole).slice(0, offset + punct.length);
      if (/(?:^|\n)[ \t]*$/.test(before)) return full;
      const rest = String(whole).slice(offset + full.length);
      if (!LINE_START_BULLET_RE.test(rest)) return full;
      return `${punct}\n\n${bullet} `;
    });
  }

  text = separateFirstListFromProse(text);
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Non-empty blank-line stand-in so iOS UITextView keeps paragraph height. */
export const CHAT_IOS_PARAGRAPH_SPACER = '\u00a0';

/**
 * Presentation-only iOS Chat value. Does not rewrite stored message text.
 * Copy must use the original `item.content`, not this string.
 */
export function formatChatAssistantIosSelectableValue(raw: string): string {
  const formatted = formatChatAssistantDisplayText(raw);
  if (!formatted.includes('\n\n')) return formatted;
  return formatted.replace(/\n\n+/g, `\n${CHAT_IOS_PARAGRAPH_SPACER}\n`);
}

/** Upgrade prose + `\n` + first bullet to `\n\n`; leave bullet-to-bullet on `\n`. */
function separateFirstListFromProse(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (isBulletLine(line.trim()) && out.length) {
      let prevIdx = out.length - 1;
      while (prevIdx >= 0 && out[prevIdx].trim() === '') prevIdx--;
      const prev = prevIdx >= 0 ? out[prevIdx] : '';
      if (prev && !isBulletLine(prev.trim()) && out[out.length - 1].trim() !== '') {
        out.push('');
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

function isBulletLine(line: string): boolean {
  return /^[·•]\s+\S/.test(line);
}

/** Logical paragraph/bullet units after conservative formatting. */
export function splitChatDisplayBlocks(raw: string): string[] {
  const text = formatChatAssistantDisplayText(raw);
  if (!text) return [];

  const blocks: string[] = [];
  for (const para of text.split(/\n\s*\n/)) {
    const lines = para.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    let prose: string[] = [];
    const flushProse = () => {
      if (!prose.length) return;
      blocks.push(prose.join('\n'));
      prose = [];
    };

    for (const line of lines) {
      if (isBulletLine(line)) {
        flushProse();
        blocks.push(line);
      } else {
        prose.push(line);
      }
    }
    flushProse();
  }

  return blocks;
}

export function chatDisplayTokens(raw: string): string[] {
  return String(raw || '')
    .replace(/[·•]/g, ' $& ')
    .split(/\s+/)
    .filter(Boolean);
}
