import Image, { type ImageProps } from "next/image";

import { APP_BASE_PATH, withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element -- External course images must not be server-fetched by the Next optimizer. */

type CourseImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

export function CourseImage({ src, alt, className, fill, sizes, priority, ...props }: CourseImageProps) {
  if (isExternalHttpsUrl(src)) {
    return renderRawCourseImage({ src, alt, className, fill, priority, sizes, referrerPolicy: "no-referrer" });
  }

  const localUploadSrc = getLocalUploadSrc(src);

  if (localUploadSrc) {
    return renderRawCourseImage({ src: localUploadSrc, alt, className, fill, priority, sizes });
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

function renderRawCourseImage({
  src,
  alt,
  className,
  fill,
  priority,
  referrerPolicy,
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  referrerPolicy?: "no-referrer";
  sizes?: ImageProps["sizes"];
}) {
  if (fill) {
    return (
      <img
        alt={alt}
        className={cn("absolute inset-0 h-full w-full", className)}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        referrerPolicy={referrerPolicy}
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
      referrerPolicy={referrerPolicy}
      src={src}
    />
  );
}

function getLocalUploadSrc(value: string) {
  if (value.startsWith("/uploads/")) {
    return withBasePath(value);
  }

  if (APP_BASE_PATH && value.startsWith(`${APP_BASE_PATH}/uploads/`)) {
    return value;
  }

  return null;
}

function isExternalHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
