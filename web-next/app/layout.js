import '@web/assets/fonts.css';
import '@web/assets/tokens.css';
import '@web/assets/base.css';

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Layar pembuka: harus berjalan sebelum isi halaman, tanpa async/defer. */}
        <script src="/pembuka.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
