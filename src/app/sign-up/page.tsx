import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AuthFrame, authField, authSubmit } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/features/account/actions";
import { safeCallbackUrl } from "@/lib/callback-url";

export const metadata = {
  title: "Create account — Vezora",
  description: "Create a Vezora account and return to the homepage.",
};

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#07041c]" aria-hidden="true" />}>
      <SignUpForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUpForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const returningToExport =
    callbackUrl.includes("claim=1") || callbackUrl.includes("export=1");
  const signInHref =
    callbackUrl === "/homepage"
      ? "/sign-in"
      : `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const message =
    params.error === "exists"
      ? "This email already has an account. Sign in instead."
      : params.error === "invalid"
        ? "Use your name, a valid email, and a password of at least 8 characters."
        : null;

  return (
    <AuthFrame
      title={returningToExport ? "Sign up to save." : "Start creating."}
      lede={
        returningToExport
          ? "Create an account to save this logo. After that we open the download form so you can finish the export."
          : "Make an account to save every mark, reopen layers later, and export when you are ready."
      }
      switcher={
        <>
          Already registered?{" "}
          <Link
            href={signInHref}
            className="font-medium text-white underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-[#d8b4fe]"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form action={signUpAction} className="flex flex-col gap-3 [@media(max-height:720px)]:gap-2.5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Name
          <Input name="name" autoComplete="name" required className={authField} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Email
          <Input name="email" type="email" autoComplete="email" required className={authField} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          <span className="flex items-baseline justify-between gap-3">
            <span>Password</span>
            <span className="text-xs font-normal text-white/40">At least 8 characters</span>
          </span>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={authField}
          />
        </label>
        {message ? (
          <p role="alert" className="text-sm text-[#fda4af]">
            {message}
          </p>
        ) : null}
        <SubmitButton
          idle={returningToExport ? "Sign up & continue" : "Create account"}
          pending={returningToExport ? "Saving your logo…" : "Starting your logo…"}
          className={authSubmit}
        />
      </form>
    </AuthFrame>
  );
}
