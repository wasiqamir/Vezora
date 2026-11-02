import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AuthFrame, authField, authSubmit } from "@/components/auth-frame";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/features/account/actions";

export const metadata = {
  title: "Create account — Vezora",
  description: "Create a Vezora account and open a blank logo.",
};

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="bg-[#f3eee6] px-4 py-16 text-sm text-[#1c1730]/60">Loading sign-up…</p>}>
      <SignUpForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUpForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const params = await searchParams;
  const message =
    params.error === "exists"
      ? "This email already has an account. Sign in instead."
      : params.error === "invalid"
        ? "Use your name, a valid email, and a password of at least 8 characters."
        : null;

  return (
    <AuthFrame
      title="Start a logo."
      lede="Create an account and a blank artboard opens straight away."
      switcher={
        <>
          Already registered?{" "}
          <Link href="/sign-in" className="font-medium text-[#1c1730] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form action={signUpAction} className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <Input name="name" autoComplete="name" required className={authField} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <Input name="email" type="email" autoComplete="email" required className={authField} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-baseline justify-between gap-3">
            <span>Password</span>
            <span className="text-xs font-normal text-[#1c1730]/50">At least 8 characters</span>
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
          <p role="alert" className="text-sm text-[#9f1239]">
            {message}
          </p>
        ) : null}
        <SubmitButton idle="Create account" pending="Starting your logo…" className={authSubmit} />
      </form>
    </AuthFrame>
  );
}
