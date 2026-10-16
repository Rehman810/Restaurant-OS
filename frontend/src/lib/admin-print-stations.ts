import { api } from "./api";

export type PrintStation = {
  id: string;
  branchId: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
};

export async function fetchPrintStations() {
  return api<{ stations: PrintStation[] }>("/admin/print-stations");
}

export async function createPrintStation(body: {
  name: string;
  code: string;
  sortOrder?: number;
  isDefault?: boolean;
}) {
  return api<PrintStation>("/admin/print-stations", { method: "POST", body: JSON.stringify(body) });
}

export async function updatePrintStation(
  id: string,
  body: Partial<{ name: string; code: string; sortOrder: number; isActive: boolean; isDefault: boolean }>
) {
  return api<PrintStation>(`/admin/print-stations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deletePrintStation(id: string) {
  return api<{ ok: boolean }>(`/admin/print-stations/${id}`, { method: "DELETE" });
}
