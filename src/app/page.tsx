import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { startProject } from "@/features/account/actions";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <div className="flex flex-col gap-4">
        <h1>
          <Image
            src="/vezora-logo.png"
            alt="Vezora. Create. Design. Define Your Identity."
            width={1024}
            height={341}
            priority
            className="h-auto w-full max-w-lg"
            style={{ width: "100%", height: "auto", maxWidth: "32rem" }}
          />
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Design a logo you can reopen and edit. Export SVG and PNG. A PNG or JPG can later become an editable draft.
          That recovery is an approximation, because those files store pixels,
          not the original layers or fonts.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Suspense fallback={<Link href="/sign-up" className={buttonVariants({ size: "lg" })}>Start a logo</Link>}>
          <StartLink />
        </Suspense>
        <Link href="/templates" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Browse templates
        </Link>
      </div>
    </main>
  );
}

async function StartLink() {
  await connection();
  const session = await auth();
  if (!session?.user) {
    return (
      <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
        Start a logo
      </Link>
    );
  }
  return (
    <form action={startProject}>
      <Button type="submit" size="lg">
        Start a logo
      </Button>
    </form>
  );
}
