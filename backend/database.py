"""
Centralized SQLite access for versioned hisseler snapshots (donem/tarih per sirket_kodu).
Never deletes rows; ingestion should INSERT only — use should_skip_duplicate_hisse_insert().
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import List, Optional

_DEFAULT_BUNDLED = Path(__file__).resolve().parent / "data" / "bist30.db"


def resolve_db_path() -> Path:
    env = os.environ.get("BIST_DATABASE_PATH") or os.environ.get("DATABASE_PATH")
    if env:
        p = Path(env).expanduser()
        if not p.is_absolute():
            p = Path(__file__).resolve().parent / p
        return p
    desktop = Path.home() / "Desktop" / "bist30 2.db"
    if desktop.exists():
        return desktop
    return _DEFAULT_BUNDLED


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(resolve_db_path()))
    conn.row_factory = sqlite3.Row
    return conn


def has_column(conn: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table_name})")
    cols = [row["name"] for row in cur.fetchall()]
    return column_name in cols


def supports_hisse_versioning(conn: sqlite3.Connection) -> bool:
    return (
        has_column(conn, "hisseler", "tarih")
        and has_column(conn, "hisseler", "sirket_kodu")
        and has_column(conn, "hisseler", "id")
    )


def sql_from_clause_latest_hisseler(conn: sqlite3.Connection, alias: str = "h") -> str:
    """FROM ... join one row per sirket_kodu (latest tarih then id DESC)."""
    if not supports_hisse_versioning(conn):
        # Legacy single-row-per-company DB
        return f"hisseler {alias}"
    return f"""hisseler {alias}
        INNER JOIN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY sirket_kodu
                           ORDER BY tarih DESC, id DESC
                       ) AS rn
                FROM hisseler
            ) z WHERE z.rn = 1
        ) lid ON lid.id = {alias}.id"""


def get_latest_hisseler(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    """
    Latest record per sirket_kodu: MAX(tarih) semantics with id tie-break
    via ROW_NUMBER (ORDER BY tarih DESC, id DESC).
    """
    if not supports_hisse_versioning(conn):
        return conn.execute(
            """
            SELECT * FROM hisseler
            ORDER BY sirket_kodu
            """
        ).fetchall()
    return conn.execute(
        """
        SELECT h.*
        FROM hisseler h
        INNER JOIN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY sirket_kodu
                           ORDER BY tarih DESC, id DESC
                       ) AS rn
                FROM hisseler
            ) z WHERE z.rn = 1
        ) lid ON lid.id = h.id
        ORDER BY h.sirket_kodu
        """
    ).fetchall()


def get_hisse_history(conn: sqlite3.Connection, sirket_kodu: str) -> List[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM hisseler
        WHERE UPPER(sirket_kodu) = UPPER(?)
        ORDER BY tarih DESC, id DESC
        """,
        (sirket_kodu,),
    ).fetchall()


def get_periods(conn: sqlite3.Connection) -> List[str]:
    if not has_column(conn, "hisseler", "donem"):
        return []
    rows = conn.execute(
        """
        SELECT DISTINCT donem
        FROM hisseler
        WHERE donem IS NOT NULL AND TRIM(donem) != ''
        ORDER BY donem DESC
        """
    ).fetchall()
    return [str(r["donem"]).strip() for r in rows if r["donem"] is not None]


def get_hisseler_by_period(conn: sqlite3.Connection, donem: str) -> List[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM hisseler
        WHERE TRIM(IFNULL(donem, '')) = TRIM(?)
        ORDER BY sirket_kodu
        """,
        (donem.strip(),),
    ).fetchall()


def get_hisse_latest(conn: sqlite3.Connection, sirket_kodu: str) -> Optional[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM hisseler
        WHERE UPPER(sirket_kodu) = UPPER(?)
        ORDER BY tarih DESC, id DESC
        LIMIT 1
        """,
        (sirket_kodu,),
    ).fetchone()


def should_skip_duplicate_hisse_insert(
    conn: sqlite3.Connection, sirket_kodu: str, donem: Optional[str]
) -> bool:
    """True if a row already exists for today (local DATE) — skip duplicate insert."""
    if not has_column(conn, "hisseler", "donem"):
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM hisseler
            WHERE UPPER(sirket_kodu) = UPPER(?)
            AND DATE(IFNULL(tarih, '')) = DATE('now')
            """,
            (sirket_kodu,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM hisseler
            WHERE UPPER(sirket_kodu) = UPPER(?)
            AND TRIM(IFNULL(donem, '')) = TRIM(IFNULL(?, ''))
            AND DATE(IFNULL(tarih, '')) = DATE('now')
            """,
            (sirket_kodu, donem if donem is not None else ""),
        ).fetchone()
    if row is None:
        return False
    try:
        return int(row["n"]) > 0
    except (TypeError, ValueError):
        return False


def load_latest_hisse_ids(conn: sqlite3.Connection) -> List[int]:
    if not supports_hisse_versioning(conn):
        rows = conn.execute(
            """
            SELECT MAX(id) AS mid FROM hisseler GROUP BY UPPER(sirket_kodu)
            """
        ).fetchall()
        return [int(r["mid"]) for r in rows if r["mid"] is not None]
    rows = conn.execute(
        """
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY sirket_kodu
                       ORDER BY tarih DESC, id DESC
                   ) AS rn
            FROM hisseler
        ) z WHERE z.rn = 1
        """
    ).fetchall()
    return [int(r["id"]) for r in rows if r["id"] is not None]


def select_hisse_for_calculator_latest(conn: sqlite3.Connection, columns_sql: str) -> List[sqlite3.Row]:
    ids = load_latest_hisse_ids(conn)
    if not ids:
        return conn.execute(f"SELECT {columns_sql} FROM hisseler").fetchall()
    placeholders = ",".join("?" * len(ids))
    return conn.execute(
        f"SELECT {columns_sql} FROM hisseler WHERE id IN ({placeholders})",
        ids,
    ).fetchall()
