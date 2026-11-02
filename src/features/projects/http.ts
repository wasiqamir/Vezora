import { auth } from "@/lib/auth";

export function projectError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return userId;
}

export async function readJson(request: Request) {
  try {
    return { ok: true as const, body: await request.json() };
  } catch {
    return { ok: false as const };
  }
}
