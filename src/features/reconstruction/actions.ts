"use server";

import { auth } from "@/lib/auth";
import { cancelReconstructionJob } from "@/features/reconstruction/jobs";

export async function cancelReconstruction(jobId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await cancelReconstructionJob(session.user.id, jobId);
}
