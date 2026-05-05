import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Образовательная платформа",
  description: "Платформа для создания и прохождения курсов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body
        suppressHydrationWarning
        className={`${manrope.className} flex min-h-full flex-col`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}