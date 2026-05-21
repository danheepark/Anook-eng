import type { Metadata } from "next";
import "@/styles/globals.css";
import Toast from "@/components/ui/Modal/Toast";
import NetworkStatusListener from "@/app/NetworkStatusListener";
import TitleUpdater from "@/app/TitleUpdater";

export const metadata: Metadata = {
  title: "아늑 - AI 호텔 관리 시스템",
  description:
    "고객 요청을 AI가 분석하여 태스크를 자동 생성하고, 적합한 직원에게 분배하는 차세대 호텔 운영 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <NetworkStatusListener />
        <TitleUpdater />
        {children}
        <Toast />
      </body>
    </html>
  );
}
