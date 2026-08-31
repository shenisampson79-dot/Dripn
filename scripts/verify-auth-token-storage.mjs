/**
 * Auth token storage regression — web AsyncStorage vs native SecureStore.
 * Run: node scripts/verify-auth-token-storage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storePath = path.join(root, 'utils', 'secureTokenStore.ts');
const src = fs.readFileSync(storePath, 'utf8');
const failures = [];

function assert(name, cond) {
  if (!cond) failures.push(name);
  else console.log(`✓ ${name}`);
}

console.log('=== Auth token storage regression ===\n');

assert('secureTokenStore exists', fs.existsSync(storePath));

assert(
  'web platform gate present',
  /Platform\.OS === ['"]web['"]/.test(src) || /isWebPlatform/.test(src),
);

assert(
  'getSecureToken branches before native SecureStore on web',
  /if \(isWebPlatform\)[\s\S]*return getWebToken\(keys\)/.test(src),
);

assert(
  'setSecureToken uses web storage path',
  /if \(isWebPlatform\)[\s\S]*await setWebToken\(keys, token\)/.test(src),
);

assert(
  'clearSecureToken uses web storage path',
  /if \(isWebPlatform\)[\s\S]*await clearWebToken\(keys\)/.test(src),
);

assert(
  'native path still uses SecureStore get/set/delete',
  /SecureStore\.getItemAsync/.test(src)
    && /SecureStore\.setItemAsync/.test(src)
    && /SecureStore\.deleteItemAsync/.test(src),
);

assert(
  'web helpers use AsyncStorage only',
  /async function getWebToken[\s\S]*AsyncStorage\.getItem/.test(src)
    && /async function setWebToken[\s\S]*AsyncStorage\.setItem/.test(src)
    && /async function clearWebToken[\s\S]*AsyncStorage\.removeItem/.test(src),
);

const webGetBlock = src.match(/if \(isWebPlatform\) \{[\s\S]*?return getWebToken\(keys\);[\s\S]*?\}/)?.[0] || '';
assert(
  'web get path does not call SecureStore',
  webGetBlock.length > 0 && !/SecureStore/.test(webGetBlock),
);

const webSetBlock = src.match(/export async function setSecureToken[\s\S]*?if \(isWebPlatform\) \{[\s\S]*?\}/)?.[0] || '';
assert(
  'web set path does not call SecureStore',
  webSetBlock.length > 0 && !/SecureStore/.test(webSetBlock),
);

console.log('');
if (failures.length) {
  console.error('verify-auth-token-storage FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('verify-auth-token-storage: ok');
