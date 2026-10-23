import { resolveMediaUrl } from "./media-url";

const TENANT_FAVICON_ATTR = "data-tenant-favicon";

function faviconType(href: string) {
  if (href.includes(".webp")) return "image/webp";
  if (href.includes(".png")) return "image/png";
  if (href.includes(".svg")) return "image/svg+xml";
  return undefined;
}

function upsertTenantIconLink(rel: string, href: string) {
  const selector = `link[${TENANT_FAVICON_ATTR}][rel="${rel}"]`;
  let link = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute(TENANT_FAVICON_ATTR, "true");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  const type = faviconType(href);
  if (type) link.type = type;
  else link.removeAttribute("type");
}

function clearTenantIconLinks() {
  document.head.querySelectorAll(`link[${TENANT_FAVICON_ATTR}]`).forEach((node) => node.remove());
}

/** Tab icon after settings load/save — only touches our links; never removes Next-managed icons. */
export function applyDocumentFavicon(storedUrl: string) {
  const trimmed = storedUrl.trim();
  if (!trimmed) {
    clearTenantIconLinks();
    return;
  }
  const href = resolveMediaUrl(trimmed);
  if (!href) {
    clearTenantIconLinks();
    return;
  }
  upsertTenantIconLink("icon", href);
  upsertTenantIconLink("shortcut icon", href);
}
