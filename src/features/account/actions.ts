"use server";

import { AuthError } from "next-auth";
import { redirect, unstable_rethrow } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { auth, signIn, signOut } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/callback-url";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createBlankProject } from "@/features/projects/store";

const homePath = "/homepage";

export async function signInAction(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"), homePath);
  try {
    const destination = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
      redirectTo: callbackUrl,
    });
    if (signInFailed(destination)) {
      redirect(`/sign-in?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError) {
      redirect(`/sign-in?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
  redirect(callbackUrl);
}

export async function signUpAction(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"), homePath);
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 1 || name.length > 80 || !email.includes("@") || password.length < 8) {
    redirect(`/sign-up?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  const existing = await getPrisma().user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) redirect(`/sign-up?error=exists&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  let user;
  try {
    user = await getPrisma().user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/sign-up?error=exists&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
  // Guest claim/export already creates the project from the draft — skip a spare blank.
  const claimingGuest =
    callbackUrl.includes("/editor/try/") || callbackUrl.includes("/editor/new");
  if (!claimingGuest) {
    await createBlankProject(user.id);
  }
  try {
    const destination = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: callbackUrl,
    });
    if (signInFailed(destination)) {
      redirect(`/sign-in?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthError) {
      redirect(`/sign-in?error=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
  redirect(callbackUrl);
}

function signInFailed(destination: unknown) {
  return typeof destination === "string" && /[?&]error=/.test(destination);
}

export async function signOutAction() {
  await signOut({ redirectTo: "/homepage" });
}

export async function startProject() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const project = await createBlankProject(session.user.id);
  redirect(`/editor/${project.id}`);
}
