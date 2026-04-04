import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* PWA — manifest scoped to /app */}
        <link rel="manifest" href="/app/manifest.json" />
        <meta name="theme-color" content="#1A1F2B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Staple" />
        <link rel="apple-touch-icon" sizes="180x180" href="/app/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="373x373" href="/app/icons/icon-373.png" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
