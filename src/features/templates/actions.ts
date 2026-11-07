"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createProjectFromTemplate, resolvePublishedTemplate } from "@/features/templates/store";

export async function useTemplate(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "").trim();
  if (!templateId) redirect("/templates?error=missing");

  const session = await auth();
  if (!session?.user?.id) {
    const template = await resolvePublishedTemplate(templateId);
    if (!template) redirect("/templates?error=missing");
    redirect(`/editor/try/${encodeURIComponent(template.slug)}`);
  }

  const project = await createProjectFromTemplate(session.user.id, templateId);
  if (!project) redirect("/templates?error=missing");
  redirect(`/editor/${project.id}`);
}
