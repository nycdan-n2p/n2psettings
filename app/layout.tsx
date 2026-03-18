import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { localeLangTags, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "net2phone Settings",
  description: "net2phone admin settings console",
  icons: {
    icon: "https://settings.net2phone.com/favicon.png?v=2",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html lang={localeLangTags[locale] ?? "en"}>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocaleProvider locale={locale}>
            <Providers>{children}</Providers>
          </LocaleProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
