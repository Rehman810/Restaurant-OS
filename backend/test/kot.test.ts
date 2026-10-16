import { describe, expect, it } from "vitest";
import { buildKotTickets } from "../src/lib/kot";

describe("[KOT-01] station tickets", () => {
  const stations = [
    { id: "s1", name: "Grill", code: "GRILL", isDefault: false },
    { id: "s2", name: "Main kitchen", code: "KITCHEN", isDefault: true },
  ];

  it("groups lines by menu item station with default fallback", () => {
    const tickets = buildKotTickets(
      [
        {
          id: "a",
          menuItemId: "m1",
          quantity: 1,
          nameAtOrder: "Burger",
          optionsLabel: "",
          instructions: "",
          printStationId: "s1",
        },
        {
          id: "b",
          menuItemId: "m2",
          quantity: 2,
          nameAtOrder: "Fries",
          optionsLabel: "",
          instructions: "",
          printStationId: null,
        },
      ],
      stations
    );
    expect(tickets).toHaveLength(2);
    const grill = tickets.find((t) => t.stationCode === "GRILL");
    expect(grill?.items).toHaveLength(1);
    const kitchen = tickets.find((t) => t.stationCode === "KITCHEN");
    expect(kitchen?.items).toHaveLength(1);
  });
});
