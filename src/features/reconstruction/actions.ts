"use server";

import { auth } from "@/lib/auth";
import {
  cancelActiveReconstructionJobs,
  cancelReconstructionJob,
} from "@/features/reconstruction/jobs";

export async function cancelReconstruction(jobId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  await cancelReconstructionJob(session.user.id, jobId);
}

export async function cancelActiveReconstructions() {
  const session = await auth();
  if (!session?.user?.id) return;
  await cancelActiveReconstructionJobs(session.user.id);
}
