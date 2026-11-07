import { Prisma } from "@/generated/prisma/client";
import type { TemplateCategory } from "@/generated/prisma/client";
import { createObjectId } from "@/features/editor/objects";
import { migrateDocument, reassignObjectIds, type ProjectDocument } from "@/features/projects/document";
import { createProject } from "@/features/projects/store";
import { starterTemplateDocuments, type StarterTemplate } from "@/features/templates/documents";
import { templateProjectName } from "@/features/templates/names";
import { getPrisma } from "@/lib/db";

const CATEGORY_BY_LABEL = {
  Startup: "startup",
  Freelancer: "freelancer",
  "Local business": "local_business",
  Agency: "agency",
} as const satisfies Record<StarterTemplate["category"], TemplateCategory>;

const LABEL_BY_CATEGORY: Record<TemplateCategory, StarterTemplate["category"]> = {
  startup: "Startup",
  freelancer: "Freelancer",
  local_business: "Local business",
  agency: "Agency",
};

export function categoryFromQuery(value: string | null) {
  if (!value || value === "All") return null;
  if (value in CATEGORY_BY_LABEL) return CATEGORY_BY_LABEL[value as keyof typeof CATEGORY_BY_LABEL];
  if (value === "local-business" || value === "local_business") return "local_business" as const;
  if (value === "startup" || value === "freelancer" || value === "agency") return value;
  return null;
}

export async function ensurePublishedTemplates() {
  const prisma = getPrisma();
  for (const template of starterTemplateDocuments) {
    const document = migrateDocument(template.document);
    await prisma.template.upsert({
      where: { slug: template.slug },
      create: {
        slug: template.slug,
        name: template.name,
        category: CATEGORY_BY_LABEL[template.category],
        description: template.description,
        document: document as Prisma.InputJsonValue,
        schemaVersion: document.schemaVersion,
        published: true,
      },
      update: {
        name: template.name,
        category: CATEGORY_BY_LABEL[template.category],
        description: template.description,
        document: document as Prisma.InputJsonValue,
        schemaVersion: document.schemaVersion,
        published: true,
      },
    });
  }
}

function listStarterTemplates(category: TemplateCategory | null, query: string) {
  const needle = query.trim().toLowerCase();
  return starterTemplateDocuments
    .filter((template) => {
      if (category && CATEGORY_BY_LABEL[template.category] !== category) return false;
      if (!needle) return true;
      return (
        template.name.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle)
      );
    })
    .map((template) => {
      const document = migrateDocument(template.document);
      return {
        id: template.slug,
        slug: template.slug,
        name: template.name,
        category: template.category,
        description: template.description,
        schemaVersion: document.schemaVersion,
        document,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listPublishedTemplates(category: TemplateCategory | null, query: string) {
  try {
    await ensurePublishedTemplates();
    const prisma = getPrisma();
    const templates = await prisma.template.findMany({
      where: {
        published: true,
        ...(category ? { category } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
    if (templates.length > 0) return templates.map(presentTemplate);
  } catch {
    // Local Prisma Postgres may be down; still show the built-in catalog.
  }
  return listStarterTemplates(category, query);
}

export async function resolvePublishedTemplate(templateId: string) {
  const key = templateId.trim();
  if (!key) return null;

  try {
    await ensurePublishedTemplates();
    const prisma = getPrisma();
    const template = await prisma.template.findFirst({
      where: { published: true, OR: [{ id: key }, { slug: key }] },
    });
    if (template) {
      return {
        id: template.id,
        slug: template.slug,
        name: template.name,
        document: reassignObjectIds(migrateDocument(template.document), createObjectId),
      };
    }
  } catch {
    // Fall through to the built-in catalog when Postgres is unavailable.
  }

  const starter = starterTemplateDocuments.find((template) => template.slug === key);
  if (!starter) return null;
  return {
    id: starter.slug,
    slug: starter.slug,
    name: starter.name,
    document: reassignObjectIds(migrateDocument(starter.document), createObjectId),
  };
}

export async function createProjectFromTemplate(ownerId: string, templateId: string) {
  const template = await resolvePublishedTemplate(templateId);
  if (!template) return null;
  const existing = await getPrisma().project.findMany({
    where: { ownerId, deletedAt: null },
    select: { name: true },
  });
  const name = templateProjectName(
    template.name,
    existing.map((project) => project.name),
  );
  return createProject(ownerId, name, template.document, "template");
}

function presentTemplate(template: {
  id: string;
  slug: string;
  name: string;
  category: TemplateCategory;
  description: string;
  schemaVersion: number;
  document: Prisma.JsonValue;
}) {
  const document = migrateDocument(template.document) satisfies ProjectDocument;
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    category: LABEL_BY_CATEGORY[template.category],
    description: template.description,
    schemaVersion: template.schemaVersion,
    document,
  };
}
