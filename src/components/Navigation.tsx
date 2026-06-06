import {
  TrendingUp,
  Calculator,
  BarChart3,
  GitCompare,
  LineChart,
  Radar,
  Newspaper,
  Layers,
} from "lucide-react";

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const links = [
    { id: "home", label: "Ana Sayfa", icon: TrendingUp },
    { id: "stocks", label: "Hisseler", icon: BarChart3 },
    { id: "sectors", label: "Sektörler", icon: GitCompare },
    { id: "technical-analysis", label: "Teknik Analiz", icon: LineChart },
    { id: "score-comparison", label: "Skor Karşılaştırma", icon: Radar },
    { id: "recommendation-comparison", label: "Kurum Önerileri", icon: Layers },
    { id: "company-news", label: "Şirket Haberleri", icon: Newspaper },
    { id: "calculator", label: "Hesaplama", icon: Calculator },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-cyan-500/10 bg-gradient-to-b from-[#0a0e27]/96 via-[#0f1538]/92 to-[#0a0e27]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="group flex shrink-0 items-center gap-2 py-1 text-left"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30 transition-shadow group-hover:shadow-cyan-500/50">
            <span className="text-sm font-semibold leading-none text-white">%100</span>
          </div>
          <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text leading-tight text-transparent">
            Yüzde Yüz Yatırım
          </span>
        </button>

        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-end overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
          <div className="flex flex-nowrap items-center gap-1 sm:gap-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = currentPage === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onNavigate(link.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm leading-none transition-colors sm:px-4 ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-inset ring-cyan-400/35"
                      : "text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden whitespace-nowrap sm:inline">{link.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
