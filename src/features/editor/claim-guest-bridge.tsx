"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { claimGuestDraftAction } from "@/features/account/claim-guest-draft";
import { clearGuestDraft, readGuestDraft } from "@/features/editor/guest-draft";

/** After auth, moves a guest try-session into a real project and opens export when requested. */
export function ClaimGuestBridge({
  templateSlug,
  templateName,
  openExport,
}: {
  templateSlug: string;
  templateName: string;
  openExport: boolean;
}) {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const draft = readGuestDraft();
    const form = new FormData();
    form.set("templateSlug", draft?.templateSlug || templateSlug);
    form.set("projectName", draft?.projectName || templateName);
    form.set("openExport", openExport || draft?.openExport ? "1" : "0");
    if (draft?.document) form.set("document", JSON.stringify(draft.document));
    if (draft?.assets && Object.keys(draft.assets).length > 0) {
      form.set("assets", JSON.stringify(draft.assets));
    }
    clearGuestDraft();

    void claimGuestDraftAction(form).catch((reason) => {
      // redirect() rejects with a special Next.js error — let it complete navigation.
      unstable_rethrow(reason);
      setError("Could not open your logo. Try again from Templates.");
    });
  }, [openExport, templateName, templateSlug]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#07041c] px-4 text-white">
      <div className="max-w-sm text-center">
        <p className="text-sm text-white/65">
          {error ?? "Opening your logo so you can finish the download…"}
        </p>
      </div>
    </main>
  );
}
