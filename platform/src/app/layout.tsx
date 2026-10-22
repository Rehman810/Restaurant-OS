import type { Metadata } from "next";
import "./globals.css";
import { PlatformAuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Restaurant OS Platform",
  description: "Operator console for Restaurant OS tenants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <PlatformAuthProvider>{children}</PlatformAuthProvider>
      </body>
    </html>
  );
}
