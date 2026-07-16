import type { Metadata } from "next";
import { SuppressYjsPrematureAccessLogs } from "@/components/suppress-yjs-premature-access-logs";
import "./globals.css";

export const metadata: Metadata = {
  title: "English LMS",
  description: "Collaborative English class platform",
};

/** Keep in sync with SuppressYjsPrematureAccessLogs needle. */
const SUPPRESS_YJS_PREMATURE_ACCESS_SCRIPT = `(function(){if(window.__yjsPrematureAccessFiltered)return;window.__yjsPrematureAccessFiltered=true;var n="Invalid access: Add Yjs type to a document before reading data";function s(a){for(var i=0;i<a.length;i++){var x=a[i];if(typeof x==="string"&&x.indexOf(n)!==-1)return true;if(x&&typeof x==="object"&&typeof x.message==="string"&&x.message.indexOf(n)!==-1)return true;}return false;}["warn","error","log"].forEach(function(m){var o=console[m];if(typeof o!=="function")return;console[m]=function(){if(s(arguments))return;return o.apply(console,arguments);};});})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: SUPPRESS_YJS_PREMATURE_ACCESS_SCRIPT,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* UI fonts (same as the local dashboard) + editor fonts (Inter with all
            variations, Roboto, Lobster) so inline font-family styles render. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Spline+Sans+Mono:wght@400;500;600&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,400;1,700&family=Lobster&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SuppressYjsPrematureAccessLogs />
        {children}
      </body>
    </html>
  );
}
