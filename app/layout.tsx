import type { Metadata } from "next";
import "./globals.css";
import "./editor-interactions.css";

export const metadata: Metadata = {
  title: "nodum — Mapas mentais",
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
