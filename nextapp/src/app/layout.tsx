import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Theme, ThemeProvider } from "@/components/providers/theme-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const THEME_COOKIE_NAME = "techstack-ui-theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HydroTek Dashboard",
  description: "HydroTek device management and telemetry dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get(THEME_COOKIE_NAME)?.value || "system";

  return (
    <html lang="en" className={initialTheme}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-b from-background to-muted/30`}
      >
        <ThemeProvider
          initialTheme={initialTheme as Theme}
          storageKey={THEME_COOKIE_NAME}
        >
          <QueryProvider>
            <AuthProvider>
              <Header />
              <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
