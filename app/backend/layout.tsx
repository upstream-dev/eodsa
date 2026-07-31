import type { ReactNode } from 'react';

/**
 * Chrome-on-tablet safe shell for /backend*.
 * Firefox is fine; Chromium leaves ghost trails when many cards/layers paint.
 * Promote ONE compositor layer for the page, flatten children.
 */
export default function BackendLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .backend-safe {
          background: #050505 !important;
          min-height: 100dvh;
          /* Single GPU layer for the whole page — stops Chrome child-layer trails */
          transform: translate3d(0, 0, 0) !important;
          -webkit-transform: translate3d(0, 0, 0) !important;
          backface-visibility: hidden !important;
          -webkit-backface-visibility: hidden !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }
        .backend-safe *,
        .backend-safe *::before,
        .backend-safe *::after {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          filter: none !important;
          transform: none !important;
          -webkit-transform: none !important;
          translate: none !important;
          scale: none !important;
          rotate: none !important;
          perspective: none !important;
          animation: none !important;
          transition: none !important;
          box-shadow: none !important;
          text-shadow: none !important;
          will-change: auto !important;
          backface-visibility: hidden !important;
          -webkit-backface-visibility: hidden !important;
        }
      `}</style>
      <div className="backend-safe">{children}</div>
    </>
  );
}
