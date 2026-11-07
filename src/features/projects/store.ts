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
import { uploadLogoFile, type LogoFile } from "@/features/assets/logo-image";
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
      imageUrl: true,
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
          imageUrl: project.imageUrl,
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
            imageUrl: project.imageUrl,
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
  // Working draft only — account "Saves" increments when the logo is exported.
  return createProject(ownerId, name, blankProjectDocument(), "autosave");
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

const IMAGE_GAP_MS = 45_000;

async function rememberLogoImage(projectId: string, versionNumber: number, url: string) {
  const prisma = getPrisma();
  await prisma.project.update({
    where: { id: projectId },
    data: { imageUrl: url, imageStoredAt: new Date() },
  });
  await prisma.projectVersion.updateMany({
    where: { projectId, number: versionNumber },
    data: { imageUrl: url },
  });
}

export async function storeProjectLogo(ownerId: string, projectId: string, file: LogoFile) {
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId, deletedAt: null },
    select: {
      id: true,
      versions: { orderBy: { number: "desc" }, take: 1, select: { number: true } },
    },
  });
  const version = project?.versions[0];
  if (!project || !version) return null;
  const url = await uploadLogoFile(projectId, file);
  if (!url) return "";
  await rememberLogoImage(projectId, version.number, url);
  return url;
}

export async function saveProjectDocument(
  ownerId: string,
  projectId: string,
  document: ProjectDocument,
  source: Extract<VersionSource, "save" | "autosave">,
  image?: LogoFile | null,
) {
  const prisma = getPrisma();
  const saved = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, ownerId, deletedAt: null },
      select: { id: true, imageStoredAt: true },
    });
    if (!project) return null;
    const latest = await tx.projectVersion.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { id: true, number: true },
    });
    // Autosave keeps the working draft only — does not add an account "save".
    // Export (source: save) appends a counted version.
    let number: number;
    if (source === "autosave" && latest) {
      number = latest.number;
      await tx.projectVersion.update({
        where: { id: latest.id },
        data: { document: document as Prisma.InputJsonValue },
      });
    } else {
      number = (latest?.number ?? 0) + 1;
      await tx.projectVersion.create({
        data: {
          projectId,
          number,
          document: document as Prisma.InputJsonValue,
          source,
        },
      });
    }
    const updated = await tx.project.update({
      where: { id: projectId },
      data: { schemaVersion: document.schemaVersion },
      select: { id: true, name: true, updatedAt: true },
    });
    return { ...updated, versionNumber: number, imageStoredAt: project.imageStoredAt };
  });
  if (!saved) return null;
  const recent =
    saved.imageStoredAt != null && Date.now() - saved.imageStoredAt.getTime() < IMAGE_GAP_MS;
  const snapshot =
    image && (source === "save" || !recent)
      ? image
      : source === "save"
        ? {
            body: Buffer.from(templatePreviewSvg(document)),
            mime: "image/svg+xml" as const,
            filename: "logo.svg",
          }
        : null;
  if (snapshot) {
    const url = await uploadLogoFile(projectId, snapshot);
    if (url) await rememberLogoImage(projectId, saved.versionNumber, url);
  }
  return { id: saved.id, name: saved.name, updatedAt: saved.updatedAt };
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
      imageUrl: true,
      _count: { select: { versions: { where: { source: "save" } } } },
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
          // Only export saves (source: save) — artboard autosaves do not count.
          saves: project._count.versions,
          imageUrl: project.imageUrl,
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
      _count: { select: { versions: { where: { source: "save" } } } },
      versions: {
        where: { source: "save" },
        orderBy: { number: "desc" },
        take: HISTORY_LIMIT,
        select: { id: true, number: true, source: true, createdAt: true },
      },
    },
  });
  if (!project) return null;
  const workingVersion =
    project.versions[0] ??
    (await prisma.projectVersion.findFirst({
      where: { projectId: project.id },
      orderBy: { number: "desc" },
      select: { id: true, number: true, source: true, createdAt: true },
    }));
  if (!workingVersion) return null;
  return {
    id: project.id,
    name: project.name,
    shareToken: project.shareToken,
    versions: project.versions,
    workingVersion,
    saves: project._count.versions,
  };
}

export async function getOwnedVersion(ownerId: string, projectId: string, versionId: string) {
  const prisma = getPrisma();
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, project: { id: projectId, ownerId, deletedAt: null } },
    select: { id: true, number: true, document: true, imageUrl: true },
  });
  if (!version) return null;
  try {
    return {
      id: version.id,
      number: version.number,
      imageUrl: version.imageUrl,
      document: migrateDocument(version.document),
    };
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
      imageUrl: true,
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
    return { name: project.name, imageUrl: project.imageUrl, document: migrateDocument(latest.document) };
  } catch (error) {
    if (error instanceof ProjectDocumentError) return null;
    throw error;
  }
}
