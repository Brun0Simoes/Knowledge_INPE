"use client";

import { FileImage, Save, UploadCloud, X } from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { CourseImage } from "@/components/courses/course-image";
import { useUiSettings } from "@/components/providers/ui-settings-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { withBasePath } from "@/lib/base-path";
import { MAX_IMAGE_UPLOADS } from "@/lib/constants";
import {
  clearCourseDraftStorage,
  getCourseDraftStorageKey,
  hasMeaningfulCourseDraft,
  loadCourseDraftFromStorage,
  saveCourseDraftToStorage,
  type PersistedCourseFormState,
} from "@/lib/course-draft-storage";

type CourseFormProps = {
  mode: "create" | "edit";
  course?: {
    id: string;
    title: string;
    summary: string;
    description: string;
    externalUrl: string;
    startsAt: string | null;
    endsAt: string | null;
    isFeatured: boolean;
    images: Array<{ id: string; url: string; alt: string }>;
  };
};

type CourseFormState = Omit<PersistedCourseFormState, "savedAt">;

const draftUiLabels = {
  "pt-BR": {
    localFilesTitle: "Arquivos locais prontos",
    localFilesHint:
      "Os uploads locais ficam guardados neste navegador ate publicar ou limpar o rascunho.",
    removeFile: "Remover arquivo",
    autosaveReady: "Rascunho local ativo",
    autosaveSaved:
      "O formulario continua salvo automaticamente neste navegador, inclusive apos sair da pagina.",
    autosaveRestored:
      "O conteudo montado antes foi recuperado neste navegador para voce continuar de onde parou.",
    lastSaved: "Ultimo autosave",
    clearLocalDraft: "Limpar rascunho local",
  },
  en: {
    localFilesTitle: "Local files ready",
    localFilesHint: "Local uploads stay saved in this browser until you publish or clear the draft.",
    removeFile: "Remove file",
    autosaveReady: "Local draft active",
    autosaveSaved: "This form keeps saving automatically in this browser, even if you leave the page.",
    autosaveRestored:
      "Your earlier draft was restored in this browser so you can continue where you stopped.",
    lastSaved: "Last autosave",
    clearLocalDraft: "Clear local draft",
  },
  es: {
    localFilesTitle: "Archivos locales listos",
    localFilesHint:
      "Las cargas locales quedan guardadas en este navegador hasta publicar o limpiar el borrador.",
    removeFile: "Quitar archivo",
    autosaveReady: "Borrador local activo",
    autosaveSaved:
      "Este formulario se guarda automaticamente en este navegador, incluso si sales de la pagina.",
    autosaveRestored:
      "El contenido anterior fue recuperado en este navegador para que sigas desde donde lo dejaste.",
    lastSaved: "Ultimo autosave",
    clearLocalDraft: "Limpiar borrador local",
  },
} as const;

function buildInitialState(course?: CourseFormProps["course"]): CourseFormState {
  return {
    title: course?.title ?? "",
    summary: course?.summary ?? "",
    description: course?.description ?? "",
    externalUrl: course?.externalUrl ?? "",
    startsAt: formatDateTimeLocalInput(course?.startsAt),
    endsAt: formatDateTimeLocalInput(course?.endsAt),
    imageUrls: "",
    isFeatured: course?.isFeatured ?? false,
  };
}

function formatDateTimeLocalInput(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);
}

function formatFileSize(language: string, bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const formatter = new Intl.NumberFormat(language, {
    maximumFractionDigits: 1,
    minimumFractionDigits: bytes >= 1024 * 1024 ? 1 : 0,
  });

  if (bytes < 1024 * 1024) {
    return `${formatter.format(bytes / 1024)} KB`;
  }

  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}

function mergeFiles(currentFiles: File[], nextFiles: File[]) {
  const deduped = new Map<string, File>();

  for (const file of [...currentFiles, ...nextFiles]) {
    deduped.set(`${file.name}-${file.size}-${file.lastModified}`, file);
  }

  return Array.from(deduped.values()).slice(0, MAX_IMAGE_UPLOADS);
}

export function CourseForm({ mode, course }: CourseFormProps) {
  const router = useRouter();
  const { language, messages } = useUiSettings();
  const draftLabels = draftUiLabels[language] ?? draftUiLabels["pt-BR"];
  const initialState = useMemo(() => buildInitialState(course), [course]);
  const storageKey = useMemo(
    () => getCourseDraftStorageKey(mode, course?.id),
    [course?.id, mode],
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestStateRef = useRef<CourseFormState>(initialState);
  const latestFilesRef = useRef<File[]>([]);
  const [formState, setFormState] = useState<CourseFormState>(initialState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrateDraft() {
      // The editor restores its local draft on mount so accidental reloads behave
      // like Gmail-style draft recovery.
      const persisted = await loadCourseDraftFromStorage(storageKey);
      if (!active) {
        return;
      }

      if (persisted.draft) {
        const nextState: CourseFormState = {
          title: persisted.draft.title,
          summary: persisted.draft.summary,
          description: persisted.draft.description,
          externalUrl: persisted.draft.externalUrl,
          startsAt: persisted.draft.startsAt ?? "",
          endsAt: persisted.draft.endsAt ?? "",
          imageUrls: persisted.draft.imageUrls,
          isFeatured: persisted.draft.isFeatured,
        };

        if (hasMeaningfulCourseDraft(nextState, persisted.files)) {
          setFormState(nextState);
          setSelectedFiles(persisted.files);
          setSavedAt(persisted.draft.savedAt);
          setRestoredDraft(true);
          latestStateRef.current = nextState;
          latestFilesRef.current = persisted.files;
        }
      }

      setStorageReady(true);
    }

    void hydrateDraft();

    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    latestStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    latestFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    const hasDraft = hasMeaningfulCourseDraft(formState, selectedFiles);
    const nextSavedAt = new Date().toISOString();
    // Debounce local persistence so long descriptions do not hammer storage APIs
    // on every keystroke.
    const timeout = window.setTimeout(() => {
      if (!hasDraft) {
        void clearCourseDraftStorage(storageKey);
        setSavedAt(null);
        setRestoredDraft(false);
        return;
      }

      void saveCourseDraftToStorage(
        storageKey,
        {
          ...formState,
          savedAt: nextSavedAt,
        },
        selectedFiles,
      );
      setSavedAt(nextSavedAt);
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [formState, selectedFiles, storageKey, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    // beforeunload/pagehide acts as the last safety net when the user leaves the
    // page before the debounce window finishes.
    const flushDraft = () => {
      const snapshot = latestStateRef.current;
      const files = latestFilesRef.current;

      if (!hasMeaningfulCourseDraft(snapshot, files)) {
        return;
      }

      void saveCourseDraftToStorage(
        storageKey,
        {
          ...snapshot,
          savedAt: new Date().toISOString(),
        },
        files,
      );
    };

    window.addEventListener("beforeunload", flushDraft);
    window.addEventListener("pagehide", flushDraft);

    return () => {
      window.removeEventListener("beforeunload", flushDraft);
      window.removeEventListener("pagehide", flushDraft);
    };
  }, [storageKey, storageReady]);

  const hasLocalDraft = hasMeaningfulCourseDraft(formState, selectedFiles);
  const savedAtLabel = savedAt
    ? new Intl.DateTimeFormat(language, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(savedAt))
    : null;

  function updateField<K extends keyof CourseFormState>(field: K, value: CourseFormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);
    if (incomingFiles.length === 0) {
      return;
    }

    setError(null);
    setSelectedFiles((current) => mergeFiles(current, incomingFiles));
    event.target.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function clearLocalDraft() {
    setError(null);
    setFormState(initialState);
    setSelectedFiles([]);
    setSavedAt(null);
    setRestoredDraft(false);
    await clearCourseDraftStorage(storageKey);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const endpoint = withBasePath(mode === "create" ? "/api/courses" : `/api/courses/${course?.id}`);
    const method = mode === "create" ? "POST" : "PATCH";
    const payload = new FormData();

    payload.set("title", formState.title);
    payload.set("summary", formState.summary);
    payload.set("description", formState.description);
    payload.set("externalUrl", formState.externalUrl);
    payload.set("startsAt", formState.startsAt);
    payload.set("endsAt", formState.endsAt);
    payload.set("imageUrls", formState.imageUrls);

    if (formState.isFeatured) {
      payload.set("isFeatured", "on");
    }

    for (const file of selectedFiles) {
      payload.append("imageFiles", file);
    }

    try {
      const response = await fetch(endpoint, {
        method,
        body: payload,
      });

      const result = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;

      if (!response.ok) {
        setError(result?.error ?? "Nao foi possivel salvar o curso.");
        setPending(false);
        return;
      }

      await clearCourseDraftStorage(storageKey);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      startTransition(() => {
        if (mode === "create" && result?.id) {
          router.push(`/admin/courses/${result.id}/edit`);
        } else {
          router.refresh();
        }
      });
    } catch {
      setError("Nao foi possivel salvar o curso.");
      setPending(false);
      return;
    }

    setPending(false);
  }

  return (
    <form className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "create" ? messages.courseForm.createTitle : messages.courseForm.editTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">{messages.courseForm.titleLabel}</Label>
            <Input
              id="title"
              name="title"
              placeholder={messages.courseForm.titlePlaceholder}
              required
              value={formState.title}
              onChange={(event) => updateField("title", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">{messages.courseForm.summaryLabel}</Label>
            <Textarea
              id="summary"
              name="summary"
              placeholder={messages.courseForm.summaryPlaceholder}
              required
              value={formState.summary}
              onChange={(event) => updateField("summary", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{messages.courseForm.descriptionLabel}</Label>
            <Textarea
              className="min-h-56"
              id="description"
              name="description"
              placeholder={messages.courseForm.descriptionPlaceholder}
              required
              value={formState.description}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="externalUrl">{messages.courseForm.urlLabel}</Label>
            <Input
              id="externalUrl"
              name="externalUrl"
              placeholder={messages.courseForm.urlPlaceholder}
              required
              type="url"
              value={formState.externalUrl}
              onChange={(event) => updateField("externalUrl", event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startsAt">{messages.courseForm.startsAtLabel}</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                value={formState.startsAt}
                onChange={(event) => updateField("startsAt", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">{messages.courseForm.endsAtLabel}</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                value={formState.endsAt}
                onChange={(event) => updateField("endsAt", event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {messages.courseForm.scheduleHint}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{messages.courseForm.imagesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="imageFiles">{messages.courseForm.uploadLabel}</Label>
              <Input
                ref={fileInputRef}
                id="imageFiles"
                name="imageFiles"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFileSelection}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {messages.courseForm.uploadHint}
              </p>
            </div>

            {selectedFiles.length ? (
              <div className="space-y-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#102132]">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {draftLabels.localFilesTitle}
                </p>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/85 p-3 dark:bg-[#0c1926]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {file.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatFileSize(language, file.size)}
                        </p>
                      </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSelectedFile(index)}
                        >
                          <X className="h-4 w-4" />
                          {draftLabels.removeFile}
                        </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {draftLabels.localFilesHint}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="imageUrls">{messages.courseForm.externalUrlsLabel}</Label>
              <Textarea
                id="imageUrls"
                name="imageUrls"
                placeholder={"https://...\nhttps://..."}
                value={formState.imageUrls}
                onChange={(event) => updateField("imageUrls", event.target.value)}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {messages.courseForm.externalUrlsHint}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-white/10 dark:bg-[#102132] dark:text-zinc-300">
              <input
                checked={formState.isFeatured}
                className="mt-1 h-4 w-4 rounded border-zinc-300 bg-white text-teal-600 accent-teal-600 dark:border-white/16 dark:bg-[#08111b] dark:accent-teal-400"
                name="isFeatured"
                type="checkbox"
                onChange={(event) => updateField("isFeatured", event.target.checked)}
              />
              {messages.courseForm.featuredLabel}
            </label>

            {course?.images.length ? (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  {messages.courseForm.currentImages}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {course.images.map((image) => (
                    <div key={image.id} className="relative aspect-square overflow-hidden rounded-3xl">
                      <CourseImage
                        alt={image.alt}
                        className="object-cover"
                        fill
                        sizes="(max-width: 768px) 50vw, 15vw"
                        src={image.url}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-3xl bg-zinc-50 p-4 text-sm leading-7 text-zinc-600 dark:bg-[#102132] dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {draftLabels.autosaveReady}
              </p>
              <p className="mt-1">
                {restoredDraft ? draftLabels.autosaveRestored : draftLabels.autosaveSaved}
              </p>
              {savedAtLabel ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  {draftLabels.lastSaved}: {savedAtLabel}
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white/75 p-4 text-sm leading-7 text-zinc-600 dark:border-white/10 dark:bg-[#0f1d2b] dark:text-zinc-300">
              {messages.courseForm.draftHint}
            </div>

            {hasLocalDraft ? (
              <Button type="button" variant="outline" onClick={() => void clearLocalDraft()}>
                <FileImage className="h-4 w-4" />
                {draftLabels.clearLocalDraft}
              </Button>
            ) : null}

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button className="w-full" disabled={pending} type="submit">
              {mode === "create" ? <UploadCloud className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {mode === "create" ? messages.courseForm.saveDraft : messages.courseForm.saveChanges}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
