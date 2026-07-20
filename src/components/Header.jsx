const FiammaSVG = () => (
  <svg width="16" height="20" viewBox="0 0 18 24" fill="none" aria-hidden="true">
    <path d="M9 23 C3 20 1 14 3 9 C5 5 7 3 6 0 C9 4 8 8 10 10 C10 5 11 2 14 0 C14 6 12 9 14 12 C16 8 17 5 16 1 C19 6 18 13 15 18 C17 14 18 10 16 6 C18 11 17 18 13 21 C11 22 9 23 9 23 Z" fill="#F97316"/>
    <path d="M9 21 C5 18 4 13 5 9 C6 6 8 5 7 2 C9 5 8 8 10 10 C10 6 11 3 13 1 C13 6 11 9 13 12 C14 9 15 6 15 2 C17 6 16 12 14 16 C15 13 16 10 15 7 C16 11 15 17 12 20 C11 21 9 21 9 21 Z" fill="#FACC15"/>
    <path d="M9 18 C7 16 6 12 7 9 C8 7 9 6 9 4 C10 6 10 8 11 10 C11 7 12 5 13 3 C13 7 12 9 13 12 C14 10 14 7 14 5 C15 8 14 13 12 16 C11 17 10 18 9 18 Z" fill="rgba(255,255,255,0.55)"/>
  </svg>
)

const IconGitHub = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.185 6.839 9.504.5.092.682-.217.682-.482
         0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466
         -.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832
         .092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688
         -.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0
         012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595
         1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012
         2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.021C22 6.484 17.522 2 12 2z"
    />
  </svg>
)

export default function Header() {
  return (
    <header className="bg-gray-800 border-b border-gray-700 h-12 px-4 flex items-center justify-between shrink-0">

      {/* ── SINISTRA: fiamma + nome inline ── */}
      <div className="flex items-center gap-2 min-w-0">
        <FiammaSVG />
        {/* tutto su una riga: "The Sixth" grigio + "Ember" bianco */}
        <span className="text-sm whitespace-nowrap">
          <span className="text-gray-400 font-normal">The Sixth </span>
          <span className="text-white font-medium">Ember</span>
        </span>
        <span className="text-gray-600 hidden lg:inline">|</span>
        <span className="text-gray-400 text-xs hidden lg:inline whitespace-nowrap">
          Champions Damage Calculator
        </span>
      </div>

      {/* ── CENTRO: nav tab ── */}
      <nav className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
        <span className="text-xs px-3 py-1 rounded-full bg-teal-800 border border-teal-600 text-teal-200 font-medium">
          Damage Calc
        </span>
        <span className="relative text-xs px-3 py-1 rounded-full text-gray-600 cursor-not-allowed select-none">
          Speed Tier
          <span className="absolute -top-1.5 -right-1 text-[9px] bg-gray-700 text-gray-500 px-1 rounded-sm leading-tight">
            presto
          </span>
        </span>
        <span className="relative text-xs px-3 py-1 rounded-full text-gray-600 cursor-not-allowed select-none">
          Meta
          <span className="absolute -top-1.5 -right-1 text-[9px] bg-gray-700 text-gray-500 px-1 rounded-sm leading-tight">
            presto
          </span>
        </span>
      </nav>

      {/* ── DESTRA: link GitHub ── */}
      <a
        href="https://github.com/KrAros/vgc-overwhelm"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-white transition-colors shrink-0"
        aria-label="GitHub repository"
      >
        <IconGitHub />
      </a>

    </header>
  )
}