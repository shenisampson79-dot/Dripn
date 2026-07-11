/**
 * Offline-first locale translation helpers with brand-name protection.
 */
const BRAND_PLACEHOLDERS = [
  ['Dripn', '{{DRIPN}}'],
  ['Ruby', '{{RUBY}}'],
  ['Max', '{{MAX}}'],
  ['Ace', '{{ACE}}'],
  ['Ivy', '{{IVY}}'],
  ['Julia', '{{JULIA}}'],
  ['OpenAI', '{{OPENAI}}'],
  ['Apple', '{{APPLE}}'],
  ['Google', '{{GOOGLE}}'],
  ['Stripe', '{{STRIPE}}'],
  ['Facebook', '{{FACEBOOK}}'],
  ['stylist@dripn.com', '{{STYLIST_EMAIL}}'],
];

const GOOGLE_LANG_CODES = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  nl: 'nl',
  pl: 'pl',
  ru: 'ru',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  ar: 'ar',
  hi: 'hi',
  tr: 'tr',
  sv: 'sv',
  da: 'da',
  no: 'no',
  fi: 'fi',
};

function protectBrands(text) {
  let out = text;
  for (const [brand, token] of BRAND_PLACEHOLDERS) {
    out = out.split(brand).join(token);
  }
  return out;
}

function restoreBrands(text) {
  let out = text;
  for (const [brand, token] of BRAND_PLACEHOLDERS) {
    out = out.split(token).join(brand);
  }
  return out;
}

/** Protect {placeholder} tokens so Google Translate does not localize them. */
function protectPlaceholders(text) {
  const map = [];
  const protectedText = String(text).replace(/\{[a-zA-Z0-9_]+\}/g, (m) => {
    const token = `[[PH${map.length}]]`;
    map.push([token, m]);
    return token;
  });
  return { protectedText, map };
}

function restorePlaceholders(text, map) {
  let out = String(text);
  for (const [token, original] of map) {
    // Google may alter spacing/brackets slightly — try exact then loose
    if (out.includes(token)) {
      out = out.split(token).join(original);
    } else {
      const loose = token.replace(/[\[\]]/g, '\\$&');
      out = out.replace(new RegExp(loose, 'gi'), original);
    }
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateViaGoogle(text, targetLang) {
  const tl = GOOGLE_LANG_CODES[targetLang] || targetLang;
  const { protectedText, map } = protectPlaceholders(text);
  const q = protectBrands(protectedText);
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' +
    encodeURIComponent(tl) +
    '&dt=t&q=' +
    encodeURIComponent(q);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) {
    throw new Error(`Google translate HTTP ${res.status}`);
  }
  const data = await res.json();
  const translated = (data[0] || []).map((part) => part[0]).join('');
  return restorePlaceholders(restoreBrands(translated), map);
}

async function translateBatch(texts, targetLang, { delayMs = 120 } = {}) {
  const results = [];
  for (const text of texts) {
    if (!text || !text.trim()) {
      results.push(text);
      continue;
    }
    // Skip pure numbers / symbols
    if (/^[\d.,\s$€£¥%+\-]+$/.test(text)) {
      results.push(text);
      continue;
    }
    try {
      results.push(await translateViaGoogle(text, targetLang));
    } catch (err) {
      console.warn(`  translate failed (${targetLang}): ${text.slice(0, 40)}… — ${err.message}`);
      results.push(text);
    }
    await sleep(delayMs);
  }
  return results;
}

module.exports = {
  BRAND_PLACEHOLDERS,
  GOOGLE_LANG_CODES,
  protectBrands,
  restoreBrands,
  protectPlaceholders,
  restorePlaceholders,
  translateViaGoogle,
  translateBatch,
  sleep,
};
