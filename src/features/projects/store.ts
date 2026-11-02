import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { VersionSource } from "@/generated/prisma/client";
import { createObjectId } from "@/features/editor/objects";
import {
  blankProjectDocument,
  migrateDocument,
  reassignObjectIds,
  type ProjectDocument,
  ProjectDocumentError,
} from "@/features/projects/document";
import { templatePreviewSvg } from "@/features/templates/preview";
import { getPrisma } from "@/lib/db";

const NAME_LIMIT = 80;

export function cleanProjectName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > NAME_LIMIT) return null;
  return name;
}

export async function listProjects(ownerId: string, query: string) {
  const prisma = getPrisma();
  return prisma.project.findMany({
    where: {
      ownerId,
      deletedAt: null,
      ...(query
        ? { name: { contains: query, mode: "insensitive" } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
  });
}

export async function listProjectPreviews(ownerId: string, query: string) {
  const prisma = getPrisma();
  const projects = await prisma.project.findMany({
    where: {
      ownerId,
      deletedAt: null,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      versions: {
        orderBy: { number: "desc" },
        take: 1,
        select: { document: true },
      },
    },
  });
  return projects.flatMap((project) => {
    const latest = project.versions[0];
    if (!latest) return [];
    try {
      const document = migrateDocument(latest.document);
      return [
        {
          id: project.id,
          name: project.name,
          updatedAt: project.updatedAt,
          previewSvg: templatePreviewSvg(document),
          width: document.artboard.width,
          height: document.artboard.height,
        },
      ];
    } catch (error) {
      if (error instanceof ProjectDocumentError) {
        return [
          {
            id: project.id,
            name: project.name,
            updatedAt: project.updatedAt,
            previewSvg: "",
            width: 1,
            height: 1,
          },
        ];
      }
      throw error;
    }
  });
}

export async function createProject(
  ownerId: string,
  name: string,
  document: ProjectDocument,
  source: VersionSource,
) {
  const prisma = getPrisma();
  return prisma.project.create({
    data: {
      ownerId,
      name,
      schemaVersion: document.schemaVersion,
      versions: {
        create: {
          number: 1,
          document: document as Prisma.InputJsonValue,
          source,
        },
      },
    },
    select: { id: true, name: true, updatedAt: true },
  });
}

export async function createBlankProject(ownerId: string, name = "Untitled logo") {
  return createProject(ownerId, name, blankProjectDocument(), "save");
}

export async function getOwnedProject(ownerId: string, projectId: string) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId, deletedAt: null },
    select: {
      id: true,
      name: true,
      schemaVersion: true,
      updatedAt: true,
      versions: {
        orderBy: { number: "desc" },
        take: 1,
        select: { document: true },
      },
    },
  });
  if (!project || project.versions.length === 0) return null;
  try {
    const document = migrateDocument(project.versions[0]?.document);
    return {
      id: project.id,
      name: project.name,
      schemaVersion: document.schemaVersion,
      updatedAt: project.updatedAt,
      document,
    };
  } catch (error) {
    if (error instanceof ProjectDocumentError) return null;
    throw error;
  }
}

export async function renameProject(ownerId: string, projectId: string, name: string) {
  const prisma = getPrisma();
  const existing = await prisma.project.findFirst({
    where: { id: projectId, ownerId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return null;
  return prisma.project.update({
    where: { id: projectId },
    data: { name },
    select: { id: true, name: true, updatedAt: true },
  });
}

export async function deleteProject(ownerId: string, projectId: string) {
  const prisma = getPrisma();
  const existing = await prisma.project.findFirst({
    where: { id: projectId, ownerId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });
  return true;
}

export async function duplicateProject(ownerId: string, projectId: string) {
  const source = await getOwnedProject(ownerId, projectId);
  if (!source) return null;
  const name = cleanProjectName(`${source.name} copy`) ?? "Untitled logo copy";
  const document = reassignObjectIds(source.document, createObjectId);
  return createProject(ownerId, name, document, "duplicate");
}

export async function appendProjectVersion(
  ownerId: string,
  projectId: string,
  document: ProjectDocument,
  source: VersionSource,
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!project) return null;
    const latest = await tx.projectVersion.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const version = await tx.projectVersion.create({
      data: {
        projectId,
        number: (latest?.number ?? 0) + 1,
        document: document as Prisma.InputJsonValue,
        source,
      },
      select: { id: true },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { schemaVersion: document.schemaVersion },
    });
    return version;
  });
}

export async function saveProjectDocument(
  ownerId: string,
  projectId: string,
  document: ProjectDocument,
  source: Extract<VersionSource, "save" | "autosave">,
) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!project) return null;
    const latest = await tx.projectVersion.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (latest?.number ?? 0) + 1;
    await tx.projectVersion.create({
      data: {
        projectId,
        number,
        document: document as Prisma.InputJsonValue,
        source,
      },
    });
    return tx.project.update({
      where: { id: projectId },
      data: { schemaVersion: document.schemaVersion },
      select: { id: true, name: true, updatedAt: true },
    });
  });
}

const HISTORY_LIMIT = 40;

export async function listAccountDesigns(ownerId: string) {
  const prisma = getPrisma();
  const projects = await prisma.project.findMany({
    where: { ownerId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      shareToken: true,
      _count: { select: { versions: true } },
      versions: {
        orderBy: { number: "desc" },
        take: 1,
        select: { document: true },
      },
    },
  });
  return projects.flatMap((project) => {
    const latest = project.versions[0];
    if (!latest) return [];
    try {
      return [
        {
          id: project.id,
          name: project.name,
          updatedAt: project.updatedAt,
          shared: Boolean(project.shareToken),
          saves: project._count.versions,
          document: migrateDocument(latest.document),
        },
      ];
    } catch (error) {
      if (error instanceof ProjectDocumentError) return [];
      throw error;
    }
  });
}

export async function getAccountDesign(ownerId: string, projectId: string) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId, deletedAt: null },
    select: {
      id: true,
      name: true,
      shareToken: true,
      versions: {
        orderBy: { number: "desc" },
        take: HISTORY_LIMIT,
        select: { id: true, number: true, source: true, createdAt: true },
      },
      _count: { select: { versions: true } },
    },
  });
  if (!project || project.versions.length === 0) return null;
  return {
    id: project.id,
    name: project.name,
    shareToken: project.shareToken,
    versions: project.versions,
    saves: project._count.versions,
  };
}

export async function getOwnedVersion(ownerId: string, projectId: string, versionId: string) {
  const prisma = getPrisma();
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, project: { id: projectId, ownerId, deletedAt: null } },
    select: { id: true, number: true, document: true },
  });
  if (!version) return null;
  try {
    return { id: version.id, number: version.number, document: migrateDocument(version.document) };
  } catch (error) {
    if (error instanceof ProjectDocumentError) return null;
    throw error;
  }
}

export async function restoreOwnedVersion(ownerId: string, projectId: string, versionId: string) {
  const version = await getOwnedVersion(ownerId, projectId, versionId);
  if (!version) return null;
  return appendProjectVersion(ownerId, projectId, version.document, "save");
}

export async function shareOwnedProject(ownerId: string, projectId: string) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId, deletedAt: null },
    select: { shareToken: true },
  });
  if (!project) return null;
  if (project.shareToken) return project.shareToken;
  const shareToken = randomBytes(18).toString("base64url");
  await prisma.project.update({ where: { id: projectId }, data: { shareToken } });
  return shareToken;
}

export async function stopSharingProject(ownerId: string, projectId: string) {
  const prisma = getPrisma();
  const result = await prisma.project.updateMany({
    where: { id: projectId, ownerId, deletedAt: null },
    data: { shareToken: null },
  });
  return result.count > 0;
}

export async function getSharedProject(token: string) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { shareToken: token, deletedAt: null },
    select: {
      name: true,
      versions: {
        orderBy: { number: "desc" },
        take: 1,
        select: { document: true },
      },
    },
  });
  const latest = project?.versions[0];
  if (!project || !latest) return null;
  try {
    return { name: project.name, document: migrateDocument(latest.document) };
  } catch (error) {
    if (error instanceof ProjectDocumentError) return null;
    throw error;
  }
}
