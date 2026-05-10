import type { Metadata } from "next";
import "./globals.css";
import "@/styles/workspace.css";

export const metadata: Metadata = {
  title: "Vocta",
  description: "AI-native creative production workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
