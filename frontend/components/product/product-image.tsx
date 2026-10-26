import Image from "next/image";

import type { ProductImage as ProductImageData } from "@/lib/api/schemas/catalogue";
import { authorisedImageSrc } from "@/lib/images";
import { cn } from "@/lib/utils/cn";

const SIZE = 600;

/**
 * A product image from an authorised source (lib/images.ts), or a neutral placeholder.
 * Images from any other host are never rendered.
 */
export function ProductImage({
  image,
  productName,
  className,
}: {
  image: ProductImageData | null;
  productName: string;
  className?: string;
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
      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
      className={cn("aspect-square w-full rounded-md object-cover", className)}
    />
  );
}
