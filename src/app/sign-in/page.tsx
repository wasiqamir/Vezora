import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AuthFrame, authField, authSubmit } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/features/account/actions";

export const metadata = {
  title: "Sign in — Vezora",
  description: "Open the logos saved to your Vezora account.",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="bg-[#f3eee6] px-4 py-16 text-sm text-[#1c1730]/60">Loading sign-in…</p>}>
      <SignInForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const params = await searchParams;

  return (
    <AuthFrame
      title="Welcome back."
      lede="Open the marks saved to your account and keep drawing."
      switcher={
        <>
          Need an account?{" "}
          <Link href="/sign-up" className="font-medium text-[#1c1730] underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form action={signInAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <Input name="email" type="email" autoComplete="email" required className={authField} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
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
          <p role="alert" className="text-sm text-[#9f1239]">
            That email and password do not match an account.
          </p>
        ) : null}
        <SubmitButton idle="Sign in" pending="Signing in…" className={authSubmit} />
      </form>
    </AuthFrame>
  );
}
