import { pictureLayout, type CropRect } from '@sododeck/model';
import type { Size } from '@sododeck/schema';

export interface PictureViewProps {
  url: string;
  alt: string;
  /** The image's box on the canvas (its stored size). */
  width: number;
  height: number;
  natural: Size;
  crop: CropRect | undefined;
  flipX: boolean;
  flipY: boolean;
}

/**
 * A cropped or flipped picture (057): a clipping box at `pictureLayout`'s view, holding the whole
 * picture placed so only the cropped region shows, mirrored about its own centre. Only the picture
 * is mirrored; the caption, the lock glyph and the placeholder stay as they are. The SVG export
 * draws from the same layout, so the canvas and the export agree.
 */
export function PictureView({
  url,
  alt,
  width,
  height,
  natural,
  crop,
  flipX,
  flipY,
}: PictureViewProps) {
  const { view, picture } = pictureLayout({ x: 0, y: 0, width, height }, natural, crop, {
    flipX,
    flipY,
  });
  return (
    <div
      data-testid="image-view"
      className="absolute overflow-hidden rounded-[4px]"
      style={{ left: view.x, top: view.y, width: view.width, height: view.height }}
    >
      <img
        src={url}
        alt={alt}
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          left: picture.x - view.x,
          top: picture.y - view.y,
          width: picture.width,
          height: picture.height,
          ...(flipX || flipY
            ? { transform: `scale(${flipX ? '-1' : '1'}, ${flipY ? '-1' : '1'})` }
            : {}),
        }}
      />
    </div>
  );
}
