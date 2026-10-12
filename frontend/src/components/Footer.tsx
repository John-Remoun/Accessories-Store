import React from 'react';
import { Globe } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import stackDark from '../assets/stack-dark.png';
import stackLight from '../assets/stack-light.png';

export const Footer: React.FC = () => {
  const { theme } = useTheme();

  const isDark = 
    theme === 'dark' || 
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) ||
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const logoSrc = isDark ? (stackDark || '/stack-dark.png') : (stackLight || '/stack-light.png');

  return (
    <footer 
      className="w-full max-w-5xl mx-auto rounded-2xl sm:rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl p-4 sm:p-5 transition-all duration-300 shadow-xs hover:border-primary/30"
      dir="ltr"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-center sm:text-left px-2 sm:px-4">

        {/* Left Side: Clean Logo + Tagline */}
        <div className="flex flex-col items-center sm:items-start space-y-1">
          <img
            src={logoSrc}
            alt="STACK"
            className="h-8 sm:h-9 w-auto object-contain transition-opacity duration-300 hover:opacity-85"
          />
          <p className="text-xs text-muted-foreground font-medium max-w-sm sm:max-w-md leading-relaxed">
            Building Digital Solutions. Powering Retail &amp; Commerce.
          </p>
        </div>

        {/* Right Side: Social Icons */}
        <div className="flex items-center gap-2.5">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/stack__eg/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            title="Instagram"
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] hover:border-transparent hover:scale-105 transition-all duration-200 shadow-xs"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2c2.7 0 3.05.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.25.64.42 1.37.47 2.43C21.99 8.95 22 9.3 22 12s-.01 3.05-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.64.25-1.37.42-2.43.47C15.05 21.99 14.7 22 12 22s-3.05-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.64-.42-1.37-.47-2.43C2.01 15.05 2 14.7 2 12s.01-3.05.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.22 1.15-1.77A4.9 4.9 0 0 1 5.45.53C6.09.28 6.82.11 7.88.06 8.95.01 9.3 0 12 0zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm6.4-8.4a1.17 1.17 0 1 0 0-2.34 1.17 1.17 0 0 0 0 2.34z" />
            </svg>
          </a>

          {/* Facebook */}
          <a
            href="https://www.facebook.com/profile.php?id=61593537188322"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            title="Facebook"
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-[#1877F2] hover:border-transparent hover:scale-105 transition-all duration-200 shadow-xs"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
            </svg>
          </a>

          {/* WhatsApp */}
          <a
            href="https://wa.me/201204292945?text=Hello%20I%20would%20like%20to%20contact%20you"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            title="WhatsApp"
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-[#25D366] hover:border-transparent hover:scale-105 transition-all duration-200 shadow-xs"
          >
            <svg
              className="w-3.5 h-3.5 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 18.1h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.25-4.33c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.18-8.25 8.18zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.99-1.22a7.5 7.5 0 0 1-1.38-1.72c-.15-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48c-.16 0-.43.06-.66.31-.23.24-.86.85-.86 2.06 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.75.59.25 1.06.4 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.23-.16-.48-.28z" />
            </svg>
          </a>

          {/* Website */}
          <a
            href="https://stackeg.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website"
            title="Website"
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-muted/50 border border-border/80 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-primary hover:border-transparent hover:scale-105 transition-all duration-200 shadow-xs"
          >
            <Globe size={15} />
          </a>
        </div>

      </div>
    </footer>
  );
};
