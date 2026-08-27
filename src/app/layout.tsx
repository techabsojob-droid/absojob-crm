import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import QueryProvider from "@/providers/QueryProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "TrueVision CRM — Real Estate Agent & Lead Management",
  description: "Manage agents, leads, property inventory, performance tracking for real estate agencies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster position="bottom-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
