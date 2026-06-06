"""
Kurum önerileri karşılaştırma verisi: Halk, İş, Ziraat tablolarından agregasyon.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from database import get_latest_hisseler


def _norm_code(raw: Optional[str]) -> str:
    if raw is None:
        return ""
    return str(raw).strip().upper()


def _reco_bucket(text: Optional[str]) -> str:
    if not text:
        return "UNKNOWN"
    t = str(text).upper()
    if "SAT" in t and "AL" not in t:
        return "SAT"
    if "GÜÇLÜ" in t or "GUCLU" in t:
        if "AL" in t:
            return "STRONG_AL"
    if "AL" in t:
        return "AL"
    if "TUT" in t or "NÖTR" in t or "NOTR" in t or "NÖTR" in t:
        return "TUT"
    return "UNKNOWN"


def _reco_strength(bucket: str) -> float:
    return {
        "STRONG_AL": 4.0,
        "AL": 3.0,
        "TUT": 2.0,
        "SAT": 1.0,
        "UNKNOWN": 0.0,
    }.get(bucket, 0.0)


def _parse_ziraat_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    text = str(s).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10] if len(text) >= 10 and fmt == "%Y-%m-%d" else text, fmt)
        except ValueError:
            continue
    # son_rapor_tarihi gibi kısa tarihler
    try:
        return datetime.strptime(text, "%d.%m.%Y")
    except ValueError:
        return None


def _iso_date(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d")


def _max_dt(*dates: Optional[datetime]) -> Optional[datetime]:
    valid = [d for d in dates if d is not None]
    return max(valid) if valid else None


def _fetch_halk_report_snapshots(
    conn: sqlite3.Connection,
    *,
    fix_tr: Callable[[Optional[str]], str],
    parse_report_date: Callable[[str], Optional[datetime]],
    table_exists: Callable[[sqlite3.Connection, str], bool],
    limit: int = 96,
) -> List[Dict[str, Any]]:
    """analyst_reports + analyst_recos üzerinden Halk tarihleri (yeniden üstten)."""
    if not table_exists(conn, "analyst_recos") or not table_exists(conn, "analyst_reports"):
        return []
    rows = conn.execute(
        """
        SELECT DISTINCT ar.id AS rid, ar.report_date AS rd
        FROM analyst_reports ar
        INNER JOIN analyst_recos r ON r.report_id = ar.id
        ORDER BY
            CASE WHEN ar.report_date IS NULL OR trim(cast(ar.report_date AS TEXT)) = '' THEN 1 ELSE 0 END ASC,
            cast(ar.report_date AS TEXT) DESC,
            ar.id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    out: List[Dict[str, Any]] = []
    for row in rows:
        rid = int(row["rid"])
        raw_rd = row["rd"]
        dt = parse_report_date(str(raw_rd)) if raw_rd not in (None, "") else None
        iso = _iso_date(dt)
        lbl = iso or (fix_tr(str(raw_rd)).strip() if raw_rd else "")
        out.append({"reportId": rid, "reportDateIso": iso, "reportDateLabel": lbl or None})
    return out


def build_recommendation_comparison_payload(
    conn: sqlite3.Connection,
    *,
    fix_tr: Callable[[Optional[str]], str],
    safe_float: Callable[[Any, Any], float],
    parse_report_date: Callable[[str], Optional[datetime]],
    table_exists: Callable[[sqlite3.Connection, str], bool],
    halk_report_id: Optional[int] = None,
) -> Dict[str, Any]:

    hisse_meta: Dict[str, Dict[str, Optional[str]]] = {}
    if table_exists(conn, "hisseler"):
        for row in get_latest_hisseler(conn):
            c = _norm_code(row["sirket_kodu"])
            if c:
                hisse_meta[c] = {
                    "name": fix_tr(row["sirket_adi"]) or c,
                    "sector": fix_tr(row["sektor"]) or None,
                }

    halk_report_snapshots = _fetch_halk_report_snapshots(
        conn,
        fix_tr=fix_tr,
        parse_report_date=parse_report_date,
        table_exists=table_exists,
    )

    if halk_report_id is not None:
        chk = conn.execute(
            "SELECT 1 FROM analyst_recos WHERE report_id = ? LIMIT 1",
            (halk_report_id,),
        ).fetchone()
        if chk is None:
            raise ValueError(f"Bu rapora ait öneri satırı yok (report_id={halk_report_id}).")

    # --- Halk: belirtilen raporda snapshot veya en güncel öneri / hisse ---
    halk_by_code: Dict[str, Dict[str, Any]] = {}
    halk_latest_report_date: Optional[datetime] = None
    if table_exists(conn, "analyst_recos"):
        if halk_report_id is not None:
            rows = conn.execute(
                """
                SELECT * FROM (
                    SELECT
                        r.report_id,
                        r.sirket_kodu,
                        r.sektor,
                        r.son_fiyat,
                        r.hedef,
                        r.pot_getiri,
                        r.konsensus,
                        ROW_NUMBER() OVER (
                            PARTITION BY r.sirket_kodu
                            ORDER BY r.rowid DESC
                        ) AS rn
                    FROM analyst_recos r
                    WHERE r.report_id = ?
                ) x WHERE x.rn = 1
                """,
                (halk_report_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM (
                    SELECT
                        r.report_id,
                        r.sirket_kodu,
                        r.sektor,
                        r.son_fiyat,
                        r.hedef,
                        r.pot_getiri,
                        r.konsensus,
                        ROW_NUMBER() OVER (
                            PARTITION BY r.sirket_kodu
                            ORDER BY r.report_id DESC
                        ) AS rn
                    FROM analyst_recos r
                ) x WHERE x.rn = 1
                """
            ).fetchall()

        report_ids: Set[int] = set()
        for row in rows:
            c = _norm_code(row["sirket_kodu"])
            if not c:
                continue
            rid = row["report_id"]
            if rid is not None:
                report_ids.add(int(rid))
            halk_by_code[c] = {
                "reportId": int(rid) if rid is not None else None,
                "sector": fix_tr(row["sektor"]) if row["sektor"] else None,
                "referencePrice": safe_float(row["son_fiyat"], None) if row["son_fiyat"] is not None else None,
                "targetPrice": safe_float(row["hedef"], None) if row["hedef"] is not None else None,
                "potentialReturnPct": safe_float(row["pot_getiri"], None) if row["pot_getiri"] is not None else None,
                "recommendationRaw": fix_tr(row["konsensus"]) if row["konsensus"] else None,
                "reportDate": None,
            }

        rid_to_date_iso: Dict[int, str] = {}
        if halk_report_id is not None:
            rdrow = (
                conn.execute("SELECT report_date FROM analyst_reports WHERE id = ?", (halk_report_id,)).fetchone()
                if table_exists(conn, "analyst_reports")
                else None
            )
            dt_sel: Optional[datetime] = None
            if rdrow and rdrow["report_date"] is not None:
                dt_sel = parse_report_date(str(rdrow["report_date"]))
                if dt_sel:
                    iso_one = _iso_date(dt_sel)
                    for h in halk_by_code.values():
                        h["reportDate"] = iso_one
            halk_latest_report_date = dt_sel
        elif report_ids and table_exists(conn, "analyst_reports"):
            qmarks = ",".join("?" * len(report_ids))
            drows = conn.execute(
                f"SELECT id, report_date FROM analyst_reports WHERE id IN ({qmarks})",
                tuple(report_ids),
            ).fetchall()
            parsed_dates: List[datetime] = []
            for r in drows:
                if not r["report_date"]:
                    continue
                rid_i = int(r["id"])
                dt = parse_report_date(str(r["report_date"]))
                if dt:
                    parsed_dates.append(dt)
                    rid_to_date_iso[rid_i] = _iso_date(dt)
            halk_latest_report_date = _max_dt(*parsed_dates) if parsed_dates else None
            for h in halk_by_code.values():
                rid_h = h.get("reportId")
                if rid_h is not None and rid_h in rid_to_date_iso:
                    h["reportDate"] = rid_to_date_iso[rid_h]

    # Halk BIST30 ranking (snapshot veya güncel)
    halk_ranking: List[Dict[str, Any]] = []
    rank_by_code: Dict[str, int] = {}
    latest_rank_rid: Optional[int] = None
    if table_exists(conn, "analyst_bist30_ranking"):
        if halk_report_id is not None:
            has_rank = conn.execute(
                "SELECT 1 FROM analyst_bist30_ranking WHERE report_id = ? LIMIT 1",
                (halk_report_id,),
            ).fetchone()
            use_rid = int(halk_report_id) if has_rank else None
            if use_rid is not None:
                latest_rank_rid = use_rid
                for row in conn.execute(
                    """
                    SELECT sirket_kodu, rank, pot_getiri
                    FROM analyst_bist30_ranking
                    WHERE report_id = ?
                    ORDER BY rank ASC
                    """,
                    (latest_rank_rid,),
                ).fetchall():
                    c = _norm_code(row["sirket_kodu"])
                    if not c:
                        continue
                    rank_by_code[c] = int(row["rank"])
                    halk_ranking.append(
                        {
                            "code": c,
                            "rank": int(row["rank"]),
                            "potentialReturnPct": safe_float(row["pot_getiri"], None)
                            if row["pot_getiri"] is not None
                            else None,
                        }
                    )
        else:
            mx = conn.execute("SELECT MAX(report_id) AS m FROM analyst_bist30_ranking").fetchone()
            if mx and mx["m"] is not None:
                latest_rank_rid = int(mx["m"])
                for row in conn.execute(
                    """
                    SELECT sirket_kodu, rank, pot_getiri
                    FROM analyst_bist30_ranking
                    WHERE report_id = ?
                    ORDER BY rank ASC
                    """,
                    (latest_rank_rid,),
                ).fetchall():
                    c = _norm_code(row["sirket_kodu"])
                    if not c:
                        continue
                    rank_by_code[c] = int(row["rank"])
                    halk_ranking.append(
                        {
                            "code": c,
                            "rank": int(row["rank"]),
                            "potentialReturnPct": safe_float(row["pot_getiri"], None)
                            if row["pot_getiri"] is not None
                            else None,
                        }
                    )

    # --- İş Yatırım ---
    isy_onerileri: Dict[str, Dict[str, Any]] = {}
    if table_exists(conn, "isyatirim_onerileri"):
        for row in conn.execute(
            """
            SELECT "Kod" AS kod, "Öneri" AS oneri,
                   "Hedef Fiyat (TL)" AS hedef,
                   "Getiri Potansiyeli (%)" AS pot,
                   "Net Kar (mn TL)" AS net_kar,
                   "Satışlar (mn TL)" AS satis,
                   "FAVÖK (mn TL)" AS favok,
                   "Tahmin/Açıklanan" AS tahmin
            FROM isyatirim_onerileri
            """
        ).fetchall():
            c = _norm_code(row["kod"])
            if not c:
                continue
            isy_onerileri[c] = {
                "recommendationRaw": fix_tr(row["oneri"]) if row["oneri"] else None,
                "targetPrice": safe_float(row["hedef"], None) if row["hedef"] is not None else None,
                "potentialReturnPct": safe_float(row["pot"], None) if row["pot"] is not None else None,
                "netProfitMn": safe_float(row["net_kar"], None) if row["net_kar"] is not None else None,
                "salesMn": safe_float(row["satis"], None) if row["satis"] is not None else None,
                "ebitdaMn": safe_float(row["favok"], None) if row["favok"] is not None else None,
                "forecastLabel": fix_tr(row["tahmin"]) if row["tahmin"] else None,
            }

    isy_encok: Dict[str, Dict[str, Any]] = {}
    isy_encok_latest: Optional[datetime] = None
    encok_table = "isyatiri_encokoneri" if table_exists(conn, "isyatiri_encokoneri") else None
    if encok_table:
        for row in conn.execute(
            f"""
            SELECT "Hisse" AS hisse, "Öneri Tarihi" AS tarih, "Kapanış" AS kapanis,
                   "Hedef Fiyat" AS hedef, "Potansiyel (%)" AS pot,
                   "TL" AS tl, "USD" AS usd, "Göreceli" AS goreceli,
                   "3 Ay" AS ay3, "1 Yıl" AS y1, "Ağırlık (%)" AS agirlik
            FROM {encok_table}
            """
        ).fetchall():
            c = _norm_code(row["hisse"])
            if not c:
                continue
            dt = parse_report_date(str(row["tarih"])) if row["tarih"] else None
            if dt:
                isy_encok_latest = dt if isy_encok_latest is None else max(isy_encok_latest, dt)
            isy_encok[c] = {
                "reportDate": str(row["tarih"]).strip() if row["tarih"] else None,
                "referencePrice": safe_float(row["kapanis"], None) if row["kapanis"] is not None else None,
                "targetPrice": safe_float(row["hedef"], None) if row["hedef"] is not None else None,
                "potentialReturnPct": float(row["pot"]) if row["pot"] is not None else None,
                "perfTl": safe_float(row["tl"], None) if row["tl"] is not None else None,
                "perfUsd": safe_float(row["usd"], None) if row["usd"] is not None else None,
                "perfRelative": safe_float(row["goreceli"], None) if row["goreceli"] is not None else None,
                "perf3m": safe_float(row["ay3"], None) if row["ay3"] is not None else None,
                "perf1y": safe_float(row["y1"], None) if row["y1"] is not None else None,
                "weightPct": float(row["agirlik"]) if row["agirlik"] is not None else None,
            }

    # --- Ziraat ---
    ziraat_genel: Dict[str, Dict[str, Any]] = {}
    if table_exists(conn, "genel_takip_listesi"):
        for row in conn.execute(
            """
            SELECT hisse_kodu, onerilen_hisse, son_rapor_tarihi, rapor_linkleri,
                   oneri, hedef_fiyat_tl, source_name, report_date, loaded_at
            FROM genel_takip_listesi
            """
        ).fetchall():
            c = _norm_code(row["hisse_kodu"])
            if not c:
                continue
            rd = row["report_date"] or row["loaded_at"]
            ziraat_genel[c] = {
                "companyHint": fix_tr(row["onerilen_hisse"]) if row["onerilen_hisse"] else None,
                "reportDateRaw": str(row["son_rapor_tarihi"]).strip() if row["son_rapor_tarihi"] else None,
                "recommendationRaw": fix_tr(row["oneri"]) if row["oneri"] else None,
                "targetPrice": safe_float(row["hedef_fiyat_tl"], None) if row["hedef_fiyat_tl"] is not None else None,
                "sourceName": fix_tr(row["source_name"]) if row["source_name"] else None,
                "reportDate": str(row["report_date"]).strip() if row["report_date"] else None,
                "loadedAt": str(row["loaded_at"]).strip() if row["loaded_at"] else None,
            }

    ziraat_portfoy: Dict[str, Dict[str, Any]] = {}
    if table_exists(conn, "oneri_portfoyu"):
        for row in conn.execute(
            """
            SELECT kod, hisse_adi, giris_tarihi, guncel_hisse_fiyati, piyasa_degeri_mn_tl,
                   nominal_getiri_pct, bist100_gorece_getiri_pct, hedef_hisse_fiyati_tl,
                   potansiyel_getiri_pct, portfoy_agirligi_pct, oneri, source_name, report_date, loaded_at
            FROM oneri_portfoyu
            """
        ).fetchall():
            c = _norm_code(row["kod"])
            if not c:
                continue
            ziraat_portfoy[c] = {
                "companyHint": fix_tr(row["hisse_adi"]) if row["hisse_adi"] else None,
                "entryDate": str(row["giris_tarihi"]).strip() if row["giris_tarihi"] else None,
                "referencePrice": safe_float(row["guncel_hisse_fiyati"], None)
                if row["guncel_hisse_fiyati"] is not None
                else None,
                "marketCapMn": safe_float(row["piyasa_degeri_mn_tl"], None)
                if row["piyasa_degeri_mn_tl"] is not None
                else None,
                "nominalReturnPct": safe_float(row["nominal_getiri_pct"], None)
                if row["nominal_getiri_pct"] is not None
                else None,
                "bist100RelativePct": safe_float(row["bist100_gorece_getiri_pct"], None)
                if row["bist100_gorece_getiri_pct"] is not None
                else None,
                "targetPrice": safe_float(row["hedef_hisse_fiyati_tl"], None)
                if row["hedef_hisse_fiyati_tl"] is not None
                else None,
                "potentialReturnPct": safe_float(row["potansiyel_getiri_pct"], None)
                if row["potansiyel_getiri_pct"] is not None
                else None,
                "portfolioWeightPct": safe_float(row["portfoy_agirligi_pct"], None)
                if row["portfoy_agirligi_pct"] is not None
                else None,
                "recommendationRaw": fix_tr(row["oneri"]) if row["oneri"] else None,
                "sourceName": fix_tr(row["source_name"]) if row["source_name"] else None,
                "reportDate": str(row["report_date"]).strip() if row["report_date"] else None,
                "loadedAt": str(row["loaded_at"]).strip() if row["loaded_at"] else None,
            }

    def ziraat_fresh_dt(z: Dict[str, Any]) -> Optional[datetime]:
        return _max_dt(
            parse_report_date(z["reportDate"]) if z.get("reportDate") else None,
            _parse_ziraat_date(z.get("reportDateRaw")),
        )

    ziraat_latest: Optional[datetime] = None
    for z in list(ziraat_genel.values()) + list(ziraat_portfoy.values()):
        ziraat_latest = _max_dt(ziraat_latest, ziraat_fresh_dt(z))

    all_codes: Set[str] = set()
    all_codes |= set(halk_by_code.keys())
    all_codes |= set(isy_onerileri.keys())
    all_codes |= set(isy_encok.keys())
    all_codes |= set(ziraat_genel.keys())
    all_codes |= set(ziraat_portfoy.keys())

    def institution_set_for_code(c: str) -> Set[str]:
        s: Set[str] = set()
        if c in halk_by_code:
            s.add("halk")
        if c in isy_onerileri or c in isy_encok:
            s.add("isyatirim")
        if c in ziraat_genel or c in ziraat_portfoy:
            s.add("ziraat")
        return s

    multi_count = sum(1 for c in all_codes if len(institution_set_for_code(c)) >= 2)

    # Top potential across all numeric sources
    top_pot: Optional[Tuple[str, float, str]] = None
    for c in all_codes:
        for val, src in (
            (halk_by_code.get(c, {}).get("potentialReturnPct"), "Halk Yatırım"),
            (isy_onerileri.get(c, {}).get("potentialReturnPct"), "İş Yatırım"),
            (isy_encok.get(c, {}).get("potentialReturnPct"), "İş Yatırım"),
            (ziraat_portfoy.get(c, {}).get("potentialReturnPct"), "Ziraat Yatırım"),
        ):
            if val is None:
                continue
            if top_pot is None or float(val) > top_pot[1]:
                top_pot = (c, float(val), src)

    # Freshest institution block
    freshness_rows: List[Dict[str, Any]] = [
        {
            "id": "halk",
            "label": "Halk Yatırım",
            "cadence": "weekly",
            "cadenceLabel": "Haftalık güncellenir",
            "lastReportDate": _iso_date(halk_latest_report_date),
        },
        {
            "id": "isyatirim",
            "label": "İş Yatırım",
            "cadence": "monthly_or_slower",
            "cadenceLabel": "Aylık veya daha seyrek",
            "lastReportDate": _iso_date(isy_encok_latest),
            "note": "Öneriler tablosunda tarih alanı bulunmuyor; tarih varsa en çok önerilen listesinden.",
        },
        {
            "id": "ziraat",
            "label": "Ziraat Yatırım",
            "cadence": "variable",
            "cadenceLabel": "Rapor yüklemelerine bağlı",
            "lastReportDate": _iso_date(ziraat_latest),
        },
    ]
    parsed_fresh = [(r["id"], parse_report_date(r["lastReportDate"]) if r.get("lastReportDate") else None) for r in freshness_rows]
    latest_inst = max(parsed_fresh, key=lambda x: x[1] or datetime.min)[0] if parsed_fresh else None

    top_halk = None
    if halk_ranking:
        top_halk = min(halk_ranking, key=lambda x: x["rank"])

    def build_panels(c: str) -> List[Dict[str, Any]]:
        panels: List[Dict[str, Any]] = []
        hk = halk_by_code.get(c)
        if hk:
            bucket = _reco_bucket(hk.get("recommendationRaw"))
            panels.append(
                {
                    "kind": "halk",
                    "institutionLabel": "Halk Yatırım",
                    "subLabel": None,
                    "recommendation": hk.get("recommendationRaw"),
                    "recommendationBucket": bucket,
                    "targetPrice": hk.get("targetPrice"),
                    "potentialReturnPct": hk.get("potentialReturnPct"),
                    "referencePrice": hk.get("referencePrice"),
                    "reportDate": hk.get("reportDate"),
                    "rank": rank_by_code.get(c),
                    "extra": {"reportId": hk.get("reportId"), "sector": hk.get("sector")},
                }
            )

        iso = isy_onerileri.get(c)
        enc = isy_encok.get(c)
        if iso or enc:
            rec = (iso or {}).get("recommendationRaw") if iso else None
            if not rec and enc:
                rec = "En çok önerilen listesi"
            bucket = _reco_bucket((iso or {}).get("recommendationRaw"))
            tgt = (iso or {}).get("targetPrice")
            pot = (iso or {}).get("potentialReturnPct")
            refp = None
            if enc:
                if tgt is None:
                    tgt = enc.get("targetPrice")
                if pot is None:
                    pot = enc.get("potentialReturnPct")
                refp = enc.get("referencePrice")
            note_parts: List[str] = []
            if enc:
                note_parts.append("En çok önerilen listesinde")
                if enc.get("weightPct") is not None:
                    note_parts.append(f"ağırlık %{enc['weightPct']:.0f}")
            panels.append(
                {
                    "kind": "isyatirim",
                    "institutionLabel": "İş Yatırım",
                    "subLabel": "Öneriler · En çok önerilen",
                    "recommendation": rec,
                    "recommendationBucket": bucket if iso else _reco_bucket(rec),
                    "targetPrice": tgt,
                    "potentialReturnPct": pot,
                    "referencePrice": refp,
                    "reportDate": _iso_date(parse_report_date(str(enc["reportDate"])))
                    if enc and enc.get("reportDate")
                    else None,
                    "rank": None,
                    "note": " · ".join(note_parts) if note_parts else None,
                    "extra": {
                        "fromEncok": enc is not None,
                        "fromOnerileri": iso is not None,
                        "forecastLabel": (iso or {}).get("forecastLabel"),
                        "netProfitMn": (iso or {}).get("netProfitMn"),
                        "salesMn": (iso or {}).get("salesMn"),
                        "ebitdaMn": (iso or {}).get("ebitdaMn"),
                    },
                }
            )

        zp = ziraat_portfoy.get(c)
        if zp:
            panels.append(
                {
                    "kind": "ziraat_portfoy",
                    "institutionLabel": "Ziraat Yatırım",
                    "subLabel": "Öneri portföyü",
                    "recommendation": zp.get("recommendationRaw"),
                    "recommendationBucket": _reco_bucket(zp.get("recommendationRaw")),
                    "targetPrice": zp.get("targetPrice"),
                    "potentialReturnPct": zp.get("potentialReturnPct"),
                    "referencePrice": zp.get("referencePrice"),
                    "reportDate": zp.get("reportDate"),
                    "rank": None,
                    "note": f"Portföy ağırlığı %{zp['portfolioWeightPct']:.1f}" if zp.get("portfolioWeightPct") is not None else None,
                    "extra": {
                        "bist100RelativePct": zp.get("bist100RelativePct"),
                        "marketCapMn": zp.get("marketCapMn"),
                    },
                }
            )

        zg = ziraat_genel.get(c)
        if zg:
            panels.append(
                {
                    "kind": "ziraat_genel",
                    "institutionLabel": "Ziraat Yatırım",
                    "subLabel": "Genel takip listesi",
                    "recommendation": zg.get("recommendationRaw"),
                    "recommendationBucket": _reco_bucket(zg.get("recommendationRaw")),
                    "targetPrice": zg.get("targetPrice"),
                    "potentialReturnPct": None,
                    "referencePrice": None,
                    "reportDate": zg.get("reportDate") or zg.get("reportDateRaw"),
                    "rank": None,
                    "extra": {"raporLink": zg.get("companyHint")},
                }
            )

        return panels

    def stock_insight(c: str, panels: List[Dict[str, Any]]) -> str:
        insts = {p["institutionLabel"] for p in panels}
        buckets = [p.get("recommendationBucket") for p in panels]
        pos = sum(1 for b in buckets if b in ("AL", "STRONG_AL"))
        neg = sum(1 for b in buckets if b == "SAT")
        pos_inst = {
            p["institutionLabel"] for p in panels if p.get("recommendationBucket") in ("AL", "STRONG_AL")
        }

        targets = [p["targetPrice"] for p in panels if p.get("targetPrice") is not None]
        tspread = None
        if len(targets) >= 2:
            tspread = max(targets) - min(targets)

        parts: List[str] = []
        if len(insts) == 1:
            only = next(iter(insts))
            parts.append(f"Bu hisse yalnızca {only} veri setinde yer alıyor.")
        elif len(pos_inst) >= 2:
            names = sorted(pos_inst)
            if len(names) == 2:
                parts.append(f"Bu hissede {names[0]} ve {names[1]} pozitif (AL) görüş sunuyor.")
            else:
                parts.append("Birden fazla kurum bu hissede pozitif (AL) görüş sunuyor.")
        elif pos == 1 and len(panels) >= 2:
            parts.append("Kurumlar arasında öneri yönü farklılaşıyor olabilir; panellerdeki metinlere bakın.")
        if neg >= 1 and pos >= 1:
            parts.append("Öneri yönleri kurumlar arasında tam örtüşmüyor.")

        if tspread is not None and tspread > 0:
            parts.append("Kurumlar arasında hedef fiyat farkı dikkat çekiyor.")

        if "Halk Yatırım" in insts and len(insts) > 1:
            parts.append("Halk Yatırım verisi haftalık güncellenir; diğer kurum verileri daha eski olabilir.")

        if not parts:
            parts.append("Mevcut kayıtlara göre çok kurumlu özet üretilemedi; ayrıntılar panellerde.")
        return " ".join(parts)

    stocks_out: List[Dict[str, Any]] = []
    for c in sorted(all_codes):
        meta = hisse_meta.get(c, {})
        name = meta.get("name") or c
        sector = meta.get("sector")
        hk = halk_by_code.get(c)
        if hk and hk.get("sector"):
            sector = sector or hk["sector"]
        zp = ziraat_portfoy.get(c)
        if zp and zp.get("companyHint"):
            name = meta.get("name") or zp["companyHint"] or name
        zg = ziraat_genel.get(c)
        if zg and zg.get("companyHint"):
            name = meta.get("name") or zg["companyHint"] or name

        pnl = build_panels(c)
        stocks_out.append(
            {
                "code": c,
                "name": name,
                "sector": sector,
                "insight": stock_insight(c, pnl),
                "panels": pnl,
                "institutionCount": len(institution_set_for_code(c)),
                "maxPotentialPct": max(
                    [x for x in [hk.get("potentialReturnPct") if hk else None] if x is not None]
                    + [x for x in [isy_onerileri.get(c, {}).get("potentialReturnPct")] if x is not None]
                    + [x for x in [isy_encok.get(c, {}).get("potentialReturnPct")] if x is not None]
                    + [x for x in [zp.get("potentialReturnPct") if zp else None] if x is not None],
                    default=None,
                ),
                "sortRank": rank_by_code.get(c),
                "recoStrengthMax": max([_reco_strength(p.get("recommendationBucket") or "UNKNOWN") for p in pnl], default=0.0),
            }
        )

    # Institution overview stats
    def avg_nums(vals: List[float]) -> Optional[float]:
        v = [x for x in vals if x is not None]
        return round(sum(v) / len(v), 2) if v else None

    halk_targets = [h["targetPrice"] for h in halk_by_code.values() if h.get("targetPrice") is not None]
    halk_pots = [h["potentialReturnPct"] for h in halk_by_code.values() if h.get("potentialReturnPct") is not None]

    isy_targets = [v["targetPrice"] for v in isy_onerileri.values() if v.get("targetPrice") is not None]
    isy_pots = [v["potentialReturnPct"] for v in isy_onerileri.values() if v.get("potentialReturnPct") is not None]

    zt = [v["targetPrice"] for v in ziraat_portfoy.values() if v.get("targetPrice") is not None]
    zpots = [v["potentialReturnPct"] for v in ziraat_portfoy.values() if v.get("potentialReturnPct") is not None]

    def top_standout(codes: List[str], pot_fn) -> List[str]:
        scored = [(c, pot_fn(c)) for c in codes]
        scored = [(c, p) for c, p in scored if p is not None]
        scored.sort(key=lambda x: x[1], reverse=True)
        return [c for c, _ in scored[:3]]

    institution_overview = [
        {
            "id": "halk",
            "label": "Halk Yatırım",
            "accent": "cyan",
            "recordCount": len(halk_by_code),
            "latestReportDate": _iso_date(halk_latest_report_date),
            "description": "Analist tavsiyeleri, hedef fiyat ve potansiyel getiri; BIST30 sıralaması.",
            "avgTargetPrice": avg_nums([float(x) for x in halk_targets]),
            "avgPotentialPct": avg_nums([float(x) for x in halk_pots]),
            "standoutCodes": top_standout(list(halk_by_code.keys()), lambda c: halk_by_code[c].get("potentialReturnPct")),
        },
        {
            "id": "isyatirim",
            "label": "İş Yatırım",
            "accent": "emerald",
            "recordCount": len(set(isy_onerileri.keys()) | set(isy_encok.keys())),
            "latestReportDate": _iso_date(isy_encok_latest),
            "description": "Öneri listesi ve en çok önerilen hisseler; finansal tahmin alanları.",
            "avgTargetPrice": avg_nums([float(x) for x in isy_targets]),
            "avgPotentialPct": avg_nums([float(x) for x in isy_pots]),
            "standoutCodes": top_standout(
                list(set(isy_onerileri.keys()) | set(isy_encok.keys())),
                lambda c: (isy_onerileri.get(c) or {}).get("potentialReturnPct")
                or (isy_encok.get(c) or {}).get("potentialReturnPct"),
            ),
        },
        {
            "id": "ziraat",
            "label": "Ziraat Yatırım",
            "accent": "crimson",
            "recordCount": len(set(ziraat_genel.keys()) | set(ziraat_portfoy.keys())),
            "latestReportDate": _iso_date(ziraat_latest),
            "description": "Öneri portföyü ve genel takip listesi; portföy ağırlığı ve göreli getiri.",
            "avgTargetPrice": avg_nums([float(x) for x in zt]),
            "avgPotentialPct": avg_nums([float(x) for x in zpots]),
            "standoutCodes": top_standout(
                list(ziraat_portfoy.keys()),
                lambda c: ziraat_portfoy[c].get("potentialReturnPct"),
            ),
        },
    ]

    # Highlights
    halk_highlight = sorted(halk_ranking, key=lambda x: x["rank"])[:12]
    encok_list = sorted(
        [{"code": k, **v} for k, v in isy_encok.items()],
        key=lambda x: (x.get("weightPct") or 0, x.get("potentialReturnPct") or 0),
        reverse=True,
    )[:12]
    zp_highlight = sorted(
        [{"code": k, **v} for k, v in ziraat_portfoy.items()],
        key=lambda x: (x.get("portfolioWeightPct") or 0, x.get("potentialReturnPct") or 0),
        reverse=True,
    )[:12]
    zg_highlight = sorted(
        [{"code": k, **v} for k, v in ziraat_genel.items()],
        key=lambda x: (x.get("reportDate") or "", x.get("reportDateRaw") or ""),
        reverse=True,
    )[:12]

    return {
        "summary": {
            "totalStocks": len(all_codes),
            "institutionCount": 3,
            "multiInstitutionStocks": multi_count,
            "topPotential": {"code": top_pot[0], "potentialPct": top_pot[1], "sourceLabel": top_pot[2]} if top_pot else None,
            "freshestInstitutionId": latest_inst,
            "topHalkBist30": top_halk,
        },
        "freshness": freshness_rows,
        "institutionOverview": institution_overview,
        "stocks": stocks_out,
        "highlights": {
            "halkBist30Ranking": halk_highlight,
            "isyatirimEncok": encok_list,
            "ziraatPortfoy": zp_highlight,
            "ziraatGenelTakip": zg_highlight,
        },
        "meta": {
            "halkRankingReportId": latest_rank_rid,
            "halkReportSnapshots": halk_report_snapshots,
            "halkSnapshotMode": "selected" if halk_report_id is not None else "latest_auto",
            "selectedHalkReportId": halk_report_id,
        },
    }
