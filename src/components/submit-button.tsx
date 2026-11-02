"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  idle,
  pending,
  className,
}: {
  idle: string;
  pending: string;
  className?: string;
}) {
  const status = useFormStatus();
  return (
    <Button type="submit" className={className} disabled={status.pending} aria-disabled={status.pending}>
      {status.pending ? pending : idle}
    </Button>
  );
}
