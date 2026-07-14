#!/usr/bin/env node
/**
 * Generate full content packs (fashionRules + blog) for nl, pl, sv, da, no, fi.
 * Weather packs are hand-authored separately.
 */
const fs = require('fs');
const path = require('path');
const { translateViaGoogle, sleep } = require('./locale-translator');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'data', 'content');
const LANGS = ['nl', 'pl', 'sv', 'da', 'no', 'fi'];
const CONCURRENCY = 4;

async function mapConcurrent(items, fn, limit = CONCURRENCY) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function t(text, lang, retries = 5) {
  if (text == null) return text;
  if (typeof text !== 'string') return text;
  if (!text.trim()) return text;
  if (/^[\d.,\s$€£¥%+\-]+$/.test(text)) return text;
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await sleep(60 + attempt * 200);
      return await translateViaGoogle(text, lang);
    } catch (err) {
      lastErr = err;
      console.warn(`  retry ${attempt + 1}/${retries}: ${err.message}`);
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

async function translateFashion(en, lang) {
  const out = {};
  const entries = Object.entries(en);
  await mapConcurrent(entries, async ([id, rule]) => {
    const translated = {
      title: await t(rule.title, lang),
      content: await t(rule.content, lang),
    };
    if (rule.colorSwatches) {
      translated.colorSwatches = {};
      for (const [key, val] of Object.entries(rule.colorSwatches)) {
        // Keys stay English (lookup); values translate
        translated.colorSwatches[key] = await t(val, lang);
      }
    }
    out[id] = translated;
    process.stdout.write(`  fashion ${lang} #${id}\r`);
  });
  // Preserve key order 1..105
  const ordered = {};
  for (const id of Object.keys(en)) ordered[id] = out[id];
  return ordered;
}

async function translateBlog(enPosts, lang) {
  const out = [];
  for (let i = 0; i < enPosts.length; i++) {
    const post = enPosts[i];
    const tips = [];
    for (const tip of post.tips) {
      const tipOut = {
        title: await t(tip.title, lang),
        content: await t(tip.content, lang),
      };
      if (tip.proTip) tipOut.proTip = await t(tip.proTip, lang);
      tips.push(tipOut);
      await sleep(30);
    }
    out.push({
      id: post.id,
      subject: await t(post.subject, lang),
      headline: await t(post.headline, lang),
      previewText: await t(post.previewText, lang),
      introduction: await t(post.introduction, lang),
      category: post.category, // keep English
      tags: [...post.tags], // keep English
      publishedDaysOffset: post.publishedDaysOffset,
      tips,
    });
    console.log(`  blog ${lang} ${i + 1}/${enPosts.length} ${post.id}`);
  }
  return out;
}

async function main() {
  const fashionEn = JSON.parse(fs.readFileSync(path.join(CONTENT, 'fashionRules', 'en.json'), 'utf8'));
  const blogEn = JSON.parse(fs.readFileSync(path.join(CONTENT, 'blog', 'en.json'), 'utf8'));

  const only = process.argv.find((a) => a.startsWith('--lang='))?.split('=')[1];
  const langs = only ? [only] : LANGS;
  const skipFashion = process.argv.includes('--blog-only');
  const skipBlog = process.argv.includes('--fashion-only');

  for (const lang of langs) {
    console.log(`\n=== ${lang} ===`);
    if (!skipFashion) {
      console.log(`Translating fashionRules (${Object.keys(fashionEn).length})…`);
      const fashion = await translateFashion(fashionEn, lang);
      fs.writeFileSync(
        path.join(CONTENT, 'fashionRules', `${lang}.json`),
        JSON.stringify(fashion, null, 2) + '\n'
      );
      console.log(`  wrote fashionRules/${lang}.json (${Object.keys(fashion).length} rules)`);
    }
    if (!skipBlog) {
      console.log(`Translating blog (${blogEn.length})…`);
      const blog = await translateBlog(blogEn, lang);
      fs.writeFileSync(path.join(CONTENT, 'blog', `${lang}.json`), JSON.stringify(blog, null, 2) + '\n');
      console.log(`  wrote blog/${lang}.json (${blog.length} posts)`);
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
