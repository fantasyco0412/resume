import type { Express, Request, Response as ExpressResponse } from "express";

type RouteHandler = (request: Request) => Promise<Response>;

function buildWebRequest(req: Request): globalThis.Request {
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost";
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(","));
  }

  const init: RequestInit = { method: req.method, headers };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body !== undefined) {
    init.body = JSON.stringify(req.body);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  return new Request(url, init);
}

async function sendWebResponse(res: ExpressResponse, webResponse: globalThis.Response) {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  const buffer = Buffer.from(await webResponse.arrayBuffer());
  res.send(buffer);
}

export function registerRoute(
  app: Express,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  handler: RouteHandler | (() => Promise<Response>)
) {
  app[method](path, async (req: Request, res: ExpressResponse) => {
    try {
      const webReq = buildWebRequest(req);
      const response =
        handler.length === 0
          ? await (handler as () => Promise<Response>)()
          : await (handler as RouteHandler)(webReq as unknown as Request);
      await sendWebResponse(res, response);
    } catch (error) {
      console.error(`[${method.toUpperCase()} ${path}]`, error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });
}
