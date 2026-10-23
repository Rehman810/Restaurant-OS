export const CURRENCY_OPTIONS = [
  { code: "PKR", symbol: "Rs", name: "Pakistani Rupee" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
] as const;

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Karachi", label: "Pakistan — Karachi (PKT)" },
  { value: "Asia/Dubai", label: "UAE — Dubai (GST)" },
  { value: "Asia/Riyadh", label: "Saudi Arabia — Riyadh" },
  { value: "Asia/Kolkata", label: "India — Kolkata (IST)" },
  { value: "Europe/London", label: "UK — London" },
] as const;
