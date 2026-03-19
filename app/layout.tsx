import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { IntlProvider } from "@/components/providers/IntlProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "net2phone Settings",
  description: "net2phone admin settings console",
  icons: {
    // Proxied through /api/favicon so CSP img-src 'self' is satisfied
    // without requiring an external domain in the content security policy.
    icon: "/api/favicon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang defaults to "en" on the server; IntlProvider updates it client-side
    // once it reads the NEXT_LOCALE cookie.
    <html lang="en">
      <body className="antialiased">
        <IntlProvider>
          <Providers>{children}</Providers>
        </IntlProvider>
      </body>
    </html>
  );
}
