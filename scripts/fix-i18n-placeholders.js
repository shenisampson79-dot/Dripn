#!/usr/bin/env node
/** Restore {current}/{total}/{n}/{count}/{x}/{y} placeholders mangled by machine translation. */
const fs = require('fs');
const path = require('path');

const EN = JSON.parse(fs.readFileSync(path.join(__dirname, 'en-flat.json'), 'utf8'));
const LOCALES = path.join(__dirname, '../locales');

const PLACEHOLDER_KEYS = Object.keys(EN).filter((k) => /\{[a-z]+\}/.test(EN[k]));

function restorePlaceholders(translated, english) {
  if (!translated || !english) return translated;
  const enPh = english.match(/\{[a-z]+\}/g) || [];
  if (enPh.length === 0) return translated;
  // If all English placeholders already present, keep
  if (enPh.every((ph) => translated.includes(ph))) return translated;
  // Replace common mangled variants then force-inject missing ones
  let out = translated
    .replace(/\{actual\}/gi, '{current}')
    .replace(/\{courant\}/gi, '{current}')
    .replace(/\{aktuell\}/gi, '{current}')
    .replace(/\{attuale\}/gi, '{current}')
    .replace(/\{atual\}/gi, '{current}')
    .replace(/\{huidig\}/gi, '{current}')
    .replace(/\{obecny\}/gi, '{current}')
    .replace(/\{текущий\}/gi, '{current}')
    .replace(/\{m\}/g, '{total}')
    .replace(/\{N\}/g, '{n}');
  if (enPh.every((ph) => out.includes(ph))) return out;
  // Fallback: use English string (better than broken placeholders)
  return english;
}

let fixed = 0;
for (const file of fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json'))) {
  const p = path.join(LOCALES, file);
  const loc = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;
  for (const key of PLACEHOLDER_KEYS) {
    if (!loc[key]) continue;
    const next = restorePlaceholders(loc[key], EN[key]);
    if (next !== loc[key]) {
      loc[key] = next;
      changed = true;
      fixed++;
    }
  }
  if (changed) fs.writeFileSync(p, JSON.stringify(loc, null, 2) + '\n');
}
console.log('Restored placeholders in', fixed, 'entries');
const es = JSON.parse(fs.readFileSync(path.join(LOCALES, 'es.json'), 'utf8'));
console.log('es surpriseMe.stepOf =', es['surpriseMe.stepOf']);
console.log('es weeklyPlanner.aiWillCreate =', es['weeklyPlanner.aiWillCreate']);
