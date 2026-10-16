import type { Application, RequestHandler } from "express";

export type ListedRoute = {
  method: string;
  path: string;
  auth: string;
};

function mountPath(layer: { path?: string; regexp: RegExp }): string {
  if (typeof layer.path === "string") return layer.path;
  const src = layer.regexp.source;
  if (src === "^\\/?$" || src === "^\\/?(?=\\/|$)") return "";
  return (
    src
      .replace(/^\^/, "")
      .replace(/\\\/\?\(\?=\\\/\|\$\)/, "")
      .replace(/\\\/\?\$/, "")
      .replace(/\(\?=\\\/\|\$\)/, "")
      .replace(/\\\//g, "/")
      .replace(/\$$/, "")
      .replace(/\\\./g, ".")
  );
}

function authFromHandlers(handlers: RequestHandler[]): string {
  const names = handlers
    .map((h) => h.name || "")
    .filter((n) => n && n !== "<anonymous>");
  const parts: string[] = [];
  if (names.includes("requireAuth")) parts.push("requireAuth");
  if (names.some((n) => n.startsWith("requireRole"))) {
    parts.push(names.find((n) => n.startsWith("requireRole")) || "requireRole");
  }
  if (parts.length === 0) return "public";
  return parts.join(", ");
}

function collectFromStack(
  stack: Array<{
    route?: { path: string; methods: Record<string, boolean>; stack: { handle: RequestHandler }[] };
    name?: string;
    handle?: { stack?: unknown[] };
    regexp: RegExp;
    path?: string;
  }>,
  prefix: string,
  out: ListedRoute[]
) {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = prefix + layer.route.path;
      const handlers = layer.route.stack.map((s) => s.handle);
      const auth = authFromHandlers(handlers);
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled) {
          out.push({ method: method.toUpperCase(), path: routePath, auth });
        }
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      const segment = mountPath(layer);
      const nextPrefix =
        prefix + (segment.startsWith("/") || segment === "" ? segment : `/${segment}`);
      collectFromStack(layer.handle.stack as typeof stack, nextPrefix.replace(/\/+/g, "/"), out);
    }
  }
}

export function listAppRoutes(app: Application): ListedRoute[] {
  const out: ListedRoute[] = [];
  const stack = (app as unknown as { _router?: { stack: unknown[] } })._router?.stack;
  if (!stack) return out;
  collectFromStack(stack as Parameters<typeof collectFromStack>[0], "", out);
  out.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  return out;
}

export function formatRouteTable(routes: ListedRoute[]): string {
  const lines = [
    "# API route table",
    "",
    "Generated from `createApp()` (same stack as production `index.ts`).",
    "",
    "| Method | Path | Auth |",
    "| --- | --- | --- |",
  ];
  for (const r of routes) {
    lines.push(`| ${r.method} | \`${r.path}\` | ${r.auth} |`);
  }
  lines.push("");
  return lines.join("\n");
}
