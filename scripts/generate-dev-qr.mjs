import QRCode from 'qrcode';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lanIp = process.argv[2] || '192.168.0.184';
const devUrl = `exp+dripn://expo-development-client/?url=http://${lanIp}:8081`;
const outDir = path.join(__dirname, '..', 'dev-qr');
const outFile = path.join(outDir, 'dripn-dev-client-qr.png');

await mkdir(outDir, { recursive: true });
await QRCode.toFile(outFile, devUrl, { width: 512, margin: 2 });
await writeFile(
  path.join(outDir, 'dev-url.txt'),
  `${devUrl}\n`,
  'utf8',
);

console.log('DEV_URL=' + devUrl);
console.log('QR_FILE=' + outFile);
