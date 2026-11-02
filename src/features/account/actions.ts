"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { auth, signIn, signOut } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createBlankProject } from "@/features/projects/store";

function safeCallback(value: FormDataEntryValue | null) {
  const callback = String(value ?? "/dashboard");
  if (!callback.startsWith("/") || callback.startsWith("//")) return "/dashboard";
  return callback;
}

export async function signInAction(formData: FormData) {
  const callback = safeCallback(formData.get("callbackUrl"));
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callback,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/sign-in?error=1&callbackUrl=${encodeURIComponent(callback)}`);
    }
    throw error;
  }
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 1 || name.length > 80 || !email.includes("@") || password.length < 8) {
    redirect("/sign-up?error=invalid");
  }
  const existing = await getPrisma().user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) redirect("/sign-up?error=exists");
  let user;
  try {
    user = await getPrisma().user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/sign-up?error=exists");
    }
    throw error;
  }
  const project = await createBlankProject(user.id);
  try {
    await signIn("credentials", { email, password, redirectTo: `/editor/${project.id}` });
  } catch (error) {
    if (error instanceof AuthError) redirect("/sign-in?error=1");
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function startProject() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const project = await createBlankProject(session.user.id);
  redirect(`/editor/${project.id}`);
}
