/**
 * Client mirror of Dripn-Server juliaFashionRedirect.js — keep patterns aligned.
 */

export const JULIA_FASHION_REDIRECT_RESPONSE =
  'Great question! For outfit and styling advice, our AI stylists are the best place to go.\n\n' +
  'Open the Stylist tab and chat with Ruby, Max, Ace, or Ivy — they can help with what to wear, pairing pieces, and building looks.\n\n' +
  "I'm Julia, your support assistant — I'm here for app help, account questions, billing, and troubleshooting.";

function isJuliaSupportIntent(lower: string): boolean {
  if (
    /\b(where is|where's|usage this month|settings|subscription|billing|refund|cancel subscription|restore purchase)\b/.test(
      lower,
    )
  ) {
    return true;
  }
  if (
    /\b(support ticket|customer service|phone support|speak to someone|email support|help or support)\b/.test(
      lower,
    )
  ) {
    return true;
  }
  if (/\b(login|password|account problem|referral|invite friend|not working|won't load|can't connect)\b/.test(lower)) {
    return true;
  }
  if (/\b(how do i use|how to use|how does)\b.*\b(app|live|wardrobe|scanner|camera|decide|feature|stylist tab)\b/.test(lower)) {
    return true;
  }
  return false;
}

function hasFashionStylingIntent(lower: string): boolean {
  if (/\b(what (should|do|can) i wear|what to wear|outfit idea|styling advice|fashion advice|style advice)\b/.test(lower)) {
    return true;
  }
  if (/\b(what to style|how to style|style it with|style this|style that|style a )\b/.test(lower)) {
    return true;
  }
  if (/\b(thinking of buying|should i buy)\b/.test(lower) && /\b(wear|style|outfit|look|pair)\b/.test(lower)) {
    return true;
  }
  if (/\b(pair (this|it|with)|go with|works with|match with|look better)\b/.test(lower)) {
    return true;
  }
  if (/\b(sarong|date night look|wedding guest|dress code|body type|skin tone)\b/.test(lower)) {
    return true;
  }
  if (/\b(does this outfit|is this outfit|too formal|too casual for)\b/.test(lower)) {
    return true;
  }
  if (/\bbest tops\b|\bbest shoes\b|\bplain or printed\b/.test(lower)) {
    return true;
  }
  if (/\bwhat do you think\b/.test(lower) && /\b(wear|style|outfit|look|buy)\b/.test(lower)) {
    return true;
  }
  return false;
}

export function isJuliaFashionStylingAsk(message: string): boolean {
  const lower = String(message || '').trim().toLowerCase();
  if (lower.length < 10) return false;
  if (isJuliaSupportIntent(lower)) return false;
  return hasFashionStylingIntent(lower);
}
