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
    if (!importedPanel) return;

    const saved = Boolean(
      filebar &&
      Array.from(filebar.querySelectorAll('span')).some(
        (element) => element.textContent?.trim() === 'บันทึกแล้ว',
      ),
    );

    if (saved) {
      importedPanel.setAttribute('hidden', '');
      importedPanel.setAttribute('aria-hidden', 'true');
      importedPanel.style.setProperty('display', 'none', 'important');
    } else {
      importedPanel.removeAttribute('hidden');
      importedPanel.removeAttribute('aria-hidden');
      importedPanel.style.removeProperty('display');
    }
  };

  const run = () => requestAnimationFrame(syncImportedPanel);
  run();

  const observer = new MutationObserver(run);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
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
