import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mindora — Mapas mentais",
  description: "Crie, organize e compartilhe mapas mentais em qualquer dispositivo.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
