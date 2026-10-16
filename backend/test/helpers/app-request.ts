import http from "http";
import type { AddressInfo } from "net";
import type { Application } from "express";

export type AppResponse = {
  status: number;
  body: unknown;
  text: string;
};

export async function appRequest(
  app: Application,
  method: string,
  path: string,
  options?: { body?: unknown; headers?: Record<string, string> }
): Promise<AppResponse> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      const payload = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: {
            ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
            ...options?.headers,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            let body: unknown = text;
            try {
              body = text ? JSON.parse(text) : {};
            } catch {
              body = text;
            }
            resolve({ status: res.statusCode ?? 0, body, text });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}
