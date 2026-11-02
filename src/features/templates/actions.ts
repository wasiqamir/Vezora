"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createProjectFromTemplate } from "@/features/templates/store";

export async function useTemplate(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const templateId = String(formData.get("templateId") ?? "");
  const project = await createProjectFromTemplate(session.user.id, templateId);
  if (!project) redirect("/templates?error=missing");
  redirect(`/editor/${project.id}`);
}
