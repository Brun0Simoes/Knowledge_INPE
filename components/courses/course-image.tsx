import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- External course images must not be server-fetched by the Next optimizer. */

type CourseImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

export function CourseImage({ src, alt, className, fill, sizes, priority, ...props }: CourseImageProps) {
  if (isExternalHttpsUrl(src)) {
    if (fill) {
      return (
        <img
          alt={alt}
          className={cn("absolute inset-0 h-full w-full", className)}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          sizes={typeof sizes === "string" ? sizes : undefined}
          src={src}
        />
      );
    }

    return (
      <img
        alt={alt}
        className={className}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        src={src}
      />
    );
  }

  return (
    <Image
      alt={alt}
      className={className}
      fill={fill}
      priority={priority}
      sizes={sizes}
      src={src}
      {...props}
    />
  );
}

function isExternalHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
