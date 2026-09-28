// Vercel rejects request bodies over 4.5 MB, and base64 adds about a third. Keep uploads well under.
export const MAX_PDF_BYTES = 3_000_000;
const MAX_DATA_URL_CHARS = 3_200_000;
const MAX_DIMENSION = 1800;

export interface PreparedUpload {
  dataUrl: string;
  mimeType: string;
  fileName: string;
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });

const canvasToDataUrl = (canvas: HTMLCanvasElement, quality: number) => canvas.toDataURL('image/jpeg', quality);

/** Downscales a photo to a JPEG that fits the upload limit. PDFs pass through if small enough. */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error('That PDF is over 3 MB. Split it into fewer pages, or take a photo of the recipe instead.');
    }
    return { dataUrl: await readAsDataUrl(file), mimeType: file.type, fileName: file.name };
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a photo, screenshot, or PDF.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Format the browser cannot decode (for example HEIC on some browsers): send as-is only if small.
    const dataUrl = await readAsDataUrl(file);
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error('That image format is too large to upload. Try a JPEG or PNG screenshot.');
    }
    return { dataUrl, mimeType: file.type, fileName: file.name };
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.85;
  let dataUrl = canvasToDataUrl(canvas, quality);
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvasToDataUrl(canvas, quality);
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error('That photo is too large to upload. Try cropping it to just the recipe.');
  }
  return { dataUrl, mimeType: 'image/jpeg', fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
}
