export function serverApiBase() {
  const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "") || "http://127.0.0.1:4000";
  return target;
}
