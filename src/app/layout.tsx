import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full overflow-hidden antialiased`}
    >
      <body
        suppressHydrationWarning
        className={`${inter.className} h-full overflow-hidden`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}