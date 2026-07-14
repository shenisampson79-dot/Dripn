const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'data', 'content');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Unquote a JS string literal (single or double). */
function unquote(strLit) {
  const q = strLit[0];
  let s = strLit.slice(1, -1);
  if (q === "'") {
    s = s.replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  } else {
    s = s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  }
  return s;
}

/** Parse a JS array of string literals: ['a', "b", ...] */
function parseStringArray(src) {
  const out = [];
  const re = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"/g;
  let m;
  while ((m = re.exec(src))) {
    out.push(unquote(m[0]));
  }
  return out;
}

/** Extract balanced `{...}` starting at index of `{`. */
function extractBalanced(src, startIdx) {
  if (src[startIdx] !== '{') throw new Error('expected { at ' + startIdx);
  let depth = 0;
  let inStr = null;
  let escape = false;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  throw new Error('unbalanced brace from ' + startIdx);
}

/** Extract first `en: { ... }` object body after a marker (returns inside braces). */
function extractEnObject(src, afterMarker) {
  const markerIdx = src.indexOf(afterMarker);
  if (markerIdx < 0) throw new Error('marker not found: ' + afterMarker);
  const enIdx = src.indexOf('en:', markerIdx);
  if (enIdx < 0) throw new Error('en: not found after ' + afterMarker);
  const braceIdx = src.indexOf('{', enIdx);
  return extractBalanced(src, braceIdx);
}

function exportFashionRules() {
  const src = fs.readFileSync(path.join(ROOT, 'data', 'fashionRules.ts'), 'utf8');
  const start = src.indexOf('export const FASHION_RULES');
  if (start < 0) throw new Error('FASHION_RULES not found');
  const eqIdx = src.indexOf('=', start);
  const arrStart = src.indexOf('[', eqIdx);
  // Find matching ] for array — naive depth on brackets respecting strings
  let depth = 0;
  let inStr = null;
  let escape = false;
  let arrEnd = -1;
  for (let i = arrStart; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"') {
      inStr = c;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        arrEnd = i;
        break;
      }
    }
  }
  const arrBody = src.slice(arrStart + 1, arrEnd);

  // Split top-level objects by finding `{ id:` patterns
  const rules = {};
  const idRe = /\{\s*id:\s*(\d+)\s*,/g;
  let m;
  const starts = [];
  while ((m = idRe.exec(arrBody))) {
    starts.push({ id: m[1], idx: m.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const { id, idx } = starts[i];
    const objSrc = extractBalanced(arrBody, idx);
    const titleM = objSrc.match(/title:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
    const contentM = objSrc.match(/content:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
    if (!titleM || !contentM) throw new Error('missing title/content for id ' + id);
    const entry = {
      title: unquote(titleM[1]),
      content: unquote(contentM[1]),
    };
    const swIdx = objSrc.indexOf('colorSwatches:');
    if (swIdx >= 0) {
      const swArrStart = objSrc.indexOf('[', swIdx);
      // extract array
      let d = 0;
      let ins = null;
      let esc = false;
      let end = -1;
      for (let j = swArrStart; j < objSrc.length; j++) {
        const c = objSrc[j];
        if (ins) {
          if (esc) {
            esc = false;
            continue;
          }
          if (c === '\\') {
            esc = true;
            continue;
          }
          if (c === ins) ins = null;
          continue;
        }
        if (c === "'" || c === '"') {
          ins = c;
          continue;
        }
        if (c === '[') d++;
        else if (c === ']') {
          d--;
          if (d === 0) {
            end = j;
            break;
          }
        }
      }
      const swBody = objSrc.slice(swArrStart, end + 1);
      const names = [...swBody.matchAll(/name:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)].map((x) =>
        unquote(x[1]),
      );
      const colorSwatches = {};
      for (const n of names) colorSwatches[n] = n;
      entry.colorSwatches = colorSwatches;
    }
    rules[id] = entry;
  }
  return rules;
}

function parseBandTemplate(bandBody) {
  function fieldArray(name) {
    const re = new RegExp(name + ':\\s*\\[');
    const m = bandBody.match(re);
    if (!m) throw new Error('missing array field ' + name);
    const start = bandBody.indexOf('[', m.index);
    let d = 0;
    let ins = null;
    let esc = false;
    for (let i = start; i < bandBody.length; i++) {
      const c = bandBody[i];
      if (ins) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === ins) ins = null;
        continue;
      }
      if (c === "'" || c === '"') {
        ins = c;
        continue;
      }
      if (c === '[') d++;
      else if (c === ']') {
        d--;
        if (d === 0) return parseStringArray(bandBody.slice(start, i + 1));
      }
    }
    throw new Error('unclosed array ' + name);
  }
  function fieldString(name) {
    const re = new RegExp(
      name + ':\\s*(?:\\n\\s*)?(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*")',
    );
    const m = bandBody.match(re);
    if (!m) throw new Error('missing string field ' + name);
    return unquote(m[1]);
  }
  return {
    layers: fieldArray('layers'),
    keyPiecesFemale: fieldArray('keyPiecesFemale'),
    keyPiecesMale: fieldArray('keyPiecesMale'),
    accessories: fieldArray('accessories'),
    colors: fieldArray('colors'),
    fabricTips: fieldString('fabricTips'),
    stylingNoteTemplate: fieldString('stylingNoteTemplate'),
  };
}

function exportWeather() {
  const src = fs.readFileSync(path.join(ROOT, 'data', 'weatherOutfitCopy.ts'), 'utf8');

  // descriptions
  const descObj = extractEnObject(src, 'export const WEATHER_DESCRIPTIONS');
  const descriptions = {};
  for (const m of descObj.matchAll(/(\d+):\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)) {
    descriptions[m[1]] = unquote(m[2]);
  }

  const fallbackM = src.match(
    /WEATHER_DESCRIPTION_FALLBACK[\s\S]*?en:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/,
  );
  if (!fallbackM) throw new Error('descriptionFallback not found');

  const defaultDesc = 'Partly cloudy'; // getDefaultWeatherDescription en
  const locationFallback = 'Your Location';

  const unknownObj = extractEnObject(src, 'export const UNKNOWN_LOCATION');
  const unknownLocation = {};
  for (const key of ['yourLocation', 'yourLocationTitle', 'unknown']) {
    const m = unknownObj.match(
      new RegExp(key + ':\\s*(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*")'),
    );
    if (!m) throw new Error('UNKNOWN_LOCATION.' + key);
    unknownLocation[key] = unquote(m[1]);
  }

  // bands — EN object of OUTFIT_BANDS
  const bandsEn = extractEnObject(src, 'export const OUTFIT_BANDS');
  const bands = {};
  for (const band of ['hot', 'warm', 'mild', 'cold', 'freezing']) {
    const bandKeyIdx = bandsEn.search(new RegExp('\\b' + band + '\\s*:'));
    if (bandKeyIdx < 0) throw new Error('band missing: ' + band);
    const braceIdx = bandsEn.indexOf('{', bandKeyIdx);
    const body = extractBalanced(bandsEn, braceIdx);
    bands[band] = parseBandTemplate(body);
  }

  // overlays
  function overlayBlock(constName) {
    const idx = src.indexOf('const ' + constName);
    if (idx < 0) throw new Error(constName + ' not found');
    return extractEnObject(src.slice(idx), 'const ' + constName);
  }

  const rainBody = overlayBlock('RAIN_OVERLAY');
  const snowBody = overlayBlock('SNOW_OVERLAY');
  const windBody = overlayBlock('WIND_OVERLAY');

  function strField(body, name) {
    const m = body.match(
      new RegExp(name + ':\\s*(?:\\n\\s*)?(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*")'),
    );
    return m ? unquote(m[1]) : undefined;
  }
  function arrField(body, name) {
    const m = body.match(new RegExp(name + ':\\s*\\['));
    if (!m) return undefined;
    const start = body.indexOf('[', m.index);
    let d = 0;
    let ins = null;
    let esc = false;
    for (let i = start; i < body.length; i++) {
      const c = body[i];
      if (ins) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === ins) ins = null;
        continue;
      }
      if (c === "'" || c === '"') {
        ins = c;
        continue;
      }
      if (c === '[') d++;
      else if (c === ']') {
        d--;
        if (d === 0) return parseStringArray(body.slice(start, i + 1));
      }
    }
    return undefined;
  }

  const overlays = {
    rain: {
      keyPiece: strField(rainBody, 'keyPiece'),
      accessories: arrField(rainBody, 'accessories'),
      fabricTipsSuffix: strField(rainBody, 'fabricTipsSuffix'),
      stylingNoteSuffix: strField(rainBody, 'stylingNoteSuffix'),
    },
    snow: {
      accessories: arrField(snowBody, 'accessories'),
      stylingNoteSuffix: strField(snowBody, 'stylingNoteSuffix'),
    },
    wind: {
      // source uses singular `accessory`; also expose as accessories[0] for pack shape
      accessory: strField(windBody, 'accessory'),
      accessories: [strField(windBody, 'accessory')],
      stylingNoteSuffix: strField(windBody, 'stylingNoteSuffix'),
    },
  };

  // dailyRange — static arrays + template strings derived from arrow functions
  const dailyEn = extractEnObject(src, 'const DAILY_RANGE_COPY');
  const dailyRange = {
    layersHotMorning: arrField(dailyEn, 'layersHotMorning'),
    layersHotDay: arrField(dailyEn, 'layersHotDay'),
    sunglasses: strField(dailyEn, 'sunglasses'),
    // Templates mirror heatSwingNote / wideSwingNote / modestSwingNote EN implementations
    heatSwingNoteTemplate:
      '{lowTemp}°C now, peaking at {peakTemp}°C — dress for the heat. A light layer is only for the cool morning if you need it.',
    wideSwingLayer: strField(dailyEn, 'wideSwingLayer'),
    wideSwingNoteTemplate: '{lowTemp}-{peakTemp}°C today — layer so you can adjust as the day warms up or cools down.',
    modestSwingNoteTemplate: 'Day range {lowTemp}-{peakTemp}°C. {existing}',
    coldMorningFemale: arrField(dailyEn, 'coldMorningFemale'),
    coldMorningMale: arrField(dailyEn, 'coldMorningMale'),
    coldMorningLayers: arrField(dailyEn, 'coldMorningLayers'),
  };

  // Verify templates against source arrow bodies by extracting template literal guts
  function extractArrowTemplate(fnName) {
    const re = new RegExp(
      fnName +
        ':\\s*\\([^)]*\\)\\s*=>\\s*\\n?\\s*`([\\s\\S]*?)`',
    );
    const m = dailyEn.match(re);
    if (!m) throw new Error('arrow template not found: ' + fnName);
    return m[1]
      .replace(/\$\{lowTemp\}/g, '{lowTemp}')
      .replace(/\$\{peakTemp\}/g, '{peakTemp}')
      .replace(/\$\{existing\}/g, '{existing}');
  }
  dailyRange.heatSwingNoteTemplate = extractArrowTemplate('heatSwingNote');
  dailyRange.wideSwingNoteTemplate = extractArrowTemplate('wideSwingNote');
  dailyRange.modestSwingNoteTemplate = extractArrowTemplate('modestSwingNote');

  return {
    descriptions,
    descriptionFallback: unquote(fallbackM[1]),
    defaultDescription: defaultDesc,
    locationFallback,
    unknownLocation,
    bands,
    overlays,
    dailyRange,
  };
}

function exportBlog() {
  const src = fs.readFileSync(path.join(ROOT, 'data', 'blog', 'fallbackPosts.en.ts'), 'utf8');
  const returnIdx = src.indexOf('return [');
  if (returnIdx < 0) throw new Error('blog return [ not found');
  const arrStart = src.indexOf('[', returnIdx);

  // Find end of top-level array
  let depth = 0;
  let inStr = null;
  let escape = false;
  let arrEnd = -1;
  for (let i = arrStart; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        arrEnd = i;
        break;
      }
    }
  }
  const arrBody = src.slice(arrStart + 1, arrEnd);

  // Find each top-level post object: starts with `{` preceded by newline/comma at depth 0
  const posts = [];
  // Walk for objects at depth 0
  depth = 0;
  inStr = null;
  escape = false;
  for (let i = 0; i < arrBody.length; i++) {
    const c = arrBody[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{' && depth === 0) {
      const obj = extractBalanced(arrBody, i);
      posts.push(parseBlogPost(obj));
      i += obj.length - 1;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return posts;
}

function parseBlogPost(objSrc) {
  function str(name) {
    const m = objSrc.match(
      new RegExp(name + ':\\s*(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*")'),
    );
    if (!m) throw new Error('blog field missing: ' + name);
    return unquote(m[1]);
  }
  function tags() {
    const m = objSrc.match(/tags:\s*\[/);
    if (!m) throw new Error('tags missing');
    const start = objSrc.indexOf('[', m.index);
    let d = 0;
    let ins = null;
    let esc = false;
    for (let i = start; i < objSrc.length; i++) {
      const c = objSrc[i];
      if (ins) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === ins) ins = null;
        continue;
      }
      if (c === "'" || c === '"') {
        ins = c;
        continue;
      }
      if (c === '[') d++;
      else if (c === ']') {
        d--;
        if (d === 0) return parseStringArray(objSrc.slice(start, i + 1));
      }
    }
    throw new Error('tags unclosed');
  }

  const daysM = objSrc.match(
    /publishedAt:\s*new Date\(Date\.now\(\)\s*-\s*([0-9.]+)\s*\*\s*24/,
  );
  const publishedDaysOffset = daysM ? Number(daysM[1]) : 0;

  // tips array
  const tipsIdx = objSrc.indexOf('tips:');
  const tipsArrStart = objSrc.indexOf('[', tipsIdx);
  let d = 0;
  let ins = null;
  let esc = false;
  let tipsEnd = -1;
  for (let i = tipsArrStart; i < objSrc.length; i++) {
    const c = objSrc[i];
    if (ins) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === ins) {
        ins = null;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      ins = c;
      continue;
    }
    if (c === '[') d++;
    else if (c === ']') {
      d--;
      if (d === 0) {
        tipsEnd = i;
        break;
      }
    }
  }
  const tipsBody = objSrc.slice(tipsArrStart + 1, tipsEnd);
  const tips = [];
  d = 0;
  ins = null;
  esc = false;
  for (let i = 0; i < tipsBody.length; i++) {
    const c = tipsBody[i];
    if (ins) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === ins) {
        ins = null;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      ins = c;
      continue;
    }
    if (c === '{' && d === 0) {
      const tipObj = extractBalanced(tipsBody, i);
      const title = tipObj.match(/title:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
      const content = tipObj.match(/content:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
      const proTip = tipObj.match(/proTip:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
      if (!title || !content || !proTip) throw new Error('tip fields missing');
      tips.push({
        title: unquote(title[1]),
        content: unquote(content[1]),
        proTip: unquote(proTip[1]),
      });
      i += tipObj.length - 1;
      continue;
    }
    if (c === '{') d++;
    else if (c === '}') d--;
  }

  return {
    id: str('id'),
    subject: str('subject'),
    headline: str('headline'),
    previewText: str('previewText'),
    introduction: str('introduction'),
    category: str('category'),
    tags: tags(),
    publishedDaysOffset,
    tips,
  };
}

function main() {
  const fashionDir = path.join(OUT_ROOT, 'fashionRules');
  const weatherDir = path.join(OUT_ROOT, 'weather');
  const blogDir = path.join(OUT_ROOT, 'blog');
  ensureDir(fashionDir);
  ensureDir(weatherDir);
  ensureDir(blogDir);

  const fashion = exportFashionRules();
  const fashionPath = path.join(fashionDir, 'en.json');
  writeJson(fashionPath, fashion);

  const weather = exportWeather();
  const weatherPath = path.join(weatherDir, 'en.json');
  writeJson(weatherPath, weather);

  const blog = exportBlog();
  const blogPath = path.join(blogDir, 'en.json');
  writeJson(blogPath, blog);

  const fashionKeys = Object.keys(fashion).length;
  console.log('Wrote', fashionPath);
  console.log('  fashionRules keys:', fashionKeys);
  console.log('Wrote', weatherPath);
  console.log('  weather descriptions:', Object.keys(weather.descriptions).length);
  console.log('  weather bands:', Object.keys(weather.bands).join(', '));
  console.log('Wrote', blogPath);
  console.log('  blog posts:', blog.length);

  if (fashionKeys !== 105) {
    console.error('ERROR: expected 105 fashion rules, got', fashionKeys);
    process.exit(1);
  }
  if (blog.length !== 28) {
    console.error('ERROR: expected 28 blog posts, got', blog.length);
    process.exit(1);
  }
  // parse check
  JSON.parse(fs.readFileSync(weatherPath, 'utf8'));
  console.log('OK: weather/en.json parses');
}

main();
