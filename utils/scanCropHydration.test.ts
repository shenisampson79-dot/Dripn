/**
 * GON regression matrix — scan colour identity + outfit-list image hydration.
 * Cases map to docs/GON_ACCEPTANCE.md.
 */
import assert from 'node:assert/strict';
import {
  resolveScanCropDataSource,
  stripDataUri,
  safeFileId,
} from './scanCropSource';
import { hydrateGeneratedOutfitItems } from './hydrateGeneratedOutfitItems';

type Case = {
  id: string;
  title: string;
  run: () => void;
};

const MATRIX: Case[] = [
  {
    id: 'IMG-01',
    title: 'data: crop on item → materialize source is that crop',
    run: () => {
      const src = resolveScanCropDataSource({
        id: 'scan_pink',
        imageUri: 'data:image/jpeg;base64,PINK_CROP',
      });
      assert.equal(src, 'data:image/jpeg;base64,PINK_CROP');
    },
  },
  {
    id: 'IMG-02',
    title: 'empty item + cropById[scanId] → exact scan crop, not neighbor',
    run: () => {
      const src = resolveScanCropDataSource(
        { id: 'scan_teal', imageUri: '' },
        {
          scan_teal: 'TEAL_BYTES',
          scan_pink: 'PINK_BYTES',
        },
      );
      assert.equal(src, 'data:image/jpeg;base64,TEAL_BYTES');
      assert.ok(!src?.includes('PINK'));
    },
  },
  {
    id: 'IMG-03',
    title: 'file:// / https already loader-safe → no data: materialize',
    run: () => {
      assert.equal(
        resolveScanCropDataSource({
          id: 'scan_teal',
          imageUri: 'file:///cache/gon-scan-crops/scan_teal.jpg',
        }, { scan_teal: 'TEAL_BYTES' }),
        null,
      );
      assert.equal(
        resolveScanCropDataSource({
          id: 'w1',
          enhancedImageUri: 'https://cdn.example/wardrobe/w1.jpg',
        }),
        null,
      );
    },
  },
  {
    id: 'IMG-04',
    title: 'hydrate keeps scan id and prefers local crop over empty API',
    run: () => {
      const hydrated = hydrateGeneratedOutfitItems(
        [{ id: 'scan_teal', name: 'Teal Tank', category: 'tops', color: 'teal' }],
        [
          {
            id: 'scan_teal',
            name: 'Teal Tank',
            category: 'tops',
            color: 'teal',
            imageUri: 'data:image/jpeg;base64,TEAL_CROP',
            enhancedImageUri: 'data:image/jpeg;base64,TEAL_CROP',
            imageProcessed: true,
          },
        ],
      );
      assert.equal(String(hydrated[0].id), 'scan_teal');
      assert.equal(hydrated[0].imageUri, 'data:image/jpeg;base64,TEAL_CROP');
      const src = resolveScanCropDataSource(hydrated[0]);
      assert.equal(src, 'data:image/jpeg;base64,TEAL_CROP');
    },
  },
  {
    id: 'IMG-05',
    title: 'hydrate fills missing local image from API when same id',
    run: () => {
      const hydrated = hydrateGeneratedOutfitItems(
        [{
          id: 'scan_pink',
          name: 'Pink Dress Shirt',
          imageUrl: 'data:image/jpeg;base64,PINK_API',
        }],
        [
          {
            id: 'scan_pink',
            name: 'Pink Dress Shirt',
            category: 'tops',
            color: 'pink',
            imageUri: '',
          },
        ],
      );
      assert.equal(String(hydrated[0].id), 'scan_pink');
      assert.equal(hydrated[0].imageUri, 'data:image/jpeg;base64,PINK_API');
    },
  },
  {
    id: 'IMG-06',
    title: 'stripDataUri / safeFileId stay stable for cache paths',
    run: () => {
      assert.equal(stripDataUri('data:image/jpeg;base64,ABC'), 'ABC');
      assert.equal(safeFileId('scan/teal top!'), 'scan_teal_top_');
    },
  },
];

let failed = 0;
for (const c of MATRIX) {
  try {
    c.run();
    console.log(`PASS ${c.id} ${c.title}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${c.id} ${c.title}`);
    console.error(err);
  }
}

assert.equal(failed, 0, `${failed} GON image-hydration matrix case(s) failed`);
console.log(`scanCropHydration.test.ts: ${MATRIX.length} cases ok`);
