import { type PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

// Web-only document shell. Ignored on native. Adds the deep backdrop behind the
// framed game (see AppShell) on top of expo-router's ScrollView reset.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BODY_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BODY_CSS = `
body { background-color: #07090D; overscroll-behavior: none; }
`;
