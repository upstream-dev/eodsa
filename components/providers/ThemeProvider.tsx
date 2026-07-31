'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

/** Avalon uses a single Chrome + Black theme — no light/dark toggle. */
type Theme = 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');
    // Clear legacy preference — Avalon is dark-only
    try {
      localStorage.removeItem('admin-theme');
    } catch {
      /* ignore */
    }
  }, []);

  const noop = () => {};

  if (!mounted) {
    return (
      <div className="min-h-screen avalon-mesh flex items-center justify-center">  <div className="text-center">  <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto" />  <p className="mt-4 text-[var(--muted-foreground)] text-sm">Loading dashboard...</p>  </div>  </div> );
  }

  return (
    <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: noop, setTheme: noop }}> {children}
    </ThemeContext.Provider> );
};

/** Avalon Chrome + Black theme classes (single theme) */
export const getThemeClasses = (_theme?: Theme | 'light' | 'dark') => {
  return {
    mainBg: 'avalon-mesh',
    loadingBg: 'avalon-mesh',

    headerBg: 'bg-[#0a0a0a]',
    headerBorder: 'border-[rgba(192,192,192,0.12)]',

    cardBg: 'bg-[#111111]',
    cardBorder: 'border-[rgba(192,192,192,0.22)]',
    cardShadow: 'shadow-xl',
    cardRadius: 'rounded-xl',
    cardPadding: 'p-6',

    sectionHeaderBg: 'bg-[rgba(192,192,192,0.06)]',
    sectionHeaderBorder: 'border-[rgba(192,192,192,0.12)]',

    textPrimary: 'text-white',
    textSecondary: 'text-[#e0e0e0]',
    textMuted: 'text-[#b8b8b8]',
    textInverse: 'text-[#050505]',

    heading1: 'font-display text-3xl chrome-text tracking-[0.08em]',
    heading2: 'font-display text-2xl text-white',
    heading3: 'text-xl font-semibold text-white',
    body: 'text-sm text-[#c0c0c0]',
    label: 'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c0c0c0]',

    tableHeader: 'bg-[rgba(192,192,192,0.06)]',
    tableHeaderText: 'text-[#c0c0c0] font-semibold',
    tableRow: 'bg-transparent',
    tableRowHover: 'hover:bg-[rgba(192,192,192,0.04)]',
    tableBorder: 'divide-[rgba(192,192,192,0.1)]',
    tableCellPadding: 'px-6 py-4',

    buttonPrimary:
      'bg-[linear-gradient(135deg,#f5f5f5_0%,#c8c8c8_22%,#9a9a9a_48%,#d4d4d4_72%,#b0b0b0_100%)] text-[#050505] hover:shadow-[0_0_24px_rgba(192,192,192,0.18)]',
    buttonSecondary:
      'bg-transparent text-[#e8e8e8] border border-[rgba(192,192,192,0.35)] hover:border-[#c0c0c0]',
    buttonSuccess: 'bg-[rgba(61,92,74,0.85)] text-white hover:bg-[rgba(61,92,74,1)]',
    buttonDanger: 'bg-[rgba(139,58,58,0.85)] text-white hover:bg-[rgba(139,58,58,1)]',
    buttonBase:
      'px-5 py-2.5 rounded-full font-semibold text-[11px] tracking-[0.14em] uppercase transition-all duration-200 shadow-lg',
    buttonDisabled: 'opacity-50 cursor-not-allowed',

    badgeBase: 'px-3 py-1 rounded-full text-xs font-medium border',
    badgeBlue: 'bg-[rgba(0,230,255,0.12)] text-[#a8e8f5] border-[rgba(0,230,255,0.3)]',
    badgeGreen: 'bg-[rgba(61,92,74,0.35)] text-[#9bb5a6] border-[rgba(107,143,122,0.35)]',
    badgeYellow: 'bg-[rgba(138,122,61,0.25)] text-[#c4b87a] border-[rgba(138,122,61,0.35)]',
    badgeRed: 'bg-[rgba(139,58,58,0.3)] text-[#f0c4c4] border-[rgba(139,58,58,0.4)]',
    badgePurple: 'bg-[rgba(255,45,161,0.12)] text-[#f5b8d8] border-[rgba(255,45,161,0.3)]',
    badgeOrange: 'bg-[rgba(184,150,62,0.2)] text-[#d4c07a] border-[rgba(184,150,62,0.35)]',
    badgeGray: 'bg-[rgba(107,107,107,0.25)] text-[#9a9a9a] border-[rgba(107,107,107,0.35)]',

    statusBlue: 'bg-[rgba(0,230,255,0.12)] text-[#a8e8f5] border-[rgba(0,230,255,0.3)]',
    statusGreen: 'bg-[rgba(61,92,74,0.35)] text-[#9bb5a6] border-[rgba(107,143,122,0.35)]',
    statusYellow: 'bg-[rgba(138,122,61,0.25)] text-[#c4b87a] border-[rgba(138,122,61,0.35)]',
    statusRed: 'bg-[rgba(139,58,58,0.3)] text-[#f0c4c4] border-[rgba(139,58,58,0.4)]',
    statusGray: 'bg-[rgba(107,107,107,0.25)] text-[#9a9a9a] border-[rgba(107,107,107,0.35)]',

    modalBg: 'bg-[#111111]',
    modalBorder: 'border-[rgba(192,192,192,0.22)]',
    modalOverlay: 'bg-black/70',

    inputBg: 'bg-black/40',
    inputBorder: 'border-[rgba(192,192,192,0.2)]',
    inputFocus: 'focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] focus:border-[rgba(192,192,192,0.5)]',

    metricCardBg: 'bg-[rgba(192,192,192,0.05)]',
    metricCardBorder: 'border-[rgba(192,192,192,0.15)]',

    navBg: 'bg-[#0a0a0a]/90',
    navBorder: 'border-[rgba(192,192,192,0.12)]',

    loadingText: 'text-[#9a9a9a]',
    loadingSpinner: 'border-[rgba(192,192,192,0.25)]',

    emptyStateBg: 'bg-[rgba(192,192,192,0.04)]',
    emptyStateText: 'text-[#b0b0b0]',

    accentGradient:
      'bg-[linear-gradient(135deg,#f5f5f5_0%,#c8c8c8_22%,#9a9a9a_48%,#d4d4d4_72%,#b0b0b0_100%)] text-[#050505]',
    accentGradientText: 'chrome-text',
    chromeBar: 'chrome-bar',
    chromeBarTitle: 'chrome-bar-title',
    chromeBarMuted: 'chrome-bar-muted',

    errorBg: 'bg-[rgba(139,58,58,0.35)]',
    errorText: 'text-[#f0c4c4]',
    errorBorder: 'border-[rgba(139,58,58,0.45)]',

    successBg: 'bg-[rgba(61,92,74,0.35)]',
    successText: 'text-[#9bb5a6]',
    successBorder: 'border-[rgba(107,143,122,0.4)]',

    filterButtonActive:
      'bg-[rgba(192,192,192,0.15)] text-white border border-[rgba(192,192,192,0.4)] shadow-lg',
    filterButtonInactive:
      'bg-transparent text-[#9a9a9a] border border-[rgba(192,192,192,0.15)] hover:bg-[rgba(192,192,192,0.06)]',

    iconContainer: 'bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.25)]',
    iconContainerSecondary: 'bg-[rgba(0,230,255,0.08)] border border-[rgba(0,230,255,0.25)]',
  };
};
