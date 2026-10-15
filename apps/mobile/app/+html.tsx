import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML template for Expo Router Web.
 * Enforces anti-zoom (user-scalable=no, maximum-scale=1.0) and mobile app ergonomics.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>ChatFlow</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: antiZoomStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const antiZoomStyles = `
/* Prevent zooming, double-tap zoom and rubber-banding */
html, body {
  touch-action: pan-x pan-y;
  -webkit-touch-callout: none;
  -webkit-text-size-adjust: 100%;
  overscroll-behavior: none;
  user-select: none;
  -webkit-user-select: none;
  overflow: hidden;
  height: 100%;
  width: 100%;
}

#root {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* Ensure inputs remain selectable and prevent iOS Safari auto-zoom (min 16px font-size) */
input, textarea {
  user-select: text !important;
  -webkit-user-select: text !important;
  font-size: 16px !important;
  touch-action: manipulation;
}

button {
  touch-action: manipulation;
}
`;
