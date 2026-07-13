import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import AuthenticatedChrome from "@/components/AuthenticatedChrome";
import CorruptedPathGuard from "@/components/CorruptedPathGuard";

export const metadata: Metadata = {
  title: "Resume Generator",
  description: "Generate optimized resumes tailored to job descriptions with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=location.pathname;if(/^\\/(\\d{1,3}\\.){3}\\d{1,3}:\\d+(\\/|$)/.test(p)){location.replace(location.origin+"/");}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <CorruptedPathGuard />
          <AuthenticatedChrome>{children}</AuthenticatedChrome>
        </Providers>
      </body>
    </html>
  );
}
