"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Moon, Sun, Grid3X3 } from "lucide-react";
import { useTheme } from "next-themes";

interface AppHeaderProps {
  showPatientInfo?: boolean;
  patientUID?: string;
  mrNo?: string | number;
}

export function AppHeader({ showPatientInfo, patientUID, mrNo }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white dark:bg-gray-950 shrink-0" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between h-16 px-6">

        {/* LEFT: Logo */}
        <Link href="/" className="flex items-center gap-3 select-none group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/eyenotes-logo.png"
            alt="eyeNotes"
            className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]"
          />
        </Link>

        {/* RIGHT controls */}
        <div className="flex items-center gap-3">

          {/* Patient chips — only on detail page */}
          {showPatientInfo && patientUID && (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground font-mono bg-muted/50 border border-border/70 rounded-md px-3 py-1.5 tracking-tight shadow-2xs">
                UID: {patientUID}
              </span>
              {mrNo && (
                <span className="text-[13px] text-muted-foreground font-mono bg-muted/50 border border-border/70 rounded-md px-3 py-1.5 tracking-tight shadow-2xs">
                  MR: {mrNo}
                </span>
              )}
            </div>
          )}

          {/* Divider */}
          {showPatientInfo && <div className="hidden md:block h-6 w-px bg-border/70 mx-1" />}

          {/* Theme switch: icon only */}
          <button
            type="button"
            onClick={() => mounted && setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 rounded-full border border-border/80 bg-background hover:bg-muted text-foreground flex items-center justify-center transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={mounted && theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-[#1176bc]" />
            )}
          </button>

          {/* Apps grid */}
          <button
            type="button"
            className="w-9 h-9 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
            title="Apps"
            aria-label="Apps"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          {/* User profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-border/70">
            <div className="w-8 h-8 rounded-full bg-[#1176bc]/10 text-[#1176bc] border border-[#1176bc]/20 flex items-center justify-center font-bold text-xs shrink-0 select-none">
              VB
            </div>
            <span className="hidden sm:inline text-[13px] font-semibold text-foreground tracking-tight select-none">
              Dr Vignesh B
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}


