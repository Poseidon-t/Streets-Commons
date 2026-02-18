interface DemoBannerProps {
  onExit: () => void;
  onUnlock: () => void;
}

export default function DemoBanner({ onExit, onUnlock }: DemoBannerProps) {
  return (
    <div className="fixed top-16 left-0 right-0 z-[70] bg-gradient-to-r from-terra/90 to-terra-dark/90 backdrop-blur-sm text-white px-4 py-2.5 shadow-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
          <span className="font-medium">You're viewing a demo</span>
          <span className="hidden sm:inline text-white/70">— Portland, OR</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="text-xs font-medium text-white/80 hover:text-white transition"
          >
            Exit Demo
          </button>
          <button
            onClick={onUnlock}
            className="px-3 py-1.5 bg-white text-terra text-xs font-bold rounded-lg hover:bg-white/90 transition"
          >
            Unlock All Features — $49
          </button>
        </div>
      </div>
    </div>
  );
}
