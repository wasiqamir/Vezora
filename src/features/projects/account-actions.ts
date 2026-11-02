"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isResourceId } from "@/features/reliability/limits";
import { restoreOwnedVersion, shareOwnedProject, stopSharingProject } from "@/features/projects/store";

async function ownerId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user.id;
}

export async function shareDesign(projectId: string) {
  const userId = await ownerId();
  if (!isResourceId(projectId)) redirect("/account");
  const token = await shareOwnedProject(userId, projectId);
  if (!token) redirect("/account");
  redirect(`/account/${projectId}`);
}

export async function stopSharingDesign(projectId: string) {
  const userId = await ownerId();
  if (!isResourceId(projectId)) redirect("/account");
  await stopSharingProject(userId, projectId);
  redirect(`/account/${projectId}`);
}

export async function restoreDesign(projectId: string, versionId: string) {
  const userId = await ownerId();
  if (!isResourceId(projectId) || !isResourceId(versionId)) redirect("/account");
  const restored = await restoreOwnedVersion(userId, projectId, versionId);
  if (!restored) redirect(`/account/${projectId}`);
  redirect(`/editor/${projectId}`);
}
