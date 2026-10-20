/** Highlight only the most specific matching admin nav href (avoids Kitchen + Print stations both active). */
export function isAdminNavActive(path: string, href: string, peerHrefs: string[]): boolean {
  const current = path.split("?")[0].split("#")[0];
  if (current === href) return true;
  // `/admin` is a prefix of every admin route; only exact match counts.
  if (href === "/admin") return false;
  if (!current.startsWith(`${href}/`)) return false;

  const hasMoreSpecificPeer = peerHrefs.some(
    (peer) =>
      peer !== href &&
      peer.startsWith(`${href}/`) &&
      (current === peer || current.startsWith(`${peer}/`))
  );
  return !hasMoreSpecificPeer;
}
