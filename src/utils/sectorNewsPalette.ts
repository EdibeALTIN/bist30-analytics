/**
 * Sektör → kart + banner görsel kimliği.
 * banner*: yalnızca üst bant; çok katmanlı gradyan / ışık (CSS, görsel ayrışma).
 */
export type SectorNewsPalette = {
  key: string;
  bannerPattern: "diagonal" | "grid" | "dots" | "rings" | "waves";
  headerGradient: string;
  /** İkinci katman: özellikle sağ tarafta derinlik & renk (birden çok radial/linear) */
  bannerAtmosphere: string;
  /** İnce ışın / konik vurgu, genelde sağ */
  bannerRays: string;
  /** Üst-sağ yumuşak ışık lekesi (radial) */
  orbTop: string;
  /** Sol-alt gölge / derinlik */
  orbBottom: string;
  /** Ticker metin ışıması (text-shadow rengi, rgba) */
  tickerGlow: string;
  headerText: string;
  subText: string;
  border: string;
  glow: string;
  sectionTint: string;
  accentLine: string;
};

const FB_ATM = {
  a: "radial-gradient(ellipse 100% 85% at 100% 0%, rgba(6,182,212,0.32) 0%, transparent 52%),radial-gradient(ellipse 50% 45% at 20% 100%, rgba(15,23,42,0.5) 0%, transparent 55%)",
  b: "radial-gradient(ellipse 90% 80% at 100% 20%, rgba(139,92,246,0.28) 0%, transparent 50%),radial-gradient(circle at 0% 60%, rgba(15,23,42,0.4) 0%, transparent 45%)",
  c: "radial-gradient(ellipse 95% 90% at 100% 10%, rgba(59,130,246,0.3) 0%, transparent 55%),radial-gradient(ellipse 40% 50% at 5% 90%, rgba(2,6,23,0.6) 0%, transparent 50%)",
};

const FB_RAYS = {
  a: "conic-gradient(from -25deg at 100% 35%, rgba(34,211,238,0.12), transparent 42%)",
  b: "conic-gradient(from 200deg at 100% 45%, rgba(167,139,250,0.12), transparent 40%)",
  c: "conic-gradient(from 165deg at 100% 50%, rgba(96,165,250,0.12), transparent 38%)",
};

const FALLBACKS: SectorNewsPalette[] = [
  {
    key: "fb1",
    bannerPattern: "grid",
    headerGradient:
      "linear-gradient(125deg, rgba(4,20,30,0.95) 0%, rgba(6,182,212,0.25) 35%, rgba(8,12,20,0.98) 70%)",
    bannerAtmosphere: FB_ATM.a,
    bannerRays: FB_RAYS.a,
    orbTop: "radial-gradient(ellipse 70% 60% at 90% 5%, rgba(255,255,255,0.12) 0%, transparent 50%)",
    orbBottom: "radial-gradient(circle at 5% 95%, rgba(0,0,0,0.45) 0%, transparent 45%)",
    tickerGlow: "rgba(34, 211, 238, 0.35)",
    headerText: "#ecfeff",
    subText: "rgba(207,250,254,0.88)",
    border: "rgba(34,211,238,0.5)",
    glow: "0 0 48px rgba(34,211,238,0.18)",
    sectionTint: "rgba(6,182,212,0.08)",
    accentLine: "linear-gradient(90deg, rgba(34,211,238,0.95), transparent)",
  },
  {
    key: "fb2",
    bannerPattern: "dots",
    headerGradient:
      "linear-gradient(130deg, rgba(20,12,40,0.95) 0%, rgba(88,60,200,0.2) 40%, rgba(10,8,18,0.98) 72%)",
    bannerAtmosphere: FB_ATM.b,
    bannerRays: FB_RAYS.b,
    orbTop: "radial-gradient(ellipse 65% 55% at 95% 8%, rgba(199,180,255,0.1) 0%, transparent 48%)",
    orbBottom: "radial-gradient(circle at 8% 88%, rgba(0,0,0,0.4) 0%, transparent 48%)",
    tickerGlow: "rgba(167, 139, 250, 0.32)",
    headerText: "#f5f3ff",
    subText: "rgba(221,214,254,0.88)",
    border: "rgba(167,139,250,0.48)",
    glow: "0 0 44px rgba(139,92,246,0.16)",
    sectionTint: "rgba(139,92,246,0.07)",
    accentLine: "linear-gradient(90deg, rgba(167,139,250,0.9), transparent)",
  },
  {
    key: "fb3",
    bannerPattern: "rings",
    headerGradient:
      "linear-gradient(128deg, rgba(8,15,32,0.98) 0%, rgba(30,80,180,0.22) 38%, rgba(6,10,18,0.98) 70%)",
    bannerAtmosphere: FB_ATM.c,
    bannerRays: FB_RAYS.c,
    orbTop: "radial-gradient(ellipse 75% 65% at 100% 0%, rgba(147,197,253,0.12) 0%, transparent 52%)",
    orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.42) 0%, transparent 50%)",
    tickerGlow: "rgba(96, 165, 250, 0.35)",
    headerText: "#eff6ff",
    subText: "rgba(191,219,254,0.88)",
    border: "rgba(96,165,250,0.5)",
    glow: "0 0 46px rgba(59,130,246,0.18)",
    sectionTint: "rgba(59,130,246,0.08)",
    accentLine: "linear-gradient(90deg, rgba(96,165,250,0.9), transparent)",
  },
];

const RULES: { test: (n: string) => boolean; palette: SectorNewsPalette }[] = [
  {
    test: (n) => /banka|finans|faktoring|sigorta|menkul|yatırım ortaklığı/i.test(n),
    palette: {
      key: "finance",
      bannerPattern: "rings",
      headerGradient:
        "linear-gradient(122deg, rgba(2,8,20,0.98) 0%, rgba(8,50,100,0.5) 28%, rgba(10,30,60,0.45) 52%, rgba(4,6,12,0.99) 78%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 110% 100% at 100% 8%, rgba(14,165,233,0.45) 0%, transparent 50%),radial-gradient(ellipse 50% 55% at 70% 90%, rgba(8,30,60,0.55) 0%, transparent 50%),linear-gradient(105deg, transparent 20%, rgba(30,100,200,0.12) 100%)",
      bannerRays:
        "conic-gradient(from 195deg at 100% 42%, rgba(56,189,248,0.2), rgba(8,100,200,0.05) 28%, transparent 45%)",
      orbTop: "radial-gradient(ellipse 80% 70% at 95% 2%, rgba(125,200,255,0.2) 0%, transparent 55%)",
      orbBottom: "radial-gradient(ellipse 55% 50% at 0% 100%, rgba(0,0,0,0.5) 0%, transparent 55%)",
      tickerGlow: "rgba(56, 189, 248, 0.38)",
      headerText: "#f0f9ff",
      subText: "rgba(186,230,253,0.92)",
      border: "rgba(56,189,248,0.55)",
      glow: "0 0 56px rgba(14,165,233,0.22)",
      sectionTint: "rgba(14,165,233,0.1)",
      accentLine: "linear-gradient(90deg, rgba(56,189,248,0.95), transparent)",
    },
  },
  {
    test: (n) => /enerji|elektrik|petrol|güneş|rafineri/i.test(n),
    palette: {
      key: "energy",
      bannerPattern: "waves",
      headerGradient:
        "linear-gradient(118deg, rgba(20,8,0,0.95) 0%, rgba(90,50,0,0.4) 32%, rgba(50,20,0,0.35) 55%, rgba(5,3,0,0.98) 82%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 90% at 100% 0%, rgba(250,200,30,0.35) 0%, transparent 48%),radial-gradient(ellipse 60% 50% at 10% 100%, rgba(40,20,0,0.5) 0%, transparent 52%),repeating-linear-gradient(0deg, transparent, transparent 14px, rgba(220,150,0,0.03) 14px, rgba(220,150,0,0.03) 15px)",
      bannerRays: "conic-gradient(from 210deg at 100% 38%, rgba(252,180,0,0.15), rgba(200,100,0,0.05) 30%, transparent 48%)",
      orbTop: "radial-gradient(ellipse 90% 75% at 100% 5%, rgba(255,200,100,0.2) 0%, transparent 50%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.5) 0%, transparent 48%)",
      tickerGlow: "rgba(253, 230, 138, 0.4)",
      headerText: "#fffbeb",
      subText: "rgba(254,240,138,0.9)",
      border: "rgba(250,204,21,0.52)",
      glow: "0 0 50px rgba(250,204,21,0.2)",
      sectionTint: "rgba(250,204,21,0.08)",
      accentLine: "linear-gradient(90deg, rgba(250,204,21,0.9), transparent)",
    },
  },
  {
    test: (n) => /gayrimenkul|gyo|inşaat|yapı|beton|çimento|taahhüt/i.test(n),
    palette: {
      key: "realestate",
      bannerPattern: "diagonal",
      headerGradient:
        "linear-gradient(120deg, rgba(0,30,20,0.98) 0%, rgba(4,64,50,0.55) 30%, rgba(2,30,30,0.4) 58%, rgba(2,6,8,0.99) 85%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 85% at 100% 5%, rgba(20,200,150,0.4) 0%, transparent 50%),radial-gradient(ellipse 45% 40% at 75% 95%, rgba(0,30,20,0.5) 0%, transparent 50%),repeating-linear-gradient(-30deg, transparent, transparent 4px, rgba(45,180,120,0.04) 4px, rgba(45,180,120,0.04) 5px)",
      bannerRays: "conic-gradient(from -40deg at 100% 40%, rgba(45,200,150,0.16), rgba(0,50,40,0.08) 32%, transparent 45%)",
      orbTop: "radial-gradient(ellipse 70% 60% at 100% 0%, rgba(110,255,200,0.12) 0%, transparent 55%)",
      orbBottom: "radial-gradient(ellipse 50% 45% at 0% 100%, rgba(0,0,0,0.45) 0%, transparent 50%)",
      tickerGlow: "rgba(52, 211, 153, 0.38)",
      headerText: "#ecfdf5",
      subText: "rgba(167,243,208,0.92)",
      border: "rgba(52,211,153,0.52)",
      glow: "0 0 52px rgba(16,185,129,0.22)",
      sectionTint: "rgba(16,185,129,0.1)",
      accentLine: "linear-gradient(90deg, rgba(52,211,153,0.92), transparent)",
    },
  },
  {
    test: (n) => /otomotiv|otomobil|parça|lastik|taşıt/i.test(n),
    palette: {
      key: "auto",
      bannerPattern: "grid",
      headerGradient:
        "linear-gradient(125deg, rgba(10,12,18,0.99) 0%, rgba(40,50,70,0.5) 35%, rgba(20,30,50,0.4) 55%, rgba(3,4,8,0.99) 82%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 90% at 100% 10%, rgba(100,120,150,0.32) 0%, transparent 52%),radial-gradient(circle at 0% 80%, rgba(0,0,0,0.4) 0%, transparent 45%),linear-gradient(80deg, rgba(40,50,60,0.2) 0%, transparent 60%)",
      bannerRays: "conic-gradient(from 180deg at 100% 50%, rgba(148,163,184,0.14), transparent 42%)",
      orbTop: "radial-gradient(ellipse 65% 55% at 100% 0%, rgba(180,200,220,0.1) 0%, transparent 50%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.45) 0%, transparent 50%)",
      tickerGlow: "rgba(186, 198, 214, 0.35)",
      headerText: "#f8fafc",
      subText: "rgba(203,213,225,0.9)",
      border: "rgba(148,163,184,0.48)",
      glow: "0 0 42px rgba(148,163,184,0.16)",
      sectionTint: "rgba(148,163,184,0.08)",
      accentLine: "linear-gradient(90deg, rgba(203,213,225,0.88), transparent)",
    },
  },
  {
    test: (n) => /teknoloji|yazılım|bilişim|iletisim|i̇letişim|chip/i.test(n),
    palette: {
      key: "tech",
      bannerPattern: "dots",
      headerGradient:
        "linear-gradient(122deg, rgba(8,4,32,0.99) 0%, rgba(60,40,140,0.45) 32%, rgba(30,20,80,0.4) 58%, rgba(4,2,10,0.99) 85%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 95% at 100% 0%, rgba(99,60,200,0.4) 0%, transparent 48%),radial-gradient(ellipse 50% 45% at 20% 100%, rgba(20,0,50,0.5) 0%, transparent 50%)",
      bannerRays: "conic-gradient(from 200deg at 100% 45%, rgba(129,110,255,0.2), rgba(50,0,100,0.08) 30%, transparent 45%)",
      orbTop: "radial-gradient(ellipse 80% 70% at 95% 5%, rgba(180,150,255,0.15) 0%, transparent 52%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.5) 0%, transparent 48%)",
      tickerGlow: "rgba(129, 140, 248, 0.4)",
      headerText: "#eef2ff",
      subText: "rgba(199,210,254,0.92)",
      border: "rgba(129,140,248,0.52)",
      glow: "0 0 50px rgba(99,102,241,0.22)",
      sectionTint: "rgba(99,102,241,0.1)",
      accentLine: "linear-gradient(90deg, rgba(129,140,248,0.95), transparent)",
    },
  },
  {
    test: (n) => /gıda|içecek|tarim|i̇çki|fırın/i.test(n),
    palette: {
      key: "food",
      bannerPattern: "diagonal",
      headerGradient:
        "linear-gradient(118deg, rgba(30,8,0,0.98) 0%, rgba(120,40,0,0.35) 38%, rgba(50,20,0,0.3) 60%, rgba(8,2,0,0.99) 86%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 90% at 100% 5%, rgba(250,150,50,0.3) 0%, transparent 48%),radial-gradient(ellipse 40% 50% at 0% 100%, rgba(30,0,0,0.45) 0%, transparent 50%)",
      bannerRays: "conic-gradient(from 195deg at 100% 40%, rgba(249,150,50,0.16), transparent 40%)",
      orbTop: "radial-gradient(ellipse 70% 60% at 100% 0%, rgba(255,200,100,0.1) 0%, transparent 50%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.45) 0%, transparent 50%)",
      tickerGlow: "rgba(254, 215, 170, 0.38)",
      headerText: "#fff7ed",
      subText: "rgba(254,215,170,0.9)",
      border: "rgba(251,146,60,0.48)",
      glow: "0 0 46px rgba(249,115,22,0.18)",
      sectionTint: "rgba(249,115,22,0.08)",
      accentLine: "linear-gradient(90deg, rgba(251,146,60,0.9), transparent)",
    },
  },
  {
    test: (n) => /çelik|demir|metal|maden|alüminyum|bakır/i.test(n),
    palette: {
      key: "metal",
      bannerPattern: "grid",
      headerGradient:
        "linear-gradient(128deg, rgba(10,12,16,0.99) 0%, rgba(50,55,70,0.5) 40%, rgba(30,40,50,0.45) 60%, rgba(3,4,6,0.99) 84%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 95% 85% at 100% 10%, rgba(100,120,150,0.25) 0%, transparent 50%),radial-gradient(circle at 0% 90%, rgba(0,0,0,0.4) 0%, transparent 48%)",
      bannerRays: "conic-gradient(from 170deg at 100% 48%, rgba(148,163,184,0.12), transparent 42%)",
      orbTop: "radial-gradient(ellipse 60% 50% at 100% 0%, rgba(200,220,255,0.08) 0%, transparent 50%)",
      orbBottom: "radial-gradient(ellipse 45% 40% at 0% 100%, rgba(0,0,0,0.48) 0%, transparent 52%)",
      tickerGlow: "rgba(100, 116, 139, 0.35)",
      headerText: "#f8fafc",
      subText: "rgba(203,213,225,0.9)",
      border: "rgba(148,163,184,0.5)",
      glow: "0 0 42px rgba(148,163,184,0.18)",
      sectionTint: "rgba(148,163,184,0.09)",
      accentLine: "linear-gradient(90deg, rgba(203,213,225,0.85), transparent)",
    },
  },
  {
    test: (n) => /kimya|ilaç|sağlık|hastane|ecza/i.test(n),
    palette: {
      key: "chem",
      bannerPattern: "dots",
      headerGradient:
        "linear-gradient(120deg, rgba(25,0,15,0.99) 0%, rgba(100,0,50,0.3) 35%, rgba(50,0,30,0.25) 58%, rgba(6,0,4,0.99) 86%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 90% at 100% 0%, rgba(220,50,120,0.25) 0%, transparent 50%),radial-gradient(ellipse 50% 50% at 0% 100%, rgba(20,0,10,0.5) 0%, transparent 50%)",
      bannerRays: "conic-gradient(from 205deg at 100% 42%, rgba(244,100,150,0.15), transparent 40%)",
      orbTop: "radial-gradient(ellipse 70% 60% at 100% 0%, rgba(255,150,200,0.1) 0%, transparent 52%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.45) 0%, transparent 50%)",
      tickerGlow: "rgba(251, 182, 206, 0.38)",
      headerText: "#fdf2f8",
      subText: "rgba(251,207,232,0.9)",
      border: "rgba(244,114,182,0.48)",
      glow: "0 0 44px rgba(236,72,153,0.18)",
      sectionTint: "rgba(236,72,153,0.08)",
      accentLine: "linear-gradient(90deg, rgba(244,114,182,0.9), transparent)",
    },
  },
  {
    test: (n) => /perakende|mağaza|toptan|ticaret/i.test(n),
    palette: {
      key: "retail",
      bannerPattern: "diagonal",
      headerGradient:
        "linear-gradient(124deg, rgba(0,20,5,0.99) 0%, rgba(0,50,20,0.4) 36%, rgba(0,30,10,0.35) 58%, rgba(0,4,2,0.99) 85%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 88% at 100% 8%, rgba(34,200,100,0.3) 0%, transparent 50%),radial-gradient(ellipse 45% 50% at 0% 100%, rgba(0,10,0,0.45) 0%, transparent 50%)",
      bannerRays: "conic-gradient(from 190deg at 100% 40%, rgba(50,200,100,0.12), transparent 42%)",
      orbTop: "radial-gradient(ellipse 60% 50% at 100% 0%, rgba(150,255,180,0.1) 0%, transparent 50%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.4) 0%, transparent 48%)",
      tickerGlow: "rgba(134, 239, 172, 0.35)",
      headerText: "#f0fdf4",
      subText: "rgba(187,247,208,0.9)",
      border: "rgba(74,222,128,0.48)",
      glow: "0 0 40px rgba(34,197,94,0.16)",
      sectionTint: "rgba(34,197,94,0.08)",
      accentLine: "linear-gradient(90deg, rgba(74,222,128,0.9), transparent)",
    },
  },
  {
    test: (n) => /sanayi|imalat|makine|üretim|endüstriyel|beyaz eşya/i.test(n),
    palette: {
      key: "industry",
      bannerPattern: "waves",
      headerGradient:
        "linear-gradient(124deg, rgba(8,10,12,0.99) 0%, rgba(20,32,40,0.5) 38%, rgba(10,20,30,0.4) 58%, rgba(2,3,4,0.99) 86%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 88% at 100% 8%, rgba(6,100,120,0.15) 0%, transparent 50%),radial-gradient(ellipse 50% 45% at 0% 100%, rgba(0,0,0,0.45) 0%, transparent 50%),repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(100,120,128,0.04) 11px, rgba(100,120,128,0.04) 12px)",
      bannerRays: "conic-gradient(from 175deg at 100% 47%, rgba(6, 182, 212, 0.1), rgba(20, 40, 50, 0.08) 32%, transparent 45%)",
      orbTop: "radial-gradient(ellipse 70% 55% at 100% 0%, rgba(100, 180, 200, 0.08) 0%, transparent 50%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.5) 0%, transparent 52%)",
      tickerGlow: "rgba(6, 182, 212, 0.3)",
      headerText: "#f1f5f9",
      subText: "rgba(200, 220, 230, 0.9)",
      border: "rgba(100, 150, 170, 0.45)",
      glow: "0 0 44px rgba(6, 182, 212, 0.12)",
      sectionTint: "rgba(6, 182, 212, 0.06)",
      accentLine: "linear-gradient(90deg, rgba(6, 182, 212, 0.75), transparent)",
    },
  },
  {
    test: (n) => /hava|turizm|otel|lokant|ulaşım|denizcilik/i.test(n),
    palette: {
      key: "travel",
      bannerPattern: "waves",
      headerGradient:
        "linear-gradient(123deg, rgba(0,15,30,0.99) 0%, rgba(0,60,80,0.35) 40%, rgba(0,30,50,0.3) 62%, rgba(0,2,6,0.99) 88%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 92% at 100% 0%, rgba(0,180,200,0.3) 0%, transparent 50%),radial-gradient(ellipse 50% 50% at 0% 100%, rgba(0,10,20,0.5) 0%, transparent 50%)",
      bannerRays: "conic-gradient(from 200deg at 100% 45%, rgba(34,200,255,0.16), rgba(0,50,60,0.1) 28%, transparent 45%)",
      orbTop: "radial-gradient(ellipse 80% 70% at 100% 0%, rgba(100,255,255,0.1) 0%, transparent 55%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.45) 0%, transparent 50%)",
      tickerGlow: "rgba(100, 220, 255, 0.4)",
      headerText: "#ecfeff",
      subText: "rgba(165,243,252,0.9)",
      border: "rgba(34,211,238,0.5)",
      glow: "0 0 48px rgba(6,182,212,0.2)",
      sectionTint: "rgba(6,182,212,0.08)",
      accentLine: "linear-gradient(90deg, rgba(34,211,238,0.9), transparent)",
    },
  },
  {
    test: (n) => /\bholding\b|grup holding/i.test(n),
    palette: {
      key: "holding",
      bannerPattern: "grid",
      headerGradient:
        "linear-gradient(120deg, rgba(8,8,20,0.99) 0%, rgba(20,20,50,0.4) 32%, rgba(30,20,0,0.15) 55%, rgba(2,2,6,0.99) 84%)",
      bannerAtmosphere:
        "radial-gradient(ellipse 100% 90% at 100% 5%, rgba(200,180,50,0.2) 0%, transparent 48%),radial-gradient(ellipse 50% 55% at 0% 100%, rgba(0,0,0,0.5) 0%, transparent 50%),linear-gradient(100deg, rgba(15,20,50,0.3) 0%, transparent 55%)",
      bannerRays: "conic-gradient(from 188deg at 100% 38%, rgba(200,180,100,0.12), rgba(20,20,40,0.1) 35%, transparent 45%)",
      orbTop: "radial-gradient(ellipse 70% 60% at 95% 0%, rgba(255,220,120,0.1) 0%, transparent 50%)",
      orbBottom: "radial-gradient(circle at 0% 100%, rgba(0,0,0,0.5) 0%, transparent 50%)",
      tickerGlow: "rgba(250, 204, 21, 0.32)",
      headerText: "#fffbeb",
      subText: "rgba(250, 230, 200, 0.9)",
      border: "rgba(200, 180, 60, 0.45)",
      glow: "0 0 48px rgba(200, 180, 60, 0.15)",
      sectionTint: "rgba(200, 180, 60, 0.08)",
      accentLine: "linear-gradient(90deg, rgba(200, 180, 100, 0.85), transparent)",
    },
  },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getSectorNewsPalette(sector: string | null | undefined): SectorNewsPalette {
  const raw = (sector || "").trim();
  if (!raw) {
    return FALLBACKS[0]!;
  }
  const n = raw.toLowerCase();
  for (const r of RULES) {
    if (r.test(n)) return r.palette;
  }
  const idx = hashString(n) % FALLBACKS.length;
  return { ...FALLBACKS[idx]!, key: `hash-${FALLBACKS[idx]!.key}` };
}
