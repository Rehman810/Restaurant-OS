export type KotLine = {
  id: string;
  menuItemId: string;
  quantity: number;
  nameAtOrder: string;
  optionsLabel: string;
  instructions: string;
  printStationId: string | null;
};

export type KotStation = {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
};

export type KotTicket = {
  stationId: string;
  stationName: string;
  stationCode: string;
  items: KotLine[];
};

export function buildKotTickets(
  lines: KotLine[],
  stations: KotStation[]
): KotTicket[] {
  const active = stations.filter((s) => s);
  const defaultStation =
    active.find((s) => s.isDefault) || active.sort((a, b) => a.name.localeCompare(b.name))[0];
  const byId = new Map(active.map((s) => [s.id, s]));

  const buckets = new Map<string, KotLine[]>();
  for (const line of lines) {
    const station =
      (line.printStationId && byId.get(line.printStationId)) || defaultStation;
    if (!station) continue;
    const list = buckets.get(station.id) || [];
    list.push(line);
    buckets.set(station.id, list);
  }

  return [...buckets.entries()]
    .map(([stationId, items]) => {
      const station = byId.get(stationId)!;
      return {
        stationId,
        stationName: station.name,
        stationCode: station.code,
        items,
      };
    })
    .sort((a, b) => a.stationName.localeCompare(b.stationName));
}
