export const theme = {
  colors: {
    // Light mode colors
    light: {
      background: "#ffffff",
      foreground: "#0f172a",
      card: "#ffffff",
      cardForeground: "#0f172a",
      popover: "#ffffff",
      popoverForeground: "#0f172a",
      primary: "#3b82f6",
      primaryForeground: "#f8fafc",
      secondary: "#f1f5f9",
      secondaryForeground: "#0f172a",
      muted: "#f8fafc",
      mutedForeground: "#64748b",
      accent: "#f1f5f9",
      accentForeground: "#0f172a",
      destructive: "#ef4444",
      destructiveForeground: "#f8fafc",
      border: "#e2e8f0",
      input: "#e2e8f0",
      ring: "#3b82f6",
    },
    // Dark mode colors
    dark: {
      background: "#0f172a",
      foreground: "#f8fafc",
      card: "#0f172a",
      cardForeground: "#f8fafc",
      popover: "#0f172a",
      popoverForeground: "#f8fafc",
      primary: "#60a5fa",
      primaryForeground: "#0f172a",
      secondary: "#1e293b",
      secondaryForeground: "#f8fafc",
      muted: "#1e293b",
      mutedForeground: "#94a3b8",
      accent: "#1e293b",
      accentForeground: "#f8fafc",
      destructive: "#dc2626",
      destructiveForeground: "#f8fafc",
      border: "#334155",
      input: "#334155",
      ring: "#e0e7ff",
    },
  },
  fonts: {
    sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
    mono: ["var(--font-geist-mono)", "Consolas", "monospace"],
  },
  spacing: {
    container: {
      padding: "1rem",
      maxWidth: "1200px",
    },
  },
  radius: "0.5rem",
} as const;

export type Theme = typeof theme;
