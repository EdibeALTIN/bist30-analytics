import React, { useEffect, useState } from "react";
import { getCompanyNews } from "../api/client";
import { CompanyNewsItem, CompanyNewsResponse } from "../data/companyNews";
import { getSectorNewsPalette, SectorNewsPalette } from "../utils/sectorNewsPalette";
import { parseKeyValueBlock, type MetricPair } from "../utils/parseMetricPairs";
import "./CompanyNewsPage.css";

const W = (a: string) => `rgba(255,255,255,${a})`;

function bannerTextureStyle(p: SectorNewsPalette["bannerPattern"]): React.CSSProperties {
  switch (p) {
    case "grid":
      return {
        backgroundImage: `linear-gradient(${W("0.08")} 1px, transparent 1px), linear-gradient(90deg, ${W("0.08")} 1px, transparent 1px)`,
        backgroundSize: "22px 22px",
      };
    case "dots":
      return {
        backgroundImage: `radial-gradient(circle, ${W("0.1")} 1px, transparent 1.5px)`,
        backgroundSize: "16px 16px",
      };
    case "rings":
      return {
        backgroundImage: `repeating-radial-gradient(circle at 32% 38%, transparent 0, transparent 12px, ${W("0.05")} 12px, ${W("0.05")} 13px)`,
      };
    case "diagonal":
      return {
        backgroundImage: `repeating-linear-gradient(-32deg, transparent, transparent 3px, ${W("0.04")} 3px, ${W("0.04")} 5px)`,
      };
    case "waves":
      return {
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 10px, ${W("0.03")} 10px, ${W("0.03")} 11px), repeating-linear-gradient(90deg, transparent, transparent 20px, ${W("0.025")} 20px, ${W("0.025")} 21px)`,
      };
    default:
      return {};
  }
}

const HINT = {
  news: "Kurum bülteninden derlenen metin; yatırım tavsiyesi niteliği taşımaz, bilgilendirme amaçlıdır.",
  analyst:
    "Kurumun o dönemdeki tavsiye/fiyat dili; tam rapor, varsayımlar ve riskler olmadan tek başına yeterli değildir.",
  stock:
    "Bülten anına ait fiyat, piyasa değeri, dolaşım vb. anlık kotasyon değil; bülten kesitidir.",
  mult:
    "Çarpanlar (F/K vb.) fiyatı dönem kârı veya bilanço kalemiyle karşılaştırır; sektör ve büyüme profili olmadan tek başına yorumlanmamalıdır.",
  rel: "BIST, sektör endeksi veya emsallere kıyas dönem getirileri; kısaltmalar bültene göre değişebilir.",
} as const;

function MetricGrid({ pairs, palette }: { pairs: MetricPair[]; palette: SectorNewsPalette }) {
  const prose =
    pairs.length === 1 && pairs[0]!.label === "Detay" && pairs[0]!.value.length > 100;
  if (prose) {
    return (
      <div
        className="cnews-prose"
        style={{
          boxShadow: `inset 0 0 0 1px ${palette.border}22`,
          borderRadius: 12,
          padding: "0.75rem 0.65rem",
        }}
      >
        {pairs[0]!.value}
      </div>
    );
  }
  return (
    <div className="cnews-mgrid">
      {pairs.map((m, i) => (
        <div
          key={`${m.label}-${i}`}
          className={m.label === "Detay" && m.value.length > 120 ? "cnews-mcell cnews-mcell--wide" : "cnews-mcell"}
          style={{ boxShadow: `inset 0 0 0 1px ${palette.border}18` }}
        >
          <div className="cnews-mlab">{m.label}</div>
          <div className="cnews-mval">{m.value}</div>
          {m.hint ? <div className="cnews-mhint">{m.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

function CompanyNewsCard({ item }: { item: CompanyNewsItem }) {
  const p = getSectorNewsPalette(item.sector);
  const has = (s: string) => Boolean(s && s.trim().length > 0);
  const code = (item.companyCode || "—").toUpperCase();
  const shortAnalyst = has(item.analystView) && item.analystView.trim().length < 100;

  return (
    <article
      className="cnews-card"
      style={{
        boxShadow: `0 0 0 1px ${p.border}35, 0 24px 50px -12px rgba(0,0,0,0.55), ${p.glow}`,
      }}
    >
      <header
        className="cnews-banner"
        data-cnews-sector={p.key}
        style={{ background: p.headerGradient }}
      >
        <div
          className="cnews-banner__layer cnews-banner__atmosphere"
          style={{ background: p.bannerAtmosphere, backgroundSize: "100% 100%" }}
          aria-hidden
        />
        <div className="cnews-banner__layer cnews-banner__light cnews-banner__light--t" style={{ background: p.orbTop }} aria-hidden />
        <div
          className="cnews-banner__layer cnews-banner__texture"
          style={{
            opacity: 0.7,
            ...bannerTextureStyle(p.bannerPattern),
          }}
        />
        <div className="cnews-banner__layer cnews-banner__light cnews-banner__light--b" style={{ background: p.orbBottom }} aria-hidden />
        <div className="cnews-banner__layer cnews-banner__rays" style={{ background: p.bannerRays }} aria-hidden />
        <div className="cnews-banner__noise" />
        <div className="cnews-banner__sheen" />
        <div className="cnews-banner__content">
          <h2
            className="cnews-ticker"
            style={{
              color: p.headerText,
              textShadow: `
                0 0 1px rgba(0,0,0,0.6),
                0 1px 0 rgba(255,255,255,0.1),
                0 2px 16px rgba(0,0,0,0.5),
                0 0 32px ${p.tickerGlow}
              `,
            }}
          >
            {code}
          </h2>
          <p className="cnews-cname" style={{ color: p.subText }}>
            {item.companyName || "—"}
          </p>
          <div className="cnews-pills">
            {item.sector ? (
              <span className="cnews-pill" style={{ borderColor: `${p.border}55`, color: p.headerText }}>
                {item.sector}
              </span>
            ) : null}
            {item.reportDate ? (
              <span className="cnews-pill cnews-pill--ghost" style={{ color: p.subText }}>
                {item.reportDate}
              </span>
            ) : null}
            {item.sourceName ? (
              <span className="cnews-pill cnews-pill--ghost" style={{ color: p.subText }}>
                {item.sourceName}
              </span>
            ) : null}
            <span className="cnews-pill" style={{ borderColor: `${p.border}40`, color: p.subText }}>
              Hisse: {code}
            </span>
            {has(item.analystView) && shortAnalyst ? (
              <span className="cnews-pill" style={{ borderColor: "rgba(250,250,250,0.2)", color: p.headerText }}>
                Görüş: {item.analystView.trim()}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="cnews-card-body">
        <div className="cnews-section-spacer">
          {has(item.newsText) && (
            <div className="cnews-block" style={{ boxShadow: `inset 0 0 0 1px ${p.border}15` }}>
              <h3 style={{ color: p.subText }}>Haber & gelişmeler</h3>
              <p className="cnews-hint">{HINT.news}</p>
              <div className="cnews-prose">{item.newsText}</div>
            </div>
          )}

          {has(item.analystView) && !shortAnalyst && (
            <div className="cnews-block" style={{ boxShadow: `inset 0 0 0 1px ${p.border}15` }}>
              <h3 style={{ color: p.subText }}>Analist / kurum</h3>
              <p className="cnews-hint">{HINT.analyst}</p>
              <div className="cnews-prose">{item.analystView}</div>
            </div>
          )}

          {has(item.analystView) && shortAnalyst && !has(item.newsText) && (
            <div className="cnews-block" style={{ boxShadow: `inset 0 0 0 1px ${p.border}15` }}>
              <h3 style={{ color: p.subText }}>Kurum görüşü</h3>
              <p className="cnews-hint">{HINT.analyst}</p>
              <div className="cnews-analyst-pill" style={{ color: p.headerText }}>
                {item.analystView.trim()}
              </div>
            </div>
          )}

          {has(item.stockDataText) && (
            <div className="cnews-block" style={{ boxShadow: `inset 0 0 0 1px ${p.border}15` }}>
              <h3 style={{ color: p.subText }}>Hisse & piyasa verileri</h3>
              <p className="cnews-hint">{HINT.stock}</p>
              <MetricGrid pairs={parseKeyValueBlock(item.stockDataText)} palette={p} />
            </div>
          )}

          {has(item.marketMultiplesText) && (
            <div className="cnews-block" style={{ boxShadow: `inset 0 0 0 1px ${p.border}15` }}>
              <h3 style={{ color: p.subText }}>Piyasa çarpanları</h3>
              <p className="cnews-hint">{HINT.mult}</p>
              <MetricGrid pairs={parseKeyValueBlock(item.marketMultiplesText)} palette={p} />
            </div>
          )}

          {has(item.relativePerformanceText) && (
            <div className="cnews-block" style={{ boxShadow: `inset 0 0 0 1px ${p.border}15` }}>
              <h3 style={{ color: p.subText }}>Göreli performans</h3>
              <p className="cnews-hint">{HINT.rel}</p>
              <MetricGrid pairs={parseKeyValueBlock(item.relativePerformanceText)} palette={p} />
            </div>
          )}

          {(has(item.rawTableText) || has(item.rawBlockText)) && (
            <details className="cnews-details">
              <summary>Ham veri (tablo / blok)</summary>
              <pre>
                {has(item.rawTableText) ? `--- tablo ---\n${item.rawTableText}\n\n` : ""}
                {has(item.rawBlockText) ? `--- blok ---\n${item.rawBlockText}` : ""}
              </pre>
            </details>
          )}

          {!has(item.newsText) &&
            !has(item.analystView) &&
            !has(item.stockDataText) &&
            !has(item.marketMultiplesText) &&
            !has(item.relativePerformanceText) && (
              <p className="cnews-hint" style={{ textAlign: "center" }}>
                Bu kayıt için metin alanı boş.
              </p>
            )}
        </div>
      </div>
    </article>
  );
}

interface Props {
  onNavigate: (page: string) => void;
}

export function CompanyNewsPage({ onNavigate: _onNavigate }: Props) {
  const [data, setData] = useState<CompanyNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [dateFilter, setDateFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await getCompanyNews(dateFilter);
        if (!c) setData(res);
      } catch {
        if (!c) {
          setErr("Veri alınamadı. Backend API erişilebilir değil.");
          setData(null);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [dateFilter]);

  const weeks = data?.availableReportDates ?? [];

  return (
    <div className="cnews-page">
      {/* Navbar ile aynı yatay grid: max-w + px */}
      <div className="cnews-align w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="cnews-inner">
        <div className="cnews-hero">
          <h1>Şirket Haberleri</h1>
        </div>

        {weeks.length > 0 && !loading && (
          <div className="cnews-filter">
            <select
              id="cnews-date"
              aria-label="Rapor tarihine göre filtre"
              value={dateFilter === undefined ? "" : dateFilter}
              onChange={(e) => {
                const v = e.target.value;
                setDateFilter(v === "" ? undefined : v);
              }}
            >
              <option value="">Tüm bültenler (kronolojik)</option>
              {weeks.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading && <p className="text-center text-slate-400 text-sm">Yükleniyor…</p>}
        {err && <p className="text-center text-cyan-200/90 text-sm">{err}</p>}
        {data?.message && !data?.items?.length && (
          <p className="text-center text-amber-200/90 text-sm">{data.message}</p>
        )}

        {!loading && data && (data.count ?? 0) === 0 && !data.message && (
          <p className="text-center text-slate-500 text-sm">Henüz kayıt yok veya filtre eşleşmedi.</p>
        )}

        <div className="cnews-stack">
          {data?.items.map((it) => (
            <CompanyNewsCard key={it.id} item={it} />
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
