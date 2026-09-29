import { clerkFrontendApiProxy } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

// Fallback host if Clerk instance was created under vercel.app
const CLERK_INSTANCE_HOST =
  process.env.CLERK_INSTANCE_HOST || "chess-game-beta-mocha.vercel.app";

async function handleProxy(req: NextRequest) {
  const url = new URL(req.url);
  const reqHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;

  const headers = new Headers(req.headers);

  // If accessed via custom domain (e.g. abaychess.com) but Clerk instance is configured for vercel.app,
  // attribute the proxy request to the instance's registered domain so Clerk FAPI accepts it.
  if (reqHost && !reqHost.includes(CLERK_INSTANCE_HOST)) {
    headers.set("x-forwarded-host", CLERK_INSTANCE_HOST);
    headers.set("x-forwarded-proto", "https");
  }

  const isBodyAllowed = req.method !== "GET" && req.method !== "HEAD";
  const proxyReq = new Request(url.toString(), {
    method: req.method,
    headers,
    body: isBodyAllowed ? req.body : undefined,
    // @ts-expect-error fetch duplex property for body streaming in Node
    duplex: isBodyAllowed && req.body ? "half" : undefined,
  });

  const response = await clerkFrontendApiProxy(proxyReq);

  const resHeaders = new Headers(response.headers);
  const location = resHeaders.get("Location");
  if (location && location.includes(CLERK_INSTANCE_HOST)) {
    resHeaders.set("Location", location.replaceAll(CLERK_INSTANCE_HOST, reqHost));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
  });
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
