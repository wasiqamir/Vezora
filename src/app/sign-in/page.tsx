import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AuthFrame, authField, authSubmit } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/features/account/actions";
import { safeCallbackUrl } from "@/lib/callback-url";

export const metadata = {
  title: "Sign in — Vezora",
  description: "Open the logos saved to your Vezora account.",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#07041c]" aria-hidden="true" />}>
      <SignInForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const returningToExport =
    callbackUrl.includes("claim=1") || callbackUrl.includes("export=1");
  const signUpHref =
    callbackUrl === "/homepage"
      ? "/sign-up"
      : `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <AuthFrame
      title={returningToExport ? "Sign in to save." : "Welcome back."}
      lede={
        returningToExport
          ? "Sign in to save this logo. After that we open the download form so you can finish the export."
          : "Sign in to reopen your marks and keep drawing where you left off."
      }
      switcher={
        <>
          Need an account?{" "}
          <Link
            href={signUpHref}
            className="font-medium text-white underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-[#d8b4fe]"
          >
            Create one
          </Link>
        </>
      }
    >
      <form action={signInAction} className="flex flex-col gap-3 [@media(max-height:720px)]:gap-2.5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Email
          <Input name="email" type="email" autoComplete="email" required className={authField} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Password
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={authField}
          />
        </label>
        {params.error ? (
          <p role="alert" className="text-sm text-[#fda4af]">
            That email and password do not match an account.
          </p>
        ) : null}
        <SubmitButton
          idle={returningToExport ? "Sign in & continue" : "Sign in"}
          pending={returningToExport ? "Opening download…" : "Signing in…"}
          className={authSubmit}
        />
      </form>
    </AuthFrame>
  );
}
