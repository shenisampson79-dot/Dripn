import { Alert, Image, Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

export type WardrobeImageAssetMeta = {
  width?: number | null;
  height?: number | null;
  exif?: Record<string, unknown> | null;
};

export type CorrectedWardrobeImage = {
  uri: string;
  width: number;
  height: number;
  looksSideways: boolean;
  exifCorrected: boolean;
  autoRotated: boolean;
};

const JPEG_OPTIONS = {
  compress: 0.92,
  format: ImageManipulator.SaveFormat.JPEG,
} as const;

function getExifOrientation(exif?: Record<string, unknown> | null): number {
  if (!exif) return 1;
  const raw = exif.Orientation ?? exif.orientation;
  const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(parsed) ? parsed : 1;
}

function exifToRotationDegrees(orientation: number): number {
  switch (orientation) {
    case 3:
      return 180;
    case 6:
      return 90;
    case 8:
      return 270;
    default:
      return 0;
  }
}

export function isSidewaysWardrobePhoto(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return width > height * 1.05;
}

export function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function saveManipulated(
  uri: string,
  actions: ImageManipulator.Action[],
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, actions, JPEG_OPTIONS);
  return result.uri;
}

/** Re-encode picker image so EXIF orientation is baked into pixels (no extra rotation). */
async function bakePickerExifOrientation(uri: string): Promise<string> {
  return saveManipulated(uri, []);
}

export async function rotateWardrobeImage(
  uri: string,
  degrees: number,
): Promise<{ uri: string; width: number; height: number }> {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 0) {
    const dims = await getImageDimensions(uri);
    return { uri, ...dims };
  }
  const rotatedUri = await saveManipulated(uri, [{ rotate: normalized }]);
  const dims = await getImageDimensions(rotatedUri);
  return { uri: rotatedUri, ...dims };
}

export async function correctWardrobeImageOrientation(
  uri: string,
  asset?: WardrobeImageAssetMeta,
  options?: { autoRotateSideways?: boolean },
): Promise<CorrectedWardrobeImage> {
  const autoRotateSideways = options?.autoRotateSideways !== false;

  if (uri.startsWith('http') || uri.startsWith('data:')) {
    let width = asset?.width ?? 0;
    let height = asset?.height ?? 0;
    if ((!width || !height) && !uri.startsWith('data:')) {
      try {
        const dims = await getImageDimensions(uri);
        width = dims.width;
        height = dims.height;
      } catch {
        width = 1;
        height = 1;
      }
    }
    return {
      uri,
      width: width || 1,
      height: height || 1,
      looksSideways: isSidewaysWardrobePhoto(width || 1, height || 1),
      exifCorrected: false,
      autoRotated: false,
    };
  }

  const exifOrientation = getExifOrientation(asset?.exif);
  let workingUri = uri;
  let exifCorrected = false;

  if (Platform.OS === 'ios') {
    // iOS picker URIs are usually already decoded; re-encode once to bake EXIF.
    try {
      workingUri = await bakePickerExifOrientation(uri);
      exifCorrected = exifOrientation !== 1;
    } catch {
      workingUri = uri;
    }
  } else {
    const exifRotation = exifToRotationDegrees(exifOrientation);
    if (exifRotation !== 0) {
      workingUri = await saveManipulated(workingUri, [{ rotate: exifRotation }]);
      exifCorrected = true;
    }
  }

  let { width, height } = await getImageDimensions(workingUri);
  let looksSideways = isSidewaysWardrobePhoto(width, height);
  let autoRotated = false;

  // Flat-lay wardrobe shots are often landscape in the camera roll — rotate to portrait.
  // Skip when EXIF already oriented the photo (stacking both caused upside-down results).
  if (looksSideways && autoRotateSideways && !exifCorrected) {
    const rotated = await rotateWardrobeImage(workingUri, 90);
    workingUri = rotated.uri;
    width = rotated.width;
    height = rotated.height;
    looksSideways = isSidewaysWardrobePhoto(width, height);
    autoRotated = true;
  }

  return {
    uri: workingUri,
    width,
    height,
    looksSideways,
    exifCorrected,
    autoRotated,
  };
}

export async function prepareWardrobeImagesFromPickerAssets(
  assets: Array<{ uri: string; width?: number; height?: number; exif?: Record<string, unknown> | null }>,
  options?: { autoRotateSideways?: boolean },
): Promise<{ uris: string[]; autoRotatedCount: number }> {
  const uris: string[] = [];
  let autoRotatedCount = 0;

  for (const asset of assets) {
    const corrected = await correctWardrobeImageOrientation(asset.uri, asset, options);
    uris.push(corrected.uri);
    if (corrected.autoRotated) autoRotatedCount += 1;
  }

  return { uris, autoRotatedCount };
}

export function promptWardrobeOrientationReview(
  corrected: CorrectedWardrobeImage,
  onResolved: (uri: string) => void,
): void {
  if (!corrected.looksSideways) {
    onResolved(corrected.uri);
    return;
  }

  Alert.alert(
    'Photo orientation',
    'This photo looks sideways. Rotate it for a better wardrobe preview, or keep it as is.',
    [
      {
        text: 'Keep as is',
        style: 'cancel',
        onPress: () => onResolved(corrected.uri),
      },
      {
        text: 'Rotate left',
        onPress: () => {
          rotateWardrobeImage(corrected.uri, -90)
            .then((rotated) => onResolved(rotated.uri))
            .catch(() => onResolved(corrected.uri));
        },
      },
      {
        text: 'Rotate right',
        onPress: () => {
          rotateWardrobeImage(corrected.uri, 90)
            .then((rotated) => onResolved(rotated.uri))
            .catch(() => onResolved(corrected.uri));
        },
      },
    ],
  );
}
