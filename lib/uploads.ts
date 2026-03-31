import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_UPLOADS } from "@/lib/constants";
import { createCourseSlug } from "@/lib/utils";

const UPLOAD_DIRECTORY = path.join(process.cwd(), "public", "uploads", "courses");
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

export function validateImageFiles(files: File[]) {
  if (files.length > MAX_IMAGE_UPLOADS) {
    return `Envie no maximo ${MAX_IMAGE_UPLOADS} arquivos por curso.`;
  }

  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return "Use imagens PNG, JPG, WEBP ou SVG.";
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return "Cada imagem pode ter no maximo 5 MB.";
    }
  }

  return null;
}

export async function saveUploadedFiles(files: File[], courseTitle: string) {
  await mkdir(UPLOAD_DIRECTORY, { recursive: true });

  const savedFiles: Array<{ url: string; alt: string }> = [];

  for (const file of files) {
    const extension = path.extname(file.name || "") || ".bin";
    const fileName = `${createCourseSlug(courseTitle) || "curso"}-${randomUUID()}${extension.toLowerCase()}`;
    const fullPath = path.join(UPLOAD_DIRECTORY, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(fullPath, buffer);

    savedFiles.push({
      url: `/uploads/courses/${fileName}`,
      alt: `${courseTitle} - imagem de capa`,
    });
  }

  return savedFiles;
}

export async function removeUploadedFiles(urls: string[]) {
  const deletions = urls
    .filter((url) => url.startsWith("/uploads/courses/"))
    .map(async (url) => {
      const fileName = path.basename(url);
      const fullPath = path.join(UPLOAD_DIRECTORY, fileName);

      try {
        await unlink(fullPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    });

  await Promise.all(deletions);
}
