// src/proxy.ts
// Next 16 renamed `middleware.ts` -> `proxy.ts`; it lives in `src/` next to `app/`.
// Its runtime is Node.js and CANNOT be configured (`export const runtime` throws).
// `createRouteMatcher` is deprecated in Clerk 7.9.1, so the prefix check is by hand.
//
// This is only the first of three layers (FR-4): the gate below, `auth.protect()` in
// `src/app/(protected)/layout.tsx`, and an explicit `auth()` check inside every route
// handler. Convex mutations re-derive identity server-side regardless (FR-5).
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// NOTE: /api/ai and /api/tutor are deliberately NOT here (ARCHITECTURE.md §G, verbatim;
// docs/PRO_TUTOR.md §5). `auth.protect()` answers 404 for API requests, which masks the
// difference between "not signed in" and "no such route". Both gate themselves with
// `auth()` and answer 401 — and the tutor route answers 402 without the Pro feature,
// which `auth.protect()` could not express either.
const PROTECTED_PREFIXES = [
  "/play",
  "/game",
  "/history",
  "/settings",
  "/profile",
  "/wallet",
  "/admin",
  "/yyhnan",
  "/puzzles",
  "/tournaments",
  "/feedback",
  "/complete-profile",
  "/players",
];

function isProtected(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    const { userId } = await auth();
    if (!userId) {
      const redirectUrl = new URL(req.nextUrl.pathname, req.url);
      for (const [k, v] of req.nextUrl.searchParams.entries()) {
        if (k !== "_rsc") {
          redirectUrl.searchParams.set(k, v);
        }
      }
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", redirectUrl.toString());
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|hdr|glb|gltf|wasm|bin|mp3|ogg|wav)).*)",
    "/(api|trpc)(.*)",
  ],
};
