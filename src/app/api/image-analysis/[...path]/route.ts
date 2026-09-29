const LOCAL_FASTAPI_URL = "http://localhost:8000";

interface ImageAnalysisRouteContext {
  params: Promise<{ path: string[] }>;
}

const FORWARDED_RESPONSE_HEADERS = [
  "content-disposition",
  "content-type",
  "etag",
  "last-modified",
] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SDD-C3 and QAD-TC4: keep the CV service internal and call it through the
// runtime-only Vercel service binding.
export async function POST(request: Request, context: ImageAnalysisRouteContext) {
  const path = await getAllowedPath(context, "POST");
  if (!path) {
    return Response.json({ detail: "Not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ detail: "Expected a multipart form upload." }, { status: 400 });
  }

  return proxyToFastApi(path, {
    method: "POST",
    body: formData,
  });
}

export async function GET(_request: Request, context: ImageAnalysisRouteContext) {
  const path = await getAllowedPath(context, "GET");
  if (!path) {
    return Response.json({ detail: "Not found." }, { status: 404 });
  }

  return proxyToFastApi(path, { method: "GET" });
}

async function getAllowedPath(
  context: ImageAnalysisRouteContext,
  method: "GET" | "POST",
) {
  const { path: segments } = await context.params;
  const path = segments.map(encodeURIComponent).join("/");

  if (method === "POST" && path === "analyze-image") {
    return path;
  }

  if (
    method === "GET" &&
    (path === "health" || path.startsWith("generated/sessions/"))
  ) {
    return path;
  }

  return null;
}

async function proxyToFastApi(path: string, init: RequestInit) {
  try {
    const upstreamResponse = await fetch(buildFastApiUrl(path), {
      ...init,
      cache: "no-store",
    });
    const headers = new Headers();

    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstreamResponse.headers.get(name);
      if (value) {
        headers.set(name, value);
      }
    }
    headers.set("cache-control", "private, no-store");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  } catch {
    return Response.json(
      { detail: "Image analysis service is unavailable." },
      { status: 502 },
    );
  }
}

function buildFastApiUrl(path: string) {
  const baseUrl = process.env.FASTAPI_SERVICE_URL || LOCAL_FASTAPI_URL;
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`);
}
