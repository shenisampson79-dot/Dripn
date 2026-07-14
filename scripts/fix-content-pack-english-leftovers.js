#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..', 'data', 'content');

const fashionFixes = {
  sv: {
    '15': { title: 'Tryckskalan spelar roll' },
    '26': { title: 'Halvt instoppad' },
    '53': { title: 'Vardagscasual vs slarvig' },
    '54': { title: 'Ansträngning på dejt' },
  },
  da: {
    '26': { title: 'Det halve optræk' },
  },
  no: {
    '15': { title: 'Mønsterskala betyr noe' },
    '26': { title: 'Halvstopp' },
    '50': { title: 'Kle deg til anledningen pluss én' },
  },
};

const blogFixes = {
  sv: {
    'fallback-color-guide': { tips: { 1: { title: 'Deep/True Winter förklarat' } } },
    'fallback-1': { tips: { 2: { title: 'Tyst lyx 2.0' } } },
    'fallback-2': { tips: { 1: { title: 'Lageressentials' } } },
    'fallback-5': {
      subject: 'Dripn Weekly: Konsten att accessoarera',
      tips: { 1: { title: 'Metallmixens magi' } },
    },
    'fallback-7': { tips: { 2: { title: 'Heritage-kappan' } } },
    'fallback-14': {
      subject: 'Dripn Weekly: Kroppsförtroende – varje kropp är en modekropp',
      headline: 'Varje kropp är en modekropp: Din guide till radikal självacceptans',
    },
    'fallback-21': { subject: 'Dripn Weekly: Den ultimata tygguiden' },
    'fallback-24': { tips: { 1: { title: 'Crossbodyväskan' } } },
    'fallback-27': { tips: { 3: { title: 'Auktoritetsklädsel' } } },
  },
  da: {
    'fallback-5': { tips: { 1: { title: 'Metalblandingens magi' } } },
    'fallback-7': { tips: { 2: { title: 'Heritage-frakken' } } },
    'fallback-24': { tips: { 1: { title: 'Crossbody-tasken' } } },
    'fallback-27': { tips: { 3: { title: 'Autoritetspåklædning' } } },
  },
  no: {
    'fallback-1': { tips: { 2: { title: 'Stille luksus 2.0' } } },
    'fallback-6': { tips: { 1: { title: 'Leppestiftkraft' } } },
    'fallback-7': { tips: { 2: { title: 'Heritage-kåpen' } } },
    'fallback-14': {
      headline: 'Hver kropp er en mote-kropp: Din guide til radikal selvaksept',
    },
    'fallback-24': { tips: { 1: { title: 'Crossbody-vesken' } } },
    'fallback-27': { tips: { 3: { title: 'Autoritetskledning' } } },
  },
  fi: {
    'fallback-2': { tips: { 1: { title: 'Kerrospukeutumisen peruspalaset' } } },
    'fallback-8': { tips: { 0: { title: 'Laivastonsininen: luottamuksen rakentaja' } } },
    'fallback-17': { tips: { 0: { title: 'Istuisuus ennen muotisääntöjä' } } },
    'fallback-22': { tips: { 2: { title: 'Kantapään korkeudet' } } },
  },
};

function stripJunk(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\s*[—–-]\s*(modetips|modetip|motetips|muotivinkki|muotivihje|fashion tip)\s*$/i, '')
    .replace(/^Modestilstips med titeln:\s*/i, '')
    .replace(/^Motestiltips med tittelen:\s*/i, '')
    .replace(/^Modetips med titlen:\s*/i, '')
    .replace(/^Muotivinkki otsikolla:\s*/i, '')
    .trim();
}

function walkStrip(o) {
  if (Array.isArray(o)) o.forEach(walkStrip);
  else if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'string') o[k] = stripJunk(o[k]);
      else walkStrip(o[k]);
    }
  }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

for (const [lang, fixes] of Object.entries(fashionFixes)) {
  const p = path.join(base, 'fashionRules', `${lang}.json`);
  const f = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [id, patch] of Object.entries(fixes)) Object.assign(f[id], patch);
  walkStrip(f);
  writeJson(p, f);
  console.log('patched fashion', lang);
}

for (const lang of ['nl', 'pl', 'sv', 'da', 'no', 'fi']) {
  const p = path.join(base, 'fashionRules', `${lang}.json`);
  const f = JSON.parse(fs.readFileSync(p, 'utf8'));
  walkStrip(f);
  writeJson(p, f);
}

for (const [lang, fixes] of Object.entries(blogFixes)) {
  const p = path.join(base, 'blog', `${lang}.json`);
  const b = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [id, patch] of Object.entries(fixes)) {
    const post = b.find((x) => x.id === id);
    if (!post) {
      console.error('missing', lang, id);
      continue;
    }
    if (patch.subject) post.subject = patch.subject;
    if (patch.headline) post.headline = patch.headline;
    if (patch.tips) {
      for (const [ji, tipPatch] of Object.entries(patch.tips)) {
        Object.assign(post.tips[Number(ji)], tipPatch);
      }
    }
  }
  walkStrip(b);
  writeJson(p, b);
  console.log('patched blog', lang);
}

for (const lang of ['nl', 'pl', 'sv', 'da', 'no', 'fi']) {
  const p = path.join(base, 'blog', `${lang}.json`);
  const b = JSON.parse(fs.readFileSync(p, 'utf8'));
  walkStrip(b);
  writeJson(p, b);
}

console.log('done');
