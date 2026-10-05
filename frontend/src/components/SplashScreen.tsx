import darkLogo from '../assets/dark-logo.png';

export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0C0C0C] text-foreground p-4 select-none animate-in fade-in duration-300" dir="rtl">
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Centered White Logo & Store Name */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-5">
        <img 
          src={darkLogo} 
          alt="Salla Bola & Mina" 
          className="h-32 sm:h-44 w-auto object-contain drop-shadow-[0_10px_25px_rgba(227,164,25,0.25)] animate-pulse" 
        />
        
        <div className="space-y-1">
          <p className="text-xs font-serif text-primary font-bold tracking-widest uppercase">Salla Bola & Mina</p>
        </div>

        {/* Sleek Golden Loading Ring */}
        <div className="pt-6 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      </div>
    </div>
  );
};
