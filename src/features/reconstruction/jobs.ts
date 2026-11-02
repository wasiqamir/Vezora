import { readUpload } from "@/features/assets/storage";
import { buildReconstructionDraft } from "@/features/reconstruction/draft";
import { appendProjectVersion } from "@/features/projects/store";
import { JOB_BUDGET_MS, MAX_PIXELS } from "@/features/reliability/limits";
import { getPrisma } from "@/lib/db";
import { logEvent } from "@/lib/log";

export class ReconstructionError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const ACTIVE = ["queued", "running"] as const;

export async function createReconstructionJob(ownerId: string, projectId: string, assetId: string) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new ReconstructionError(404, "not_found", "That project was not found.");
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, ownerId },
    select: { id: true, mimeType: true, storageKey: true, width: true, height: true },
  });
  if (!asset || !asset.storageKey.startsWith("uploads/")) {
    throw new ReconstructionError(404, "not_found", "That file was not found.");
  }
  if (asset.mimeType !== "image/png" && asset.mimeType !== "image/jpeg") {
    throw new ReconstructionError(422, "unsupported_type", "Use a PNG or JPG image.");
  }
  return prisma.$transaction(async (tx) => {
    const active = await tx.reconstructionJob.findFirst({
      where: { ownerId, status: { in: [...ACTIVE] } },
      select: { id: true },
    });
    if (active) {
      throw new ReconstructionError(429, "too_many_jobs", "A reconstruction is already running.");
    }
    return tx.reconstructionJob.create({
      data: {
        ownerId,
        projectId,
        sourceAssetId: assetId,
        status: "queued",
      },
      select: { id: true, status: true },
    });
  });
}

export async function getReconstructionJob(ownerId: string, jobId: string) {
  const job = await getPrisma().reconstructionJob.findFirst({
    where: { id: jobId, ownerId },
    select: { id: true, status: true, errorCode: true, errorMessage: true, resultVersionId: true },
  });
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    error: job.errorCode ? { code: job.errorCode, message: job.errorMessage ?? "Could not build a draft from this image." } : null,
    resultVersionId: job.resultVersionId,
  };
}

export async function cancelReconstructionJob(ownerId: string, jobId: string) {
  const updated = await getPrisma().reconstructionJob.updateMany({
    where: { id: jobId, ownerId, status: { in: [...ACTIVE] } },
    data: {
      status: "failed",
      errorCode: "cancelled",
      errorMessage: "Cancelled.",
      finishedAt: new Date(),
    },
  });
  return updated.count > 0;
}

let chain: Promise<void> = Promise.resolve();

export function enqueueReconstruction(jobId: string) {
  chain = chain
    .catch(() => undefined)
    .then(() => runQueuedJob(jobId));
}

async function runQueuedJob(jobId: string) {
  const started = Date.now();
  logEvent("info", "reconstruction.start", { jobId });
  try {
    await runReconstructionJob(jobId);
    const ms = Date.now() - started;
    logEvent(ms > JOB_BUDGET_MS ? "error" : "info", "reconstruction.finish", { jobId, ms });
  } catch (error) {
    logEvent("error", "reconstruction.finish", {
      jobId,
      ms: Date.now() - started,
      message: error instanceof Error ? error.message : "failed",
    });
  }
}

export async function runReconstructionJob(jobId: string) {
  const prisma = getPrisma();
  const claimed = await prisma.reconstructionJob.updateMany({
    where: { id: jobId, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  if (claimed.count === 0) return;
  const job = await prisma.reconstructionJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      ownerId: true,
      projectId: true,
      sourceAssetId: true,
      sourceAsset: { select: { id: true, mimeType: true, width: true, height: true } },
    },
  });
  if (!job) return;
  const pixels = (job.sourceAsset.width ?? 0) * (job.sourceAsset.height ?? 0);
  if (pixels > MAX_PIXELS) {
    await prisma.reconstructionJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: "failed",
        errorCode: "validation_failed",
        errorMessage: "That image is too large to reconstruct.",
        finishedAt: new Date(),
      },
    });
    return;
  }
  try {
    const bytes = await readUpload(job.sourceAssetId);
    const draft = await buildReconstructionDraft({
      bytes: new Uint8Array(bytes),
      mimeType: job.sourceAsset.mimeType,
      assetId: job.sourceAssetId,
      jobId: job.id,
    });
    if (!(await stillRunning(job.id))) return;
    const version = await appendProjectVersion(
      job.ownerId,
      job.projectId,
      draft.document,
      "reconstruction",
    );
    if (!version) throw new ReconstructionError(404, "not_found", "That project was not found.");
    await prisma.reconstructionJob.updateMany({
      where: { id: job.id, status: "running" },
      data: draft.recovered
        ? {
            status: "failed",
            errorCode: "reconstruction_failed",
            errorMessage: "Could not build a draft from this image.",
            resultVersionId: version.id,
            finishedAt: new Date(),
          }
        : {
            status: "succeeded",
            resultVersionId: version.id,
            finishedAt: new Date(),
          },
    });
  } catch (error) {
    if (!(await stillRunning(job.id))) return;
    const version = await saveOriginalOnly(job).catch(() => null);
    await prisma.reconstructionJob.updateMany({
      where: { id: job.id, status: "running" },
      data: {
        status: "failed",
        errorCode: error instanceof ReconstructionError ? error.code : "reconstruction_failed",
        errorMessage: "Could not build a draft from this image.",
        resultVersionId: version?.id,
        finishedAt: new Date(),
      },
    });
  }
}

async function stillRunning(jobId: string) {
  const job = await getPrisma().reconstructionJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === "running";
}

async function saveOriginalOnly(job: {
  id: string;
  ownerId: string;
  projectId: string;
  sourceAssetId: string;
  sourceAsset: { width: number | null; height: number | null };
}) {
  const width = job.sourceAsset.width ?? 1000;
  const height = job.sourceAsset.height ?? 1000;
  const scale = Math.min(1, 2048 / width, 2048 / height);
  const boardWidth = Math.max(256, Math.min(2048, Math.round(width * scale)));
  const boardHeight = Math.max(256, Math.min(2048, Math.round(height * scale)));
  return appendProjectVersion(
    job.ownerId,
    job.projectId,
    {
      schemaVersion: 1,
      artboard: {
        preset: boardWidth === boardHeight && boardWidth === 1000 ? "square" : "custom",
        width: boardWidth,
        height: boardHeight,
        background: "#ffffff",
      },
      objects: [
        {
          id: `obj_${crypto.randomUUID()}`,
          type: "image",
          name: "Original",
          x: 0,
          y: 0,
          width,
          height,
          scaleX: scale,
          scaleY: scale,
          angle: 0,
          opacity: 1,
          visible: true,
          locked: true,
          assetId: job.sourceAssetId,
        },
      ],
      reconstruction: {
        jobId: job.id,
        sourceAssetId: job.sourceAssetId,
        note: "Draft from a PNG or JPG. It is an approximation.",
      },
    },
    "reconstruction",
  );
}
