import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ระบบวิเคราะห์สถิติงานวิจัย",
  description: "เครื่องมือคำนวณและตรวจสอบสถิติสำหรับงานวิจัยทางการศึกษา",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const clearImportResultAfterSave = `
(() => {
  const syncImportedPanel = () => {
    const filebar = document.querySelector('.analysis-filebar');
    const importedPanel = document.querySelector('.imported-data');
    if (!filebar || !importedPanel) return;

    const saved = Array.from(filebar.querySelectorAll('span')).some(
      (element) => element.textContent?.trim() === 'บันทึกแล้ว',
    );

    importedPanel.style.display = saved ? 'none' : '';
  };

  const observer = new MutationObserver(syncImportedPanel);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  syncImportedPanel();
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <script dangerouslySetInnerHTML={{ __html: clearImportResultAfterSave }} />
      </body>
    </html>
  );
}
