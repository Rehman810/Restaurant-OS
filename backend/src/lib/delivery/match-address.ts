/** Non-blocking: suggest whether free-text address matches selected area covers/name. */
export function addressMatchesArea(
  address: string,
  area: { name: string; covers: string[] }
): { matches: boolean; matchedTerm: string | null } {
  const hay = address.trim().toLowerCase();
  if (!hay) return { matches: false, matchedTerm: null };
  const name = area.name.trim().toLowerCase();
  if (name.length >= 3 && hay.includes(name)) {
    return { matches: true, matchedTerm: area.name };
  }
  for (const cover of area.covers) {
    const term = cover.trim().toLowerCase();
    if (term.length >= 3 && hay.includes(term)) {
      return { matches: true, matchedTerm: cover };
    }
  }
  return { matches: false, matchedTerm: null };
}

export function suggestAreaFromAddress(
  address: string,
  areas: { id: string; name: string; covers: string[] }[]
): { areaId: string; matchedTerm: string } | null {
  const hay = address.trim().toLowerCase();
  if (!hay) return null;
  for (const area of areas) {
    const hit = addressMatchesArea(address, area);
    if (hit.matches && hit.matchedTerm) {
      return { areaId: area.id, matchedTerm: hit.matchedTerm };
    }
  }
  return null;
}
