import type { FulfillmentType, PaymentMethod } from "@prisma/client";

export type TaxRoundingRule = "HALF_UP" | "HALF_DOWN" | "FLOOR" | "CEILING";

export type TaxSettingsSlice = {
  taxEnabled?: boolean | null;
  taxPercent?: unknown;
  taxIncluded?: boolean | null;
  pricesIncludeTax?: boolean | null;
  taxRatesByFulfillment?: unknown;
  taxRatesByPayment?: unknown;
  taxRoundingRule?: string | null;
  taxLegalName?: string | null;
  taxNumber?: string | null;
  taxStrn?: string | null;
  taxBusinessAddress?: string | null;
  taxLabel?: string | null;
};

export type TaxLineInput = {
  priceAtOrder: number;
  quantity: number;
};

export type TaxLineResult = {
  lineTaxableAmount: number;
  lineTaxAmount: number;
  lineTaxRatePercent: number;
};

export type TaxOrderResult = {
  taxAmount: number;
  taxableAmount: number;
  taxRatePercent: number;
  taxInclusive: boolean;
  lines: TaxLineResult[];
  snapshot: Record<string, unknown>;
};

export type TaxContext = {
  fulfillmentType?: FulfillmentType | null;
  paymentMethod?: PaymentMethod | null;
};
