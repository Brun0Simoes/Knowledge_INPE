import { CourseImageSource, CourseStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { courseInputSchema } from "@/lib/schemas/course";
import { saveUploadedFiles, validateImageFileContents, validateImageFiles } from "@/lib/uploads";
import { createCourseSlug, parseMultilineUrls } from "@/lib/utils";

function toBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

export async function ensureUniqueCourseSlug(title: string, excludeId?: string) {
  // Slugs are generated from the human title so the editorial URL stays readable.
  // We probe the database until we find a unique suffix for create/edit flows.
  const baseSlug = createCourseSlug(title) || "curso";
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await prisma.course.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function parseCourseFormData(
  formData: FormData,
  mode: "create" | "update",
) {
  // Files are validated separately from the Zod payload because FormData mixes
  // strings and blobs and the image rules depend on the upload layer.
  const imageFiles = formData
    .getAll("imageFiles")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const fileValidationError = validateImageFiles(imageFiles);
  if (fileValidationError) {
    return {
      success: false as const,
      error: fileValidationError,
    };
  }

  const fileContentValidationError = await validateImageFileContents(imageFiles);
  if (fileContentValidationError) {
    return {
      success: false as const,
      error: fileContentValidationError,
    };
  }

  const parsed = courseInputSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    description: formData.get("description"),
    externalUrl: formData.get("externalUrl"),
    isFeatured: toBoolean(formData.get("isFeatured")),
    imageUrls: parseMultilineUrls(String(formData.get("imageUrls") ?? "")),
  });

  if (!parsed.success) {
    return {
      success: false as const,
      error:
        Object.values(parsed.error.flatten().fieldErrors)
          .flat()
          .find(Boolean) ?? "Nao foi possivel validar os dados do curso.",
    };
  }

  if (
    mode === "create" &&
    parsed.data.imageUrls.length === 0 &&
    imageFiles.length === 0
  ) {
    return {
      success: false as const,
      error: "Adicione ao menos uma imagem por upload ou URL externa.",
    };
  }

  return {
    success: true as const,
    data: {
      ...parsed.data,
      imageFiles,
    },
  };
}

export async function buildCourseImages(
  title: string,
  imageFiles: File[],
  imageUrls: string[],
  startOrder = 0,
) {
  // Uploaded files and external URLs end up in the same ordered gallery model so
  // the page renderer does not need to care about the original source.
  const uploaded = await saveUploadedFiles(imageFiles, title);

  return [
    ...uploaded.map((image, index) => ({
      source: CourseImageSource.UPLOAD,
      url: image.url,
      alt: image.alt,
      sortOrder: startOrder + index,
    })),
    ...imageUrls.map((url, index) => ({
      source: CourseImageSource.EXTERNAL_URL,
      url,
      alt: `${title} - galeria ${index + 1}`,
      sortOrder: startOrder + uploaded.length + index,
    })),
  ];
}

export async function clearPublishedFeaturedCourses(
  excludeId: string,
  client: Pick<typeof prisma, "course"> = prisma,
) {
  // Only one published course should occupy the hero slot at a time.
  await client.course.updateMany({
    where: {
      id: {
        not: excludeId,
      },
      status: CourseStatus.PUBLISHED,
      isFeatured: true,
    },
    data: {
      isFeatured: false,
    },
  });
}
