import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_UPLOADS } from "@/lib/constants";
import { createCourseSlug } from "@/lib/utils";

const UPLOAD_DIRECTORY = path.join(process.cwd(), "public", "uploads", "courses");
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function validateImageFiles(files: File[]) {
  if (files.length > MAX_IMAGE_UPLOADS) {
    return `Envie no maximo ${MAX_IMAGE_UPLOADS} arquivos por curso.`;
  }

  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      return "Use imagens PNG, JPG ou WEBP.";
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return "Cada imagem pode ter no maximo 5 MB.";
    }
  }

  return null;
}

export async function validateImageFileContents(files: File[]) {
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesImageSignature(file.type, buffer)) {
      return "O conteudo do arquivo nao corresponde ao tipo de imagem informado.";
    }
  }

  return null;
}

export async function saveUploadedFiles(files: File[], courseTitle: string) {
  await mkdir(UPLOAD_DIRECTORY, { recursive: true });

  const savedFiles: Array<{ url: string; alt: string }> = [];

  for (const file of files) {
    const extension = IMAGE_EXTENSIONS[file.type] ?? ".bin";
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

function matchesImageSignature(type: string, buffer: Buffer) {
  if (type === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (type === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (type === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}
