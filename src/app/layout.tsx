import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Documind — Answers grounded in your documents",
  description:
    "A privacy-conscious AI document assistant with local passage ranking and traceable citations.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
