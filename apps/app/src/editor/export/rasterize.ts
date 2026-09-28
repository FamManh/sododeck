import { pngSize } from './png-size';
import type { PngScale } from './types';

export async function rasterize(
  svg: string,
  bounds: { width: number; height: number },
  scale: PngScale,
): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const size = pngSize(bounds, scale);
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('png-failed');
    context.drawImage(image, 0, 0, size.width, size.height);
    const png = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (png === null) throw new Error('png-failed');
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}
