export type FiscalInvoicePayload = {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  branchId: string | null;
  total: number;
  taxAmount: number;
};

export type FiscalProviderResult = {
  status: "SUBMITTED" | "FAILED" | "PENDING";
  externalId?: string;
  error?: string;
};

export interface FiscalProvider {
  submitInvoice(payload: FiscalInvoicePayload): Promise<FiscalProviderResult>;
  voidInvoice(payload: FiscalInvoicePayload): Promise<FiscalProviderResult>;
  getStatus(externalId: string): Promise<FiscalProviderResult>;
}

export class NoopFiscalProvider implements FiscalProvider {
  async submitInvoice(): Promise<FiscalProviderResult> {
    return { status: "PENDING" };
  }
  async voidInvoice(): Promise<FiscalProviderResult> {
    return { status: "PENDING" };
  }
  async getStatus(): Promise<FiscalProviderResult> {
    return { status: "PENDING" };
  }
}

let provider: FiscalProvider = new NoopFiscalProvider();

export function getFiscalProvider() {
  return provider;
}

export function setFiscalProvider(next: FiscalProvider) {
  provider = next;
}
