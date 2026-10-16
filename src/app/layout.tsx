import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { MockApiProvider } from "@/components/mock-api-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mixes de ⚡ Frutos Secos | Moovimiento",
  description:
    "Armá tu mix de 220g con ingredientes seleccionados. Delivery gratuito en Ciudad Universitaria.",
  metadataBase: new URL("https://moovimiento.com"),
  openGraph: {
    title: "Mixes de ⚡ Frutos Secos | Moovimiento",
    description:
      "Armá tu mix de 220g con ingredientes seleccionados. Delivery gratuito en Ciudad Universitaria.",
    url: "https://moovimiento.com",
    siteName: "Moovimiento",
    images: [
      {
        url: "/moovimiento-emoji.png",
        width: 1200,
        height: 630,
        alt: "Moovimiento - Mixes de Frutos Secos",
      },
    ],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mixes de ⚡ Frutos Secos | Moovimiento",
    description:
      "Armá tu mix de 220g con ingredientes seleccionados. Delivery gratuito en Ciudad Universitaria.",
    images: ["/moovimiento-emoji.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-50 dark:bg-background text-foreground`}
      >
        <ThemeProvider>
          <MockApiProvider />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
