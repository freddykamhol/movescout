import type { Metadata } from "next";
import Script from "next/script";

import AppShell from "./_components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoveScout",
  description: "Dashboard und Kundendatenbank für MoveScout",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">
        {process.env.NODE_ENV === "development" ? (
          <Script
            id="movescout-performance-measure-guard"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  try {
                    if (!globalThis.performance || typeof globalThis.performance.measure !== "function") return;
                    if (globalThis.performance.__movescoutMeasureGuardInstalled) return;
                    var original = globalThis.performance.measure.bind(globalThis.performance);
                    globalThis.performance.measure = function () {
                      try {
                        return original.apply(null, arguments);
                      } catch (error) {
                        var message = error && typeof error.message === "string" ? error.message : "";
                        if (message.indexOf("negative time stamp") !== -1) return;
                        throw error;
                      }
                    };
                    globalThis.performance.__movescoutMeasureGuardInstalled = true;
                  } catch (e) {
                    // ignore
                  }
                })();
              `,
            }}
          />
        ) : null}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
