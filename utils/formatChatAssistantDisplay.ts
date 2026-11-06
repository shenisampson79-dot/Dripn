/**
 * Presentation-only Chat layout. Does not rewrite stored history.
 *
 * Unstick a first inline `·`/`•` only when later line-starting bullets
 * already show a list, matching `…clean. • Mute…\n• Add…`.
 * Insert a single newline before that first item. Leave ordinary prose,
 * mid-sentence dots, and already separated lists unchanged.
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

export function resolveChatSelectableDisplayText(
  text: string,
  options: { platform: string; inverted?: boolean },
): string {
  const raw = String(text ?? '');
  if (options.platform === 'android' && !options.inverted) {
    return formatChatAssistantDisplayText(raw);
  }
  return raw;
}
