declare function encodeJpegUint8(
  imgData: { data: Uint8Array; width: number; height: number },
  quality?: number,
): { data: Uint8Array; width: number; height: number };

export default encodeJpegUint8;
