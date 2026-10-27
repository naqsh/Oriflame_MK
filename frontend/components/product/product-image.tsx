import Image from "next/image";

import type { ProductImage as ProductImageData } from "@/lib/api/schemas/catalogue";
import { authorisedImageSrc } from "@/lib/images";
import { cn } from "@/lib/utils/cn";

const SIZE = 600;
/** Listing grids: 2 columns on phones, 3 on tablets, 4 on desktop. */
const GRID_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * A product image from an authorised source (lib/images.ts), or a neutral placeholder.
 * Images from any other host are never rendered.
 * `preload` is for the one image that is likely the page's LCP element (the PDP main image).
 */
export function ProductImage({
  image,
  productName,
  className,
  sizes = GRID_SIZES,
  preload = false,
}: {
  image: ProductImageData | null;
  productName: string;
  className?: string;
  sizes?: string;
  preload?: boolean;
}) {
  const src = image ? authorisedImageSrc(image.url) : null;
  if (!image || !src) {
    return (
      <div
        role="img"
        aria-label={`No image available for ${productName}`}
        className={cn(
          "flex aspect-square w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground",
          className,
        )}
      >
        No image
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={image.alt_text.trim() || productName}
      width={SIZE}
      height={SIZE}
      sizes={sizes}
      preload={preload}
      className={cn("aspect-square w-full rounded-md object-cover", className)}
    />
  );
}
