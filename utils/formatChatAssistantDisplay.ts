/**
 * Presentation-only Chat layout. Does not rewrite stored history.
 *
 * Conservative list recovery:
 * - Keep ordinary mid-prose `·` (e.g. `smart casual · navy`).
 * - Keep existing `\n\n` paragraphs and line-starting bullets.
 * - Only unstick a first inline `·`/`•` when later line-starting bullets
 *   already show a list, matching `…accidental. · Give the eye…\n· …`.
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
      return `${punct}\n${bullet} `;
    });
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
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
