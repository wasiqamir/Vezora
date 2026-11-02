import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pingDatabase, getPrisma } from "@/lib/db";
import {
  createBlankProject,
  deleteProject,
  getAccountDesign,
  getOwnedProject,
  getSharedProject,
  restoreOwnedVersion,
  shareOwnedProject,
  stopSharingProject,
} from "@/features/projects/store";
import { getReconstructionJob } from "@/features/reconstruction/jobs";

const stamp = `${Date.now()}`;

describe("cross-user access", () => {
  it("hides another user's project, upload, and job", async () => {
    if (!(await pingDatabase())) {
      return;
    }
    const prisma = getPrisma();
    const owner = await prisma.user.create({
      data: { email: `phase9-owner-${stamp}@example.com`, name: "Owner", passwordHash: "not-a-login" },
    });
    const other = await prisma.user.create({
      data: { email: `phase9-other-${stamp}@example.com`, name: "Other", passwordHash: "not-a-login" },
    });
    try {
      const project = await createBlankProject(owner.id, "Private mark");
      const asset = await prisma.asset.create({
        data: {
          ownerId: owner.id,
          kind: "upload",
          storageKey: `uploads/phase9-${stamp}`,
          mimeType: "image/png",
          byteSize: 32,
          width: 64,
          height: 64,
          licenseName: "User upload",
          sourceName: "User",
        },
      });
      const job = await prisma.reconstructionJob.create({
        data: {
          ownerId: owner.id,
          projectId: project.id,
          sourceAssetId: asset.id,
          status: "succeeded",
        },
      });

      assert.ok(await getOwnedProject(owner.id, project.id));
      assert.equal(await getOwnedProject(other.id, project.id), null);
      assert.equal(await deleteProject(other.id, project.id), false);
      assert.ok(await getOwnedProject(owner.id, project.id));
      assert.equal(await getReconstructionJob(other.id, job.id), null);
      assert.ok(await getReconstructionJob(owner.id, job.id));

      const stolen = await prisma.asset.findFirst({
        where: { id: asset.id, OR: [{ ownerId: other.id }, { ownerId: null }] },
        select: { id: true },
      });
      assert.equal(stolen, null);

      assert.equal(await getAccountDesign(other.id, project.id), null);
      assert.equal(await shareOwnedProject(other.id, project.id), null);
      const version = await prisma.projectVersion.findFirst({
        where: { projectId: project.id },
        select: { id: true },
      });
      assert.ok(version);
      assert.equal(await restoreOwnedVersion(other.id, project.id, version.id), null);
      const token = await shareOwnedProject(owner.id, project.id);
      assert.ok(token);
      assert.equal((await getSharedProject(token))?.name, "Private mark");
      assert.equal(await stopSharingProject(other.id, project.id), false);
      assert.equal((await getSharedProject(token))?.name, "Private mark");
      assert.equal(await stopSharingProject(owner.id, project.id), true);
      assert.equal(await getSharedProject(token), null);
    } finally {
      await prisma.reconstructionJob.deleteMany({ where: { ownerId: owner.id } });
      await prisma.asset.deleteMany({ where: { ownerId: owner.id } });
      await prisma.user.delete({ where: { id: owner.id } });
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});
