/**
 * Ambient type for jpeg-js (no @types package required).
 */
declare module 'jpeg-js' {
  export function decode(
    data: Uint8Array | Buffer,
    options?: { useTArray?: boolean; formatAsRGBA?: boolean; tolerantDecoding?: boolean },
  ): { width: number; height: number; data: Uint8Array; exifBuffer?: Uint8Array };
}
