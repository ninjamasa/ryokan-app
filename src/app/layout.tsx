import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旅館サイボーグ | Total Support",
  description:
    "旅館全体をデジタルツイン化し、従業員・お客様・注文をリアルタイムに可視化するトータルサポートアプリのプロトタイプ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
