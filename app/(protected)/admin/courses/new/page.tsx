import { CourseForm } from "@/components/dashboard/course-form";
import { requireAdminPage } from "@/lib/access";
import { getServerLanguage } from "@/lib/server-preferences";
import { getMessages } from "@/lib/ui-settings";

export default async function NewCoursePage() {
  const language = await getServerLanguage();
  const messages = getMessages(language);
  await requireAdminPage();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          {messages.publications.newLabel}
        </p>
        <h1 className="font-heading text-4xl text-zinc-950 dark:text-zinc-100">
          {messages.publications.newTitle}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-zinc-600">
          {messages.publications.newDescription}
        </p>
      </div>

      <CourseForm key="course-create-form" mode="create" />
    </div>
  );
}
