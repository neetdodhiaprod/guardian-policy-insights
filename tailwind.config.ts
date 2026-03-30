import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body:    ['"Archivo"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Mono"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        "border-subtle": "hsl(var(--border-subtle))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "surface-sunken": "hsl(var(--surface-sunken))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          surface:    "hsl(var(--primary-surface))",
          muted:      "hsl(var(--primary-muted))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT:              "hsl(var(--sidebar-background))",
          foreground:           "hsl(var(--sidebar-foreground))",
          primary:              "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:               "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:               "hsl(var(--sidebar-border))",
          ring:                 "hsl(var(--sidebar-ring))",
        },
        // Guardian brand tokens (legacy)
        guardian: {
          azure:    "hsl(var(--guardian-azure))",
          canary:   "hsl(var(--guardian-canary))",
          pumpkin:  "hsl(var(--guardian-pumpkin))",
          sunshine: "hsl(var(--guardian-sunshine))",
          tiger:    "hsl(var(--guardian-tiger))",
        },
        // Grade palette — 3-token system (bg / text / border per grade)
        great: {
          DEFAULT:    "hsl(var(--great))",
          foreground: "hsl(var(--great-foreground))",
          bg:         "hsl(var(--grade-great-bg))",
          text:       "hsl(var(--grade-great-text))",
          border:     "hsl(var(--grade-great-border))",
        },
        good: {
          DEFAULT:    "hsl(var(--good))",
          foreground: "hsl(var(--good-foreground))",
          bg:         "hsl(var(--grade-good-bg))",
          text:       "hsl(var(--grade-good-text))",
          border:     "hsl(var(--grade-good-border))",
        },
        bad: {
          DEFAULT:    "hsl(var(--bad))",
          foreground: "hsl(var(--bad-foreground))",
          bg:         "hsl(var(--grade-bad-bg))",
          text:       "hsl(var(--grade-bad-text))",
          border:     "hsl(var(--grade-bad-border))",
        },
        unclear: {
          DEFAULT:    "hsl(var(--unclear))",
          foreground: "hsl(var(--unclear-foreground))",
          bg:         "hsl(var(--grade-unclear-bg))",
          text:       "hsl(var(--grade-unclear-text))",
          border:     "hsl(var(--grade-unclear-border))",
        },
        covered: {
          DEFAULT:    "hsl(var(--covered))",
          foreground: "hsl(var(--covered-foreground))",
          bg:         "hsl(var(--grade-good-bg))",
          text:       "hsl(var(--grade-good-text))",
          border:     "hsl(var(--grade-good-border))",
        },
        // Insurer accents
        insurer: {
          ab:    "hsl(var(--insurer-ab))",
          care:  "hsl(var(--insurer-care))",
          hdfc:  "hsl(var(--insurer-hdfc))",
          icici: "hsl(var(--insurer-icici))",
          niva:  "hsl(var(--insurer-niva))",
          star:  "hsl(var(--insurer-star))",
        },
      },
      borderRadius: {
        xs:   "var(--radius-xs)",   // 6px
        sm:   "var(--radius-sm)",   // 10px
        md:   "var(--radius-sm)",   // 10px (overrides Tailwind default)
        lg:   "var(--radius-md)",   // 14px
        xl:   "var(--radius-lg)",   // 20px
        "2xl": "var(--radius-lg)",  // 20px
        "3xl": "var(--radius-xl)",  // 24px
      },
      boxShadow: {
        'card':       'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'sm':         'var(--shadow-sm)',
        'md':         'var(--shadow-md)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "enter-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.5s ease-out forwards",
        "enter-up":       "enter-up 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
