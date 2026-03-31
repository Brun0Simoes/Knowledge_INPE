export type PersistedCourseFormState = {
  title: string;
  summary: string;
  description: string;
  externalUrl: string;
  imageUrls: string;
  isFeatured: boolean;
  savedAt: string;
};

const STORAGE_PREFIX = "knowledge-course-form";
const FILE_DB_NAME = "knowledge-course-drafts";
const FILE_STORE_NAME = "course-form-files";

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

export function getCourseDraftStorageKey(mode: "create" | "edit", courseId?: string) {
  return mode === "edit" && courseId
    ? `${STORAGE_PREFIX}:edit:${courseId}`
    : `${STORAGE_PREFIX}:create`;
}

export function hasMeaningfulCourseDraft(
  draft: Omit<PersistedCourseFormState, "savedAt">,
  files: File[],
) {
  return Boolean(
    draft.title.trim() ||
      draft.summary.trim() ||
      draft.description.trim() ||
      draft.externalUrl.trim() ||
      draft.imageUrls.trim() ||
      draft.isFeatured ||
      files.length,
  );
}

function openDraftFilesDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        db.createObjectStore(FILE_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Nao foi possivel abrir o banco local de rascunhos."));
  });
}

async function readDraftFiles(key: string) {
  const db = await openDraftFilesDb();
  if (!db) {
    return [] as File[];
  }

  return new Promise<File[]>((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, "readonly");
    const request = transaction.objectStore(FILE_STORE_NAME).get(key);

    request.onsuccess = () => {
      resolve((request.result?.files as File[] | undefined) ?? []);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Nao foi possivel ler os arquivos do rascunho."));
    };

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

async function writeDraftFiles(key: string, files: File[]) {
  const db = await openDraftFilesDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, "readwrite");
    transaction.objectStore(FILE_STORE_NAME).put({ key, files });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Nao foi possivel salvar os arquivos do rascunho."));
    };
  });
}

async function deleteDraftFiles(key: string) {
  const db = await openDraftFilesDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, "readwrite");
    transaction.objectStore(FILE_STORE_NAME).delete(key);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Nao foi possivel limpar os arquivos do rascunho."));
    };
  });
}

export async function loadCourseDraftFromStorage(key: string) {
  if (!canUseBrowserStorage()) {
    return {
      draft: null as PersistedCourseFormState | null,
      files: [] as File[],
    };
  }

  const serializedDraft = window.localStorage.getItem(key);
  let draft: PersistedCourseFormState | null = null;

  if (serializedDraft) {
    try {
      draft = JSON.parse(serializedDraft) as PersistedCourseFormState;
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  const files = await readDraftFiles(key).catch(() => []);

  return { draft, files };
}

export async function saveCourseDraftToStorage(
  key: string,
  draft: PersistedCourseFormState,
  files: File[],
) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(draft));
  await writeDraftFiles(key, files).catch(() => undefined);
}

export async function clearCourseDraftStorage(key: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
  await deleteDraftFiles(key).catch(() => undefined);
}
