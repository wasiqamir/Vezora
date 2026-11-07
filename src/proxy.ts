import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATH = [
  /^\/$/,
  /^\/homepage$/,
  /^\/templates$/,
  /^\/editor\/try\/[^/]+$/,
  /^\/editor\/new$/,
  /^\/sign-in$/,
  /^\/sign-up$/,
  /^\/share\/[^/]+$/,
  /^\/api\/health$/,
  /^\/api\/auth(\/|$)/,
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATH.some((pattern) => pattern.test(pathname))) return NextResponse.next();

  const forwarded = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const secureCookie = forwarded.split(",")[0]?.trim() === "https";
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      secureCookie,
    });
  } catch {
    token = null;
  }
  if (token) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Sign in to continue." } },
      { status: 401 },
    );
  }

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\..*).*)"],
};
