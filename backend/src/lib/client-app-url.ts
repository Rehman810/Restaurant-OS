export function clientAppUrl(): string {
  return (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
}
