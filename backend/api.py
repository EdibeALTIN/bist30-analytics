from __future__ import annotations

from bisect import bisect_left
import hashlib
import json
import os
import random
import re
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import database as db
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel


def _parse_cors_origins() -> List[str]:
    """CORS_ORIGINS (virgülle ayrılmış) veya FRONTEND_URL ile yapılandırılır."""
    raw = os.environ.get("CORS_ORIGINS") or os.environ.get("FRONTEND_URL") or ""
    origins = [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]
    if origins:
        return origins
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
    ]


class Utf8JSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")


app = FastAPI(title="BIST-30 API", default_response_class=Utf8JSONResponse)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn() -> sqlite3.Connection:
    return db.get_conn()


def fix_tr(value: Optional[str]) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        return str(value)

    text = value
    replacements = {
        "Ã‡": "Ç",
        "Ã§": "ç",
        "Ä°": "İ",
        "Ä±": "ı",
        "Ã–": "Ö",
        "Ã¶": "ö",
        "Ãœ": "Ü",
        "Ã¼": "ü",
        "Åž": "Ş",
        "ÅŸ": "ş",
        "Äž": "Ğ",
        "ÄŸ": "ğ",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)

    return text.strip()


def nullable_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        if isinstance(value, str) and value.strip() == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_text_for_match(value: Optional[str]) -> str:
    text = fix_tr(value).lower()
    translate_table = str.maketrans(
        {
            "ç": "c",
            "ğ": "g",
            "ı": "i",
            "ö": "o",
            "ş": "s",
            "ü": "u",
            "&": " ",
            ",": " ",
        }
    )
    text = text.translate(translate_table)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def sector_similarity(stock_sector: str, avg_sector: str) -> float:
    stock_norm = normalize_text_for_match(stock_sector)
    avg_norm = normalize_text_for_match(avg_sector)
    if not stock_norm or not avg_norm:
        return 0.0
    if stock_norm == avg_norm:
        return 10.0

    stock_tokens = set(stock_norm.split())
    avg_tokens = set(avg_norm.split())
    if not stock_tokens or not avg_tokens:
        return 0.0

    overlap = len(stock_tokens & avg_tokens)
    if overlap == 0:
        overlap_score = 0.0
    else:
        overlap_score = overlap / len(stock_tokens | avg_tokens)

    # Ortak kullanılan sektör adlandırmaları için ek yakınlık puanı.
    alias_groups = [
        {"gida", "perakende"},
        {"holding", "holdingler"},
        {"cam", "cimento"},
        {"telekom", "teknoloji"},
        {"gayrimenkul", "gyo"},
        {"petrokimya", "sanayi"},
    ]
    alias_bonus = 0.0
    for group in alias_groups:
        if (stock_tokens & group) and (avg_tokens & group):
            alias_bonus = max(alias_bonus, 0.35)

    # Tek tokenli sektörlerde "içeriyor" ilişkisini de dikkate al.
    contains_bonus = 0.0
    if len(stock_tokens) == 1 and next(iter(stock_tokens)) in avg_tokens:
        contains_bonus = 0.2

    return overlap_score + alias_bonus + contains_bonus


def find_best_sector_average(
    rows: List[sqlite3.Row], stock_sector: str
) -> Optional[sqlite3.Row]:
    best_row: Optional[sqlite3.Row] = None
    best_score = 0.0
    stock_norm = normalize_text_for_match(stock_sector)

    for row in rows:
        avg_sector = fix_tr(row["sektor"]) if "sektor" in row.keys() else ""
        avg_norm = normalize_text_for_match(avg_sector)

        # Birebir normalize eşleşmeyi doğrudan kabul et.
        if stock_norm and avg_norm and stock_norm == avg_norm:
            return row

        score = sector_similarity(stock_sector, avg_sector)
        if score > best_score:
            best_score = score
            best_row = row

    # Düşük skorları yanlış eşleşmeyi önlemek için eleyelim.
    return best_row if best_score >= 0.22 else None


def has_column(conn: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    return db.has_column(conn, table_name, column_name)


def stable_seed(code: str) -> int:
    digest = hashlib.sha256(code.encode("utf-8")).hexdigest()[:8]
    return int(digest, 16)


def normalize_recommendation(raw: Optional[str], score: float) -> str:
    text = fix_tr(raw).upper()
    if "SAT" in text:
        return "SAT"
    if "AL" in text:
        return "AL"
    if "TUT" in text or "NOTR" in text or "NÖTR" in text:
        return "TUT"
    if score >= 75:
        return "AL"
    if score >= 60:
        return "TUT"
    return "SAT"


def gen_price_history(code: str, price: float, change: float, points: int = 12) -> List[float]:
    seed = stable_seed(code)
    rng = random.Random(seed)
    base = max(price, 1.0)
    trend = max(min(change / 100.0, 0.12), -0.12)

    start = base * (1.0 - trend * 0.55)
    current = start
    history: List[float] = []

    for i in range(points - 1):
        drift = trend / max(points - 1, 1)
        noise = rng.uniform(-0.015, 0.015)
        seasonal = ((i % 3) - 1) * 0.002
        step = drift + noise + seasonal
        current = max(current * (1.0 + step), 0.01)
        history.append(round(current, 2))

    history.append(round(base, 2))
    return history


def fallback_market_data(code: str, score: float) -> Dict[str, Any]:
    seed = stable_seed(code)
    rng = random.Random(seed)
    price = round(20 + (seed % 450) + rng.random() * 10, 2)
    change = round(((seed % 1400) / 100.0) - 7.0, 2)
    target_price = round(price * (1.0 + max(min((score - 50) / 120, 0.35), -0.25)), 2)
    recommendation = normalize_recommendation(None, score)
    return {
        "price": price,
        "change": change,
        "targetPrice": target_price,
        "recommendation": recommendation,
        "priceHistory": gen_price_history(code, price, change),
    }


def latest_recos_join_sql(conn: sqlite3.Connection) -> str:
    if has_column(conn, "analyst_recos", "report_id"):
        return """
            LEFT JOIN (
                SELECT *
                FROM (
                    SELECT
                        r.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY r.sirket_kodu
                            ORDER BY r.report_id DESC
                        ) AS rn
                    FROM analyst_recos r
                ) ranked
                WHERE ranked.rn = 1
            ) ar ON h.sirket_kodu = ar.sirket_kodu
        """
    return "LEFT JOIN analyst_recos ar ON h.sirket_kodu = ar.sirket_kodu"


def map_db_row_to_stock(row: sqlite3.Row, recos_row: Optional[sqlite3.Row] = None) -> Dict[str, Any]:
    keys = set(row.keys())
    code = str(row["sirket_kodu"]).upper()
    score = round(safe_float(row["coz_ana_puan"]), 2)
    reco_sector = None

    if recos_row is not None:
        reco_price = recos_row["son_fiyat"]
        reco_change = recos_row["pot_getiri"]
        reco_target = recos_row["hedef"]
        reco_consensus = recos_row["konsensus"]
        reco_sector = recos_row["sektor"] if "sektor" in recos_row.keys() else None
    else:
        reco_price = row["reco_son_fiyat"] if "reco_son_fiyat" in keys else None
        reco_change = row["reco_pot_getiri"] if "reco_pot_getiri" in keys else None
        reco_target = row["reco_hedef"] if "reco_hedef" in keys else None
        reco_consensus = row["reco_konsensus"] if "reco_konsensus" in keys else None
        reco_sector = row["reco_sektor"] if "reco_sektor" in keys else None

    fallback = fallback_market_data(code, score)

    price = safe_float(reco_price, fallback["price"]) if reco_price is not None else fallback["price"]
    change = safe_float(reco_change, fallback["change"]) if reco_change is not None else fallback["change"]
    target_price = (
        safe_float(reco_target, fallback["targetPrice"]) if reco_target is not None else fallback["targetPrice"]
    )
    recommendation = (
        normalize_recommendation(reco_consensus, score) if reco_consensus is not None else fallback["recommendation"]
    )

    debt_raw = nullable_float(row["kaldirac_orani"]) if "kaldirac_orani" in keys else None
    debt_to_equity: Optional[float]
    if debt_raw is None:
        debt_to_equity = None
    else:
        debt_to_equity = debt_raw / 100.0 if debt_raw > 10 else debt_raw
        debt_to_equity = round(debt_to_equity, 4)

    sector = fix_tr(row["sektor"]) or fix_tr(reco_sector) or "Bilinmiyor"

    record_id = int(row["id"]) if "id" in keys and row["id"] is not None else None
    donem_val = (
        fix_tr(row["donem"])
        if "donem" in keys and row["donem"] is not None and str(row["donem"]).strip()
        else None
    )
    tarih_val = (
        str(row["tarih"]).strip()
        if "tarih" in keys and row["tarih"] is not None and str(row["tarih"]).strip()
        else None
    )
    def nf(col: str) -> Optional[float]:
        return nullable_float(row[col]) if col in keys else None

    market_cap = nf("piyasa_degeri_tl")
    npm = nf("net_kar_marji")

    return {
        "code": code,
        "name": fix_tr(row["sirket_adi"]) or code,
        "sector": sector,
        "score": score,
        "price": round(price, 2),
        "change": round(change, 2),
        "pe": nf("fk"),
        "peg": nf("peg"),
        "pb": nf("pd_dd"),
        "roe": nf("ozkaynak_karliligi"),
        "roa": nf("aktif_karlilik"),
        "ebitdaMargin": nf("favok_marji"),
        "netProfitMargin": npm,
        "quarterlyNetIncomeGrowth": nf("ceyreklik_net_kar_degisimi"),
        "currentRatio": nf("cari_oran"),
        "cashRatio": nf("nakit_oran"),
        "debtToEquity": debt_to_equity,
        "marketCapTl": market_cap,
        "targetPrice": round(target_price, 2),
        "recommendation": recommendation,
        "priceHistory": gen_price_history(code, price, change),
        "recordId": record_id,
        "donem": donem_val,
        "tarih": tarih_val,
    }


def get_sector_comparison(conn: sqlite3.Connection, stock_code: str, fallback_sector: str) -> Dict[str, Any]:
    rec_query = """
        SELECT
            r.sirket_kodu,
            r.sektor,
            r.pot_getiri,
            r.report_id
        FROM analyst_recos r
        WHERE UPPER(r.sirket_kodu) = UPPER(?)
        ORDER BY r.report_id DESC
        LIMIT 1
    """
    rec = conn.execute(rec_query, (stock_code,)).fetchone()
    if rec is None:
        return {
            "stockCode": stock_code.upper(),
            "stockSector": fallback_sector or None,
            "stockPotentialReturn": None,
            "sectorAveragePotentialReturn": None,
            "differenceFromSector": None,
            "reportId": None,
        }

    stock_pot = safe_float(rec["pot_getiri"], None) if rec["pot_getiri"] is not None else None
    rec_report_id = int(rec["report_id"]) if rec["report_id"] is not None else None
    rec_sector = fix_tr(rec["sektor"]) or fallback_sector

    avg_rows: List[sqlite3.Row] = []
    effective_report_id = rec_report_id
    if rec_report_id is not None:
        avg_rows = conn.execute(
            """
            SELECT report_id, sektor, sektor_ortalama_pot_getiri
            FROM analyst_sector_averages
            WHERE report_id = ?
            """,
            (rec_report_id,),
        ).fetchall()

    # Aynı rapor bulunamazsa en güncel sektör ortalamasına düş.
    if not avg_rows:
        latest_avg_report_id_row = conn.execute(
            "SELECT MAX(report_id) AS report_id FROM analyst_sector_averages"
        ).fetchone()
        latest_avg_report_id = (
            int(latest_avg_report_id_row["report_id"])
            if latest_avg_report_id_row is not None and latest_avg_report_id_row["report_id"] is not None
            else None
        )
        if latest_avg_report_id is not None:
            avg_rows = conn.execute(
                """
                SELECT report_id, sektor, sektor_ortalama_pot_getiri
                FROM analyst_sector_averages
                WHERE report_id = ?
                """,
                (latest_avg_report_id,),
            ).fetchall()
            effective_report_id = latest_avg_report_id

    best_avg_row = find_best_sector_average(avg_rows, rec_sector) if avg_rows else None
    sector_avg = (
        safe_float(best_avg_row["sektor_ortalama_pot_getiri"], None)
        if best_avg_row is not None and best_avg_row["sektor_ortalama_pot_getiri"] is not None
        else None
    )
    diff = round(stock_pot - sector_avg, 2) if stock_pot is not None and sector_avg is not None else None

    return {
        "stockCode": fix_tr(rec["sirket_kodu"]).upper(),
        "stockSector": rec_sector or None,
        "stockPotentialReturn": round(stock_pot, 2) if stock_pot is not None else None,
        "sectorAveragePotentialReturn": round(sector_avg, 2) if sector_avg is not None else None,
        "differenceFromSector": diff,
        "reportId": effective_report_id,
    }


@app.get("/api/health")
def health() -> Dict[str, Any]:
    dbp = db.resolve_db_path()
    return {"ok": True, "db_exists": dbp.exists(), "db_path": str(dbp)}


def fetch_stocks_rows(conn: sqlite3.Connection, donem: Optional[str]) -> List[sqlite3.Row]:
    join_sql = latest_recos_join_sql(conn)
    if donem and donem.strip() and has_column(conn, "hisseler", "donem"):
        query = f"""
            SELECT
                h.*,
                ar.son_fiyat AS reco_son_fiyat,
                ar.hedef AS reco_hedef,
                ar.pot_getiri AS reco_pot_getiri,
                ar.konsensus AS reco_konsensus,
                ar.sektor AS reco_sektor
            FROM hisseler h
            {join_sql}
            WHERE TRIM(IFNULL(h.donem, '')) = TRIM(?)
            ORDER BY h.coz_ana_puan DESC
        """
        return conn.execute(query, (donem.strip(),)).fetchall()

    from_body = db.sql_from_clause_latest_hisseler(conn, "h")
    query = f"""
        SELECT
            h.*,
            ar.son_fiyat AS reco_son_fiyat,
            ar.hedef AS reco_hedef,
            ar.pot_getiri AS reco_pot_getiri,
            ar.konsensus AS reco_konsensus,
            ar.sektor AS reco_sektor
        FROM {from_body}
        {join_sql}
        ORDER BY h.coz_ana_puan DESC
    """
    return conn.execute(query).fetchall()


@app.get("/api/stocks")
def get_stocks(donem: Optional[str] = Query(None, description="Belirli dönem filtresi (örn. 2025/12)")) -> List[Dict[str, Any]]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        rows = fetch_stocks_rows(conn, donem)
        return [map_db_row_to_stock(row) for row in rows]
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/stocks/{code}")
def get_stock(
    code: str,
    record_id: Optional[int] = Query(None, description="Belirli hisseler satırının id"),
    donem: Optional[str] = Query(None, description="record_id verilmezse bu dönemdeki güncel satır"),
) -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        join_sql = latest_recos_join_sql(conn)
        row: Optional[sqlite3.Row] = None
        if record_id is not None:
            sql = f"""
                SELECT h.*,
                    ar.son_fiyat AS reco_son_fiyat,
                    ar.hedef AS reco_hedef,
                    ar.pot_getiri AS reco_pot_getiri,
                    ar.konsensus AS reco_konsensus,
                    ar.sektor AS reco_sektor
                FROM hisseler h
                {join_sql}
                WHERE h.id = ? AND UPPER(h.sirket_kodu) = UPPER(?)
            """
            row = conn.execute(sql, (record_id, code)).fetchone()
        elif donem and donem.strip():
            sql = f"""
                SELECT h.*,
                    ar.son_fiyat AS reco_son_fiyat,
                    ar.hedef AS reco_hedef,
                    ar.pot_getiri AS reco_pot_getiri,
                    ar.konsensus AS reco_konsensus,
                    ar.sektor AS reco_sektor
                FROM hisseler h
                {join_sql}
                WHERE UPPER(h.sirket_kodu) = UPPER(?)
                AND TRIM(IFNULL(h.donem, '')) = TRIM(?)
                ORDER BY h.tarih DESC, h.id DESC
                LIMIT 1
            """
            row = conn.execute(sql, (code, donem.strip())).fetchone()
        if row is None:
            sql_lt = f"""
                SELECT h.*,
                    ar.son_fiyat AS reco_son_fiyat,
                    ar.hedef AS reco_hedef,
                    ar.pot_getiri AS reco_pot_getiri,
                    ar.konsensus AS reco_konsensus,
                    ar.sektor AS reco_sektor
                FROM {db.sql_from_clause_latest_hisseler(conn, "h")}
                {join_sql}
                WHERE UPPER(h.sirket_kodu) = UPPER(?)
            """
            row = conn.execute(sql_lt, (code,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Stock not found: {code}")
        stock = map_db_row_to_stock(row)
        stock["sectorComparison"] = get_sector_comparison(conn, stock["code"], stock["sector"])
        return stock
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/sectors")
def get_sectors(donem: Optional[str] = Query(None)) -> List[Dict[str, Any]]:
    stocks = get_stocks(donem)
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for stock in stocks:
        grouped.setdefault(stock["sector"], []).append(stock)

    sectors: List[Dict[str, Any]] = []
    for sector, items in grouped.items():
        ordered = sorted(items, key=lambda s: s["score"], reverse=True)
        avg_score = round(sum(s["score"] for s in items) / len(items), 2) if items else 0.0
        top_stocks = [
            {
                "code": s["code"],
                "name": s["name"],
                "score": s["score"],
                "recommendation": s["recommendation"],
                "price": s["price"],
            }
            for s in ordered[:3]
        ]
        sectors.append(
            {
                "sector": sector,
                "count": len(items),
                "avgScore": avg_score,
                "topStocks": top_stocks,
            }
        )

    sectors.sort(key=lambda s: s["avgScore"], reverse=True)
    return sectors


class CalculateScoreRequest(BaseModel):
    pe: Optional[float] = None
    peg: Optional[float] = None
    pb: Optional[float] = None
    fdFavok: Optional[float] = None
    fsOrani: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    roic: Optional[float] = None
    netProfitMargin: Optional[float] = None
    ebitdaMargin: Optional[float] = None
    liquidityRatio: Optional[float] = None
    quarterlyNetIncomeGrowth: Optional[float] = None
    quarterlySalesGrowth: Optional[float] = None
    quarterlyEbitdaGrowth: Optional[float] = None
    yearlyNetIncomeGrowth: Optional[float] = None
    yearlySalesGrowth: Optional[float] = None
    yearlyEbitdaGrowth: Optional[float] = None
    currentRatio: Optional[float] = None
    debtToEquity: Optional[float] = None
    cashRatio: Optional[float] = None
    dividendYield: Optional[float] = None
    sector: Optional[str] = None


METRIC_CONFIG: Dict[str, Dict[str, Any]] = {
    "pe": {"column": "fk", "category": "valuation", "higher_is_better": False},
    "pb": {"column": "pd_dd", "category": "valuation", "higher_is_better": False},
    "fdFavok": {"column": "fd_favok", "category": "valuation", "higher_is_better": False},
    "fsOrani": {"column": "fs_orani", "category": "valuation", "higher_is_better": False},
    "peg": {"column": "peg", "category": "valuation", "higher_is_better": False},
    "roe": {"column": "ozkaynak_karliligi", "category": "profitability", "higher_is_better": True},
    "roa": {"column": "aktif_karlilik", "category": "profitability", "higher_is_better": True},
    "roic": {"column": "roic", "category": "profitability", "higher_is_better": True},
    "netProfitMargin": {"column": "net_kar_marji", "category": "profitability", "higher_is_better": True},
    "ebitdaMargin": {"column": "favok_marji", "category": "profitability", "higher_is_better": True},
    "liquidityRatio": {"column": "likidite_orani", "category": "health", "higher_is_better": True},
    "currentRatio": {"column": "cari_oran", "category": "health", "higher_is_better": True},
    "cashRatio": {"column": "nakit_oran", "category": "health", "higher_is_better": True},
    "debtToEquity": {"column": "kaldirac_orani", "category": "health", "higher_is_better": False},
    "yearlyNetIncomeGrowth": {
        "column": "yillik_net_kar_degisimi",
        "category": "growth",
        "higher_is_better": True,
    },
    "yearlySalesGrowth": {
        "column": "yillik_satislar_degisimi",
        "category": "growth",
        "higher_is_better": True,
    },
    "yearlyEbitdaGrowth": {
        "column": "yillik_favok_degisimi",
        "category": "growth",
        "higher_is_better": True,
    },
    "quarterlyNetIncomeGrowth": {
        "column": "ceyreklik_net_kar_degisimi",
        "category": "growth",
        "higher_is_better": True,
    },
    "quarterlySalesGrowth": {
        "column": "ceyreklik_satislar_degisimi",
        "category": "growth",
        "higher_is_better": True,
    },
    "quarterlyEbitdaGrowth": {
        "column": "ceyreklik_favok_degisimi",
        "category": "growth",
        "higher_is_better": True,
    },
    "dividendYield": {"column": "temettü_verimi", "category": "dividend", "higher_is_better": True},
}


CATEGORY_WEIGHTS = {
    "valuation": 0.25,
    "profitability": 0.30,
    "health": 0.20,
    "growth": 0.15,
    "dividend": 0.10,
}


METRIC_CAPS: Dict[str, tuple[float, float]] = {
    "pe": (0, 60),
    "pb": (0, 10),
    "fdFavok": (0, 30),
    "fsOrani": (0, 30),
    "peg": (-10, 10),
    "dividendYield": (0, 20),
    "roe": (-20, 60),
    "roa": (-10, 30),
    "roic": (-20, 60),
    "netProfitMargin": (-50, 60),
    "ebitdaMargin": (-50, 60),
    "liquidityRatio": (0, 10),
    "currentRatio": (0, 10),
    "cashRatio": (0, 10),
    "debtToEquity": (0, 500),
    "yearlyNetIncomeGrowth": (-200, 300),
    "yearlySalesGrowth": (-100, 200),
    "yearlyEbitdaGrowth": (-200, 300),
    "quarterlyNetIncomeGrowth": (-200, 300),
    "quarterlySalesGrowth": (-100, 200),
    "quarterlyEbitdaGrowth": (-200, 300),
}


def clean_metric_value(metric_name: str, value: Any) -> Optional[float]:
    numeric = safe_float(value, None)
    if numeric is None:
        return None

    if metric_name in ("pe", "pb", "fdFavok", "fsOrani") and numeric <= 0:
        return None

    cap = METRIC_CAPS.get(metric_name)
    if cap is not None:
        lo, hi = cap
        if numeric < lo or numeric > hi:
            return None

    return numeric


def metric_percentile_score(value: Optional[float], sorted_vals: List[float], higher_is_better: bool) -> Optional[float]:
    if value is None or not sorted_vals:
        return None
    n = len(sorted_vals)
    if n == 1:
        return 50.0
    pos = bisect_left(sorted_vals, value)
    percentile = (pos / (n - 1)) * 100.0
    score = percentile if higher_is_better else (100.0 - percentile)
    return max(0.0, min(100.0, score))


def calibrate_score_from_distribution(raw_score: float, distribution: List[float], low: float = 55.0, high: float = 95.0) -> float:
    valid = sorted([v for v in distribution if v is not None])
    if not valid:
        return round(raw_score, 2)
    percentile = metric_percentile_score(raw_score, valid, True)
    if percentile is None:
        return round(raw_score, 2)
    return round(low + (percentile / 100.0) * (high - low), 2)


def load_distributions(conn: sqlite3.Connection) -> Dict[str, List[float]]:
    columns = [cfg["column"] for cfg in METRIC_CONFIG.values()]
    sql_cols = ", ".join(columns)
    rows = db.select_hisse_for_calculator_latest(conn, sql_cols)
    dist: Dict[str, List[float]] = {col: [] for col in columns}
    for row in rows:
        for col in columns:
            val = row[col]
            if val is None:
                continue
            try:
                numeric = float(val)
                if col == "kaldirac_orani" and numeric > 10:
                    # Keep calculator and stock payload on same scale.
                    numeric = numeric / 100.0
                dist[col].append(numeric)
            except (TypeError, ValueError):
                continue
    return dist


def recommendation_from_score(score: float) -> str:
    if score >= 75:
        return "AL"
    if score >= 60:
        return "TUT"
    return "SAT"


def parse_report_date(value: str) -> Optional[datetime]:
    text = (value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def get_available_technical_dates(conn: sqlite3.Connection) -> List[str]:
    query = """
        SELECT DISTINCT report_date FROM endeks_indikator
        UNION
        SELECT DISTINCT report_date FROM endeks_destek_direnc
        UNION
        SELECT DISTINCT report_date FROM bist30_indikator
        UNION
        SELECT DISTINCT report_date FROM bist30_destek_direnc
    """
    raw_dates = [str(r[0]).strip() for r in conn.execute(query).fetchall() if r[0] is not None and str(r[0]).strip()]
    deduped = sorted(set(raw_dates), key=lambda d: parse_report_date(d) or datetime.min, reverse=True)
    return deduped


def get_latest_technical_date(conn: sqlite3.Connection) -> Optional[str]:
    dates = get_available_technical_dates(conn)
    return dates[0] if dates else None


def map_endeks_indikator_row(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "symbol": fix_tr(row["symbol"]).upper(),
        "lastPrice": safe_float(row["son"]),
        "mav8": safe_float(row["mav8"]),
        "status8": fix_tr(row["gorunum_8"]).upper(),
        "mav20": safe_float(row["mav20"]),
        "status20": fix_tr(row["gorunum_20"]).upper(),
        "mav50": safe_float(row["mav50"]),
        "status50": fix_tr(row["gorunum_50"]).upper(),
        "mav200": safe_float(row["mav200"]),
        "status200": fix_tr(row["gorunum_200"]).upper(),
        "macd": safe_float(row["macd"]),
        "trigger": safe_float(row["trigger"]),
        "rsi14": safe_float(row["rsi14"]),
        "supertrend": safe_float(row["supertrend"]),
    }


def map_endeks_destek_direnc_row(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "symbol": fix_tr(row["symbol"]).upper(),
        "lastPrice": safe_float(row["son"]),
        "destek1": safe_float(row["destek1"]),
        "destek2": safe_float(row["destek2"]),
        "destek3": safe_float(row["destek3"]),
        "pivot": safe_float(row["pivot"]),
        "direnc1": safe_float(row["direnc1"]),
        "direnc2": safe_float(row["direnc2"]),
        "direnc3": safe_float(row["direnc3"]),
    }


def map_bist30_indikator_row(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "symbol": fix_tr(row["symbol"]).upper(),
        "close": safe_float(row["kapanis"]),
        "mav8": safe_float(row["mav8"]),
        "status8": fix_tr(row["gorunum_8"]).upper(),
        "mav20": safe_float(row["mav20"]),
        "status20": fix_tr(row["gorunum_20"]).upper(),
        "mav50": safe_float(row["mav50"]),
        "status50": fix_tr(row["gorunum_50"]).upper(),
        "mav200": safe_float(row["mav200"]),
        "status200": fix_tr(row["gorunum_200"]).upper(),
        "macd": safe_float(row["macd"]),
        "trigger": safe_float(row["trigger"]),
        "rsi14": safe_float(row["rsi14"]),
        "supertrend": safe_float(row["supertrend"]),
    }


def map_bist30_destek_direnc_row(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "symbol": fix_tr(row["hisse"]).upper(),
        "close": safe_float(row["kapanis"]),
        "destek1": safe_float(row["destek1"]),
        "destek2": safe_float(row["destek2"]),
        "destek3": safe_float(row["destek3"]),
        "pivot": safe_float(row["pivot"]),
        "direnc1": safe_float(row["direnc1"]),
        "direnc2": safe_float(row["direnc2"]),
        "direnc3": safe_float(row["direnc3"]),
    }


def get_latest_weekly_table(conn: sqlite3.Connection, prefix: str) -> Optional[str]:
    rows = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name LIKE ?
        """,
        (f"{prefix}%",),
    ).fetchall()
    names = [str(r["name"]) for r in rows if r["name"]]
    if not names:
        return None

    def key(name: str) -> tuple[str, str]:
        m = re.search(r"(\d{8})$", name)
        return (m.group(1) if m else "", name)

    names.sort(key=key, reverse=True)
    return names[0]


def get_weekly_dates(conn: sqlite3.Connection, prefix: str) -> List[str]:
    rows = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name LIKE ?
        """,
        (f"{prefix}%",),
    ).fetchall()
    dates: List[str] = []
    for row in rows:
        table_name = str(row["name"])
        report_date = extract_report_date_from_table_name(table_name)
        if report_date:
            dates.append(report_date)
    return sorted(set(dates), reverse=True)


def table_for_report_date(conn: sqlite3.Connection, prefix: str, report_date: Optional[str]) -> Optional[str]:
    if report_date:
        compact = report_date.replace("-", "")
        requested = f"{prefix}{compact}"
        hit = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
            """,
            (requested,),
        ).fetchone()
        if hit is not None:
            return requested
    return get_latest_weekly_table(conn, prefix)


def extract_report_date_from_table_name(table_name: Optional[str]) -> Optional[str]:
    if not table_name:
        return None
    m = re.search(r"(\d{4})(\d{2})(\d{2})$", table_name)
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"


_WEEKLY_UNIFIED_ALLOWED = frozenset({"qps_bist30", "dip_zirve_bist30"})


def weekly_unified_table_exists(conn: sqlite3.Connection, name: str) -> bool:
    if name not in _WEEKLY_UNIFIED_ALLOWED:
        return False
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (name,),
    ).fetchone()
    return row is not None


def coerce_iso_report_date(value: Optional[Any]) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    dt = parse_report_date(text.split()[0]) if text else None
    if dt is None and len(text) >= 10:
        dt = parse_report_date(text[:10])
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d")


def distinct_iso_dates_from_weekly_column(conn: sqlite3.Connection, table: str, col: str = "report_date") -> List[str]:
    if table not in _WEEKLY_UNIFIED_ALLOWED:
        return []
    if not weekly_unified_table_exists(conn, table) or not has_column(conn, table, col):
        return []
    rows = conn.execute(
        f"SELECT DISTINCT {col} AS d FROM {table} WHERE TRIM(IFNULL(CAST({col} AS TEXT), '')) != ''"
    ).fetchall()
    out: List[str] = []
    for r in rows:
        c = coerce_iso_report_date(r["d"] if "d" in r.keys() else r[0])
        if c:
            out.append(c)
    return out


def unified_weekly_snapshot_dates(conn: sqlite3.Connection) -> List[str]:
    """Tüm kullanılabilir haftalık rapor tarihleri: tarih-li tablo adları + tek tablolu report_date."""
    ds = set(get_weekly_dates(conn, "qps_bist30_"))
    ds.update(get_weekly_dates(conn, "dip_zirve_bist30_"))
    for iso in distinct_iso_dates_from_weekly_column(conn, "qps_bist30"):
        ds.add(iso)
    for iso in distinct_iso_dates_from_weekly_column(conn, "dip_zirve_bist30"):
        ds.add(iso)
    return sorted(ds, key=lambda d: parse_report_date(d) or datetime.min, reverse=True)


def resolve_weekly_snapshot_iso(requested: Optional[str], ordered_available: List[str]) -> Optional[str]:
    if not ordered_available:
        return None
    if not requested or not str(requested).strip():
        return ordered_available[0]
    rq = coerce_iso_report_date(requested)
    if rq and rq in ordered_available:
        return rq
    for a in ordered_available:
        if coerce_iso_report_date(a) == rq:
            return a
    return ordered_available[0]


def fetch_qps_snapshot_rows(conn: sqlite3.Connection, iso: str) -> Tuple[List[sqlite3.Row], str]:
    if weekly_unified_table_exists(conn, "qps_bist30") and has_column(conn, "qps_bist30", "report_date"):
        rows = conn.execute(
            """
            SELECT * FROM qps_bist30
            WHERE substr(trim(cast(report_date AS text)), 1, 10) = ?
            """,
            (iso,),
        ).fetchall()
        if rows:
            return rows, f"qps_bist30@{iso}"
    tbl = table_for_report_date(conn, "qps_bist30_", iso)
    if not tbl:
        return [], ""
    rows = conn.execute(f'SELECT * FROM "{tbl}"').fetchall()
    return rows, tbl


def fetch_dip_snapshot_rows(conn: sqlite3.Connection, iso: str) -> Tuple[List[sqlite3.Row], str]:
    if weekly_unified_table_exists(conn, "dip_zirve_bist30") and has_column(conn, "dip_zirve_bist30", "report_date"):
        rows = conn.execute(
            """
            SELECT * FROM dip_zirve_bist30
            WHERE substr(trim(cast(report_date AS text)), 1, 10) = ?
            """,
            (iso,),
        ).fetchall()
        if rows:
            return rows, f"dip_zirve_bist30@{iso}"
    tbl = table_for_report_date(conn, "dip_zirve_bist30_", iso)
    if not tbl:
        return [], ""
    rows = conn.execute(f'SELECT * FROM "{tbl}"').fetchall()
    return rows, tbl


def qps_row_fill_score(row: sqlite3.Row) -> Tuple[int, float]:
    """Yüksek = daha çok dolu sütun; ikincil quant_skoru (çift satırda hangisi tutulacak)."""
    keys = [
        "deger_skoru",
        "karlilik_skoru",
        "buyume_skoru",
        "momentum_skoru",
        "quant_skoru",
        "piotroski_f_skoru",
        "magic_formula",
    ]
    n = 0
    for k in keys:
        if k not in row.keys():
            continue
        v = row[k]
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        n += 1
    qv = safe_float(pick_value(row, ["quant_skoru"]), None) if n else None
    q_key = qv if qv is not None else float("-inf")
    return (n, q_key)


def dip_row_fill_score(row: sqlite3.Row) -> int:
    keys = ["dip", "zirve", "ag_orta", "onceki_kapanis", "kapanis", "pct_getiri"]
    n = 0
    for k in keys:
        if k not in row.keys():
            continue
        v = row[k]
        if v is None or (isinstance(v, str) and not str(v).strip()):
            continue
        n += 1
    return n


def dedupe_weekly_rows_by_code(rows: List[sqlite3.Row], kind: str) -> List[sqlite3.Row]:
    buckets: Dict[str, List[sqlite3.Row]] = {}
    for row in rows:
        code_raw = pick_value(row, ["kod", "code", "symbol", "hisse", "sirket_kodu"])
        code = fix_tr(code_raw).upper().strip()
        if not code:
            continue
        buckets.setdefault(code, []).append(row)
    out: List[sqlite3.Row] = []
    for code, cand in buckets.items():
        if kind == "qps":
            best = max(cand, key=qps_row_fill_score)
        else:
            best = max(cand, key=dip_row_fill_score)
        out.append(best)
    out.sort(key=lambda r: fix_tr(str(pick_value(r, ["kod", "code", "symbol", "hisse", "sirket_kodu"]) or "")).upper())
    return out


def pick_value(row: sqlite3.Row, candidates: List[str]) -> Any:
    keys = {k.lower(): k for k in row.keys()}
    for cand in candidates:
        key = keys.get(cand.lower())
        if key is not None:
            return row[key]
    return None


def build_comparison_insight(item: Dict[str, Any]) -> str:
    internal = item.get("internalScore")
    quant = item.get("quantScore")
    momentum = item.get("momentumScore")
    value = item.get("valueScore")
    dip_dist = item.get("dipDistancePct")
    top_dist = item.get("topDistancePct")

    if internal is not None and quant is not None:
        diff = float(internal) - float(quant)
        if diff >= 8:
            lead = "Uygulama puanı, dış Quant skorunun belirgin şekilde üzerinde."
        elif diff <= -8:
            lead = "Dış Quant skoru, uygulama puanına göre daha güçlü bir sinyal veriyor."
        else:
            lead = "Uygulama puanı ile dış Quant skoru genel olarak paralel."
    else:
        lead = "Bu raporda iç ve dış skorların tamamı birlikte bulunamadı."

    secondary = ""
    if momentum is not None and value is not None:
        if momentum >= 70 and value < 50:
            secondary = " Momentum güçlü, değerleme tarafı daha zayıf görünüyor."
        elif value >= 70 and momentum < 50:
            secondary = " Değerleme güçlü, momentum tarafı daha temkinli."
    if dip_dist is not None and top_dist is not None:
        if dip_dist <= 8 and top_dist >= 25:
            secondary += " Fiyat dibe yakın ve zirveye göre halen mesafeli."
        elif top_dist <= 8:
            secondary += " Fiyat zirve bölgesine oldukça yakın."

    return f"{lead}{secondary}".strip()


@app.get("/api/score-comparison")
def get_score_comparison(
    report_date: Optional[str] = None,
    _legacy_donem_ignored: Optional[str] = Query(None, alias="donem", include_in_schema=False),
) -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        # Weekly QPS/dip tabloları tarih anahtarlı; finansal 'donem' filtresi kod kesişimini bozup tabloları boşaltır.
        internal_rows = fetch_stocks_rows(conn, None)
        internal_stocks = [map_db_row_to_stock(r) for r in internal_rows]
        internal_map = {s["code"]: s for s in internal_stocks}
        internal_codes = set(internal_map.keys())

        available_dates = unified_weekly_snapshot_dates(conn)
        resolved_iso = resolve_weekly_snapshot_iso(report_date, available_dates)

        raw_qps: List[sqlite3.Row] = []
        raw_dip: List[sqlite3.Row] = []
        qps_src = ""
        dip_src = ""
        if resolved_iso:
            raw_qps, qps_src = fetch_qps_snapshot_rows(conn, resolved_iso)
            raw_dip, dip_src = fetch_dip_snapshot_rows(conn, resolved_iso)
            raw_qps = dedupe_weekly_rows_by_code(raw_qps, "qps")
            raw_dip = dedupe_weekly_rows_by_code(raw_dip, "dip")

        qps_rows: List[Dict[str, Any]] = []
        dip_rows: List[Dict[str, Any]] = []

        for row in raw_qps:
            code_raw = pick_value(row, ["kod", "code", "symbol", "hisse", "sirket_kodu"])
            code = fix_tr(code_raw).upper()
            if not code or code not in internal_codes:
                continue
            qps_rows.append(
                {
                    "code": code,
                    "valueScore": safe_float(pick_value(row, ["deger_skoru"]), None),
                    "profitabilityScore": safe_float(pick_value(row, ["karlilik_skoru"]), None),
                    "growthScore": safe_float(pick_value(row, ["buyume_skoru"]), None),
                    "momentumScore": safe_float(pick_value(row, ["momentum_skoru"]), None),
                    "quantScore": safe_float(pick_value(row, ["quant_skoru"]), None),
                    "piotroskiFScore": safe_float(pick_value(row, ["piotroski_f_skoru"]), None),
                    "magicFormula": safe_float(pick_value(row, ["magic_formula"]), None),
                }
            )
        qps_rows.sort(key=lambda r: (r["quantScore"] is None, -(r["quantScore"] or 0)))

        for row in raw_dip:
            code_raw = pick_value(row, ["kod", "code", "symbol", "hisse", "sirket_kodu"])
            code = fix_tr(code_raw).upper()
            if not code or code not in internal_codes:
                continue
            dip_rows.append(
                {
                    "code": code,
                    "dip": safe_float(pick_value(row, ["dip"]), None),
                    "zirve": safe_float(pick_value(row, ["zirve"]), None),
                    "agOrta": safe_float(pick_value(row, ["ag_orta"]), None),
                    "oncekiKapanis": safe_float(pick_value(row, ["onceki_kapanis"]), None),
                    "kapanis": safe_float(pick_value(row, ["kapanis"]), None),
                    "pctGetiri": safe_float(pick_value(row, ["pct_getiri"]), None),
                    "dipDistancePct": safe_float(pick_value(row, ["dipten_uzaklik_pct"]), None),
                    "topDistancePct": safe_float(pick_value(row, ["zirveden_uzaklik_pct"]), None),
                    "dipBasedReturnPct": safe_float(pick_value(row, ["dibe_gore_getiri_pct"]), None),
                    "topBasedReturnPct": safe_float(pick_value(row, ["zirveye_gore_getiri_pct"]), None),
                }
            )
        dip_rows.sort(key=lambda r: r["code"])

        qps_by_code = {r["code"]: r for r in qps_rows}
        dip_by_code = {r["code"]: r for r in dip_rows}

        comparisons: List[Dict[str, Any]] = []
        for stock in internal_stocks:
            code = stock["code"]
            qps = qps_by_code.get(code, {})
            dip = dip_by_code.get(code, {})
            item = {
                "code": code,
                "name": stock["name"],
                "sector": stock["sector"],
                "internalScore": stock["score"],
                "quantScore": qps.get("quantScore"),
                "valueScore": qps.get("valueScore"),
                "profitabilityScore": qps.get("profitabilityScore"),
                "growthScore": qps.get("growthScore"),
                "momentumScore": qps.get("momentumScore"),
                "piotroskiFScore": qps.get("piotroskiFScore"),
                "magicFormula": qps.get("magicFormula"),
                "dipDistancePct": dip.get("dipDistancePct"),
                "topDistancePct": dip.get("topDistancePct"),
                "dipBasedReturnPct": dip.get("dipBasedReturnPct"),
                "topBasedReturnPct": dip.get("topBasedReturnPct"),
                "pctGetiri": dip.get("pctGetiri"),
            }
            item["insight"] = build_comparison_insight(item)
            comparisons.append(item)

        comparisons.sort(key=lambda r: r["internalScore"], reverse=True)

        aligned_count = 0
        compared_count = 0
        for c in comparisons:
            if c["internalScore"] is None or c["quantScore"] is None:
                continue
            compared_count += 1
            if abs(float(c["internalScore"]) - float(c["quantScore"])) <= 7:
                aligned_count += 1

        return {
            "selectedReportDate": resolved_iso,
            "financialDonem": None,
            "availableDates": available_dates,
            "sources": {"qpsTable": qps_src or None, "dipTable": dip_src or None},
            "qpsRows": qps_rows,
            "dipRows": dip_rows,
            "comparisons": comparisons,
            "summary": {
                "stockCount": len(comparisons),
                "qpsCount": len(qps_rows),
                "dipCount": len(dip_rows),
                "comparedCount": compared_count,
                "alignedCount": aligned_count,
                "hasData": bool(qps_rows or dip_rows or comparisons),
            },
        }
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/score-comparison/dates")
def get_score_comparison_dates() -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        available_dates = unified_weekly_snapshot_dates(conn)
        return {"availableDates": available_dates, "latestDate": available_dates[0] if available_dates else None}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/technical-analysis/dates")
def get_technical_analysis_dates() -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        dates = get_available_technical_dates(conn)
        return {"availableDates": dates, "latestDate": dates[0] if dates else None}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/technical-analysis")
def get_technical_analysis(report_date: Optional[str] = None) -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        available_dates = get_available_technical_dates(conn)
        if not available_dates:
            return {
                "selectedDate": None,
                "availableDates": [],
                "indexIndicators": [],
                "indexSupportResistance": [],
                "bist30Indicators": [],
                "bist30SupportResistance": [],
                "summary": {"indexCount": 0, "bist30Count": 0, "hasData": False},
            }

        selected_date = report_date if report_date in available_dates else available_dates[0]

        index_indicators_rows = conn.execute(
            """
            SELECT * FROM endeks_indikator
            WHERE report_date = ?
            ORDER BY symbol
            """,
            (selected_date,),
        ).fetchall()
        index_sr_rows = conn.execute(
            """
            SELECT * FROM endeks_destek_direnc
            WHERE report_date = ?
            ORDER BY symbol
            """,
            (selected_date,),
        ).fetchall()
        bist_indicators_rows = conn.execute(
            """
            SELECT * FROM bist30_indikator
            WHERE report_date = ?
            ORDER BY symbol
            """,
            (selected_date,),
        ).fetchall()
        bist_sr_rows = conn.execute(
            """
            SELECT * FROM bist30_destek_direnc
            WHERE report_date = ?
            ORDER BY hisse
            """,
            (selected_date,),
        ).fetchall()

        index_indicators = [map_endeks_indikator_row(r) for r in index_indicators_rows]
        index_support_resistance = [map_endeks_destek_direnc_row(r) for r in index_sr_rows]
        bist30_indicators = [map_bist30_indikator_row(r) for r in bist_indicators_rows]
        bist30_support_resistance = [map_bist30_destek_direnc_row(r) for r in bist_sr_rows]

        return {
            "selectedDate": selected_date,
            "availableDates": available_dates,
            "indexIndicators": index_indicators,
            "indexSupportResistance": index_support_resistance,
            "bist30Indicators": bist30_indicators,
            "bist30SupportResistance": bist30_support_resistance,
            "summary": {
                "indexCount": len(index_indicators),
                "bist30Count": len(bist30_indicators),
                "hasData": bool(index_indicators or index_support_resistance or bist30_indicators or bist30_support_resistance),
            },
        }
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


@app.post("/api/calculate-score")
def calculate_score(payload: CalculateScoreRequest) -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        columns = sorted(set(["sektor"] + [cfg["column"] for cfg in METRIC_CONFIG.values()]))
        sql_cols = ", ".join(columns)
        rows = db.select_hisse_for_calculator_latest(conn, sql_cols)

        category_values: Dict[str, List[float]] = {
            "valuation": [],
            "profitability": [],
            "health": [],
            "growth": [],
            "dividend": [],
        }
        used_metrics: List[Dict[str, Any]] = []
        missing_metrics: List[str] = []

        payload_dict = payload.model_dump()
        selected_sector = fix_tr(payload_dict.get("sector")) if payload_dict.get("sector") else None

        sector_vals: Dict[str, Dict[str, List[float]]] = {}
        global_vals: Dict[str, List[float]] = {metric: [] for metric in METRIC_CONFIG.keys()}

        for row in rows:
            sector_name = fix_tr(row["sektor"]) if "sektor" in row.keys() and row["sektor"] is not None else "Bilinmiyor"
            sector_vals.setdefault(sector_name, {metric: [] for metric in METRIC_CONFIG.keys()})
            for metric_key, cfg in METRIC_CONFIG.items():
                col = cfg["column"]
                raw_val = row[col] if col in row.keys() else None
                cleaned = clean_metric_value(metric_key, raw_val)
                if cleaned is None:
                    continue
                sector_vals[sector_name][metric_key].append(cleaned)
                global_vals[metric_key].append(cleaned)

        for metric_key in global_vals:
            global_vals[metric_key].sort()
        for sector_name in sector_vals:
            for metric_key in sector_vals[sector_name]:
                sector_vals[sector_name][metric_key].sort()

        def choose_ref(metric_key: str, sector_name: Optional[str]) -> List[float]:
            if sector_name:
                sector_ref = sector_vals.get(sector_name, {}).get(metric_key, [])
                if len(sector_ref) >= 4:
                    return sector_ref
            return global_vals.get(metric_key, [])

        for metric_key, cfg in METRIC_CONFIG.items():
            user_value = payload_dict.get(metric_key)
            category = cfg["category"]
            higher_is_better = bool(cfg["higher_is_better"])

            if user_value is None:
                missing_metrics.append(metric_key)
                continue

            cleaned_user_value = clean_metric_value(metric_key, user_value)
            if cleaned_user_value is None:
                missing_metrics.append(metric_key)
                continue

            distribution = choose_ref(metric_key, selected_sector)
            metric_score = metric_percentile_score(cleaned_user_value, distribution, higher_is_better)
            if metric_score is None:
                missing_metrics.append(metric_key)
                continue

            category_values[category].append(metric_score)
            used_metrics.append(
                {
                    "metric": metric_key,
                    "value": round(cleaned_user_value, 4),
                    "category": category,
                    "percentileScore": round(metric_score, 2),
                }
            )

        category_scores: Dict[str, Optional[float]] = {}
        active_weight_total = 0.0
        weighted_sum = 0.0

        for category, values in category_values.items():
            if not values:
                category_scores[category] = None
                continue
            avg = sum(values) / len(values)
            category_scores[category] = round(avg, 2)
            weight = CATEGORY_WEIGHTS[category]
            weighted_sum += avg * weight
            active_weight_total += weight

        raw_score = round(weighted_sum / active_weight_total, 2) if active_weight_total > 0 else 0.0

        raw_distribution: List[float] = []
        for row in rows:
            row_sector = fix_tr(row["sektor"]) if "sektor" in row.keys() and row["sektor"] is not None else "Bilinmiyor"
            row_category_values: Dict[str, List[float]] = {
                "valuation": [],
                "profitability": [],
                "health": [],
                "growth": [],
                "dividend": [],
            }

            for metric_key, cfg in METRIC_CONFIG.items():
                col = cfg["column"]
                higher_is_better = bool(cfg["higher_is_better"])
                cleaned_row_value = clean_metric_value(metric_key, row[col] if col in row.keys() else None)
                if cleaned_row_value is None:
                    continue
                ref_vals = choose_ref(metric_key, row_sector)
                row_metric_score = metric_percentile_score(cleaned_row_value, ref_vals, higher_is_better)
                if row_metric_score is None:
                    continue
                row_category_values[cfg["category"]].append(row_metric_score)

            row_weighted_sum = 0.0
            row_active_weight = 0.0
            for category, values in row_category_values.items():
                if not values:
                    continue
                cat_avg = sum(values) / len(values)
                row_weighted_sum += cat_avg * CATEGORY_WEIGHTS[category]
                row_active_weight += CATEGORY_WEIGHTS[category]

            if row_active_weight > 0:
                raw_distribution.append(round(row_weighted_sum / row_active_weight, 2))

        calibrated_score = calibrate_score_from_distribution(raw_score, raw_distribution, low=55.0, high=95.0)
        recommendation = recommendation_from_score(calibrated_score)

        return {
            "rawScore": raw_score,
            "calibratedScore": calibrated_score,
            "recommendation": recommendation,
            "categoryScores": category_scores,
            "usedMetrics": used_metrics,
            "missingMetrics": missing_metrics,
        }
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


def _sqlite_row_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {k: row[k] for k in row.keys()}


@app.get("/api/hisseler/latest")
def api_hisseler_latest_raw() -> List[Dict[str, Any]]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")
    conn = get_conn()
    try:
        return [_sqlite_row_dict(r) for r in db.get_latest_hisseler(conn)]
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        conn.close()


@app.get("/api/hisseler/periods")
def api_hisseler_periods() -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")
    conn = get_conn()
    try:
        return {"periods": db.get_periods(conn)}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        conn.close()


@app.get("/api/hisseler/by-period/{donem:path}")
def api_hisseler_by_period(donem: str) -> List[Dict[str, Any]]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")
    conn = get_conn()
    try:
        return [_sqlite_row_dict(r) for r in db.get_hisseler_by_period(conn, donem)]
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        conn.close()


@app.get("/api/hisseler/history/{sirket_kodu}")
def api_hisseler_history(sirket_kodu: str) -> Dict[str, Any]:
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")
    conn = get_conn()
    try:
        rows = db.get_hisse_history(conn, sirket_kodu)
        items = [_sqlite_row_dict(r) for r in rows]
        series_label = lambda rdict: fix_tr(str(rdict.get("donem") or "")) or str(rdict.get("tarih") or "") or (
            str(rdict["id"]) if rdict.get("id") is not None else ""
        )
        chart = []
        for rd in items:
            dte_raw = nullable_float(rd.get("kaldirac_orani"))
            d_scaled = None if dte_raw is None else (dte_raw / 100.0 if dte_raw > 10 else dte_raw)
            chart.append(
                {
                    "label": series_label(rd),
                    "fk": nullable_float(rd.get("fk")),
                    "pdDd": nullable_float(rd.get("pd_dd")),
                    "netKarMarji": nullable_float(rd.get("net_kar_marji")),
                    "favokMarji": nullable_float(rd.get("favok_marji")),
                    "piyasaDegeriTl": nullable_float(rd.get("piyasa_degeri_tl")),
                    "debtToEquity": round(d_scaled, 4) if d_scaled is not None else None,
                }
            )
        return {"items": items, "chartSeries": chart, "sirketKodu": sirket_kodu.upper()}
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        conn.close()


def _table_exists(conn: sqlite3.Connection, name: str) -> bool:
    cur = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


@app.get("/api/recommendation-comparison")
def get_recommendation_comparison(
    halk_report_id: Optional[int] = Query(
        None,
        description="Halk verisi için belirli bir rapor kimliği (analyst_reports.id). Yoksa güncel satırlar.",
    ),
) -> Dict[str, Any]:
    """
    Halk, İş ve Ziraat kurum önerilerini hisse kodu üzerinden birleştirir;
    kurum özeti, tazelik ve öne çıkan listeler döner.
    """
    if not db.resolve_db_path().exists():
        raise HTTPException(status_code=500, detail="Database file not found.")

    from recommendation_comparison import build_recommendation_comparison_payload

    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        payload = build_recommendation_comparison_payload(
            conn,
            fix_tr=fix_tr,
            safe_float=safe_float,
            parse_report_date=parse_report_date,
            table_exists=_table_exists,
            halk_report_id=halk_report_id,
        )
        return {"generatedAt": datetime.utcnow().isoformat() + "Z", **payload}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()


@app.get("/api/company-news")
def get_company_news(
    report_date: Optional[str] = Query(
        None,
        description="Tek bir bülten tarihine filtre (YYYY-MM-DD). Boşsa tüm kayıtlar, en eski üstte.",
    ),
) -> Dict[str, Any]:
    """
    `sirket_haberleri` tablosundan şirket haberleri.
    Varsayılan sıra: report_date ASC, id ASC (eski haftalar üstte, en güncü kayıtlar altta).
    Sektör: `hisseler.sirket_kodu` ile eşleşme.
    """
    conn: Optional[sqlite3.Connection] = None
    try:
        conn = get_conn()
        if not _table_exists(conn, "sirket_haberleri"):
            return {
                "items": [],
                "count": 0,
                "availableReportDates": [],
                "selectedReportDate": None,
                "message": "sirket_haberleri tablosu veritabanında yok.",
            }

        date_rows = conn.execute(
            """
            SELECT DISTINCT TRIM(report_date) AS d
            FROM sirket_haberleri
            WHERE report_date IS NOT NULL AND TRIM(report_date) != ''
            ORDER BY d ASC
            """
        ).fetchall()
        available_report_dates = [str(r["d"]).strip() for r in date_rows if r["d"]]

        where_sql = ""
        params: tuple = ()
        if report_date and report_date.strip():
            where_sql = "WHERE TRIM(IFNULL(h.report_date, '')) = ?"
            params = (report_date.strip(),)

        rows = conn.execute(
            f"""
            SELECT
                h.id,
                h.report_date,
                h.company_code,
                h.company_name,
                h.analyst_view,
                h.news_text,
                h.hisse_verileri_text,
                h.piyasa_carpanlari_text,
                h.relatif_performans_text,
                h.raw_table_text,
                h.raw_block_text,
                h.source_name,
                (
                    SELECT i2.sektor FROM hisseler i2
                    WHERE UPPER(TRIM(IFNULL(i2.sirket_kodu, ''))) = UPPER(TRIM(IFNULL(h.company_code, '')))
                    ORDER BY i2.tarih DESC, i2.id DESC
                    LIMIT 1
                ) AS sector
            FROM sirket_haberleri h
            {where_sql}
            ORDER BY h.report_date ASC, h.id ASC
            """,
            params,
        ).fetchall()

        items: List[Dict[str, Any]] = []
        for row in rows:
            sec = row["sector"] if "sector" in row.keys() else None
            items.append(
                {
                    "id": int(row["id"]),
                    "reportDate": str(row["report_date"] or "").strip(),
                    "companyCode": fix_tr(row["company_code"] if "company_code" in row.keys() else "") or "",
                    "companyName": fix_tr(row["company_name"] if "company_name" in row.keys() else "") or "",
                    "sector": fix_tr(sec) if sec else None,
                    "analystView": fix_tr(row["analyst_view"] if "analyst_view" in row.keys() else ""),
                    "newsText": fix_tr(row["news_text"] if "news_text" in row.keys() else ""),
                    "stockDataText": fix_tr(row["hisse_verileri_text"] if "hisse_verileri_text" in row.keys() else ""),
                    "marketMultiplesText": fix_tr(
                        row["piyasa_carpanlari_text"] if "piyasa_carpanlari_text" in row.keys() else ""
                    ),
                    "relativePerformanceText": fix_tr(
                        row["relatif_performans_text"] if "relatif_performans_text" in row.keys() else ""
                    ),
                    "rawTableText": fix_tr(row["raw_table_text"] if "raw_table_text" in row.keys() else ""),
                    "rawBlockText": fix_tr(row["raw_block_text"] if "raw_block_text" in row.keys() else ""),
                    "sourceName": fix_tr(row["source_name"] if "source_name" in row.keys() else ""),
                }
            )

        selected: Optional[str] = None
        if report_date and report_date.strip() in available_report_dates:
            selected = report_date.strip()
        elif report_date and report_date.strip():
            selected = None
        return {
            "items": items,
            "count": len(items),
            "availableReportDates": available_report_dates,
            "selectedReportDate": selected,
        }
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}") from exc
    finally:
        if conn is not None:
            conn.close()
