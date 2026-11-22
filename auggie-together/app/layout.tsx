import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./suite-theme.css";
import "./nature.css";
import "./wonder.css";

export const metadata: Metadata = {
  title: "Auggie · Together",
  description: "A little care, shared. Feeds, diapers, sleep, and the days in between.",
  appleWebApp: { capable: true, title: "Auggie", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/auggie-suite-32.png", type: "image/png", sizes: "32x32" },
      { url: "/auggie-suite-64.png", type: "image/png", sizes: "64x64" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/auggie-suite-apple.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#efeae3" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="auggie-suite" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{var p=localStorage.getItem('atlas.appearance.v1');if(!['light','dark','system'].includes(p))p='system';var t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.atlasAppearance=p;document.documentElement.dataset.atlasTheme=t;}catch{document.documentElement.dataset.atlasAppearance='system';document.documentElement.dataset.atlasTheme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}`}}/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
