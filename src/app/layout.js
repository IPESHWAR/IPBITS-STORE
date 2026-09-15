import { Geist_Mono, Vazirmatn } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UserProvider } from '@/components/UserProvider';
import TopUpModal from '@/components/TopUpModal';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-vazirmatn',
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'IPBITS STORE | پلاتفۆڕما ژیرییا دەستکرد و خزمەتگوزاریێن دیجیتاڵ',
  description: 'دەستڤەئینانا هەژمار و ئابوونه‌یێن فەرمی ب کێمترین دەم و ب پشتەڤانییا بەردەوام',
  icons: {
    icon: '/icon1.png',
    shortcut: '/icon1.png',
    apple: '/icon1.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ku"
      dir="rtl"
      suppressHydrationWarning
      className={`${vazirmatn.variable} ${vazirmatn.className} ${geistMono.variable} dark h-full scroll-smooth antialiased bg-[#090A0F] text-white`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-[#090A0F] text-white font-sans antialiased selection:bg-cyan-500/40 selection:text-white transition-colors duration-200"
      >
        <ThemeProvider>
          <LanguageProvider>
            <UserProvider>
              {children}
              <TopUpModal />
            </UserProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
