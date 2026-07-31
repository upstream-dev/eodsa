import type { ReactNode } from 'react';

/**
 * Tablet-safe shell for /backend*.
 * Forces compositor-safe painting (no blur/filters/transforms/shadows)
 * so Chrome/WebKit on Android + iPadOS tablets don't leave ghost trails.
 */
export default function BackendLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .backend-safe {
          background: #050505 !important;
          min-height: 100dvh;
          isolation: isolate;
        }
        .backend-safe,
        .backend-safe *,
        .backend-safe *::before,
        .backend-safe *::after {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          filter: none !important;
          transform: none !important;
          translate: none !important;
          scale: none !important;
          rotate: none !important;
          perspective: none !important;
          animation: none !important;
          transition: none !important;
          box-shadow: none !important;
          text-shadow: none !important;
          will-change: auto !important;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>
      <div className="backend-safe">{children}</div>
    </>
  );
}
