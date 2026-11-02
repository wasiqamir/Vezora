import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { signUpAction } from "@/features/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Loading sign-up…</p>}>
      <SignUpForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUpForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const params = await searchParams;
  const message =
    params.error === "exists"
      ? "This email is already registered."
      : params.error === "invalid"
        ? "Use your name, a valid email, and a password of at least 8 characters."
        : null;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign up</h1>
        <p className="text-sm text-muted-foreground">Create an account, then start a blank logo.</p>
      </div>
      <form action={signUpAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <Input name="name" autoComplete="name" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
        <Button type="submit">Create account</Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/sign-in" className="text-foreground underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
