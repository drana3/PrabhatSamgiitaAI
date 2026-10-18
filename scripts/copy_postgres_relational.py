#!/usr/bin/env python3
"""Copy public relational tables from DATABASE_URL_SOURCE to DATABASE_URL.

Skips embeddings columns and alembic_version. Uses COPY for speed.
"""

from __future__ import annotations

import os
import sys

import psycopg


SKIP_TABLES = {"alembic_version"}
SKIP_COLUMNS = {"embeddings"}


def libpq(url: str) -> str:
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def main() -> int:
    source = os.environ.get("DATABASE_URL_SOURCE")
    dest = os.environ.get("DATABASE_URL")
    if not source or not dest:
        print("Set DATABASE_URL_SOURCE and DATABASE_URL", file=sys.stderr)
        return 1
    src = psycopg.connect(libpq(source), connect_timeout=30)
    dst = psycopg.connect(libpq(dest), connect_timeout=30)
    src.autocommit = True
    dst.autocommit = False
    with src.cursor() as scur:
        scur.execute("SET statement_timeout = '15min'")
    try:
        with src.cursor() as scur, dst.cursor() as dcur:
            scur.execute(
                """
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                ORDER BY tablename
                """
            )
            source_tables = [row[0] for row in scur.fetchall()]
            dcur.execute(
                """
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                ORDER BY tablename
                """
            )
            dest_tables = {row[0] for row in dcur.fetchall()}
            to_copy = [
                table
                for table in source_tables
                if table not in SKIP_TABLES and table in dest_tables
            ]
            dcur.execute(
                """
                SELECT conname, conrelid::regclass::text, pg_get_constraintdef(oid)
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace = 'public'::regnamespace
                """
            )
            foreign_keys = list(dcur.fetchall())
            for name, table, _definition in foreign_keys:
                dcur.execute(
                    f"ALTER TABLE {table} DROP CONSTRAINT {quote_ident(name)}"
                )
            for table in to_copy:
                dcur.execute(f"TRUNCATE {quote_ident(table)}")
            copied = 0
            for table in to_copy:
                scur.execute(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=%s
                    ORDER BY ordinal_position
                    """,
                    (table,),
                )
                source_cols = [row[0] for row in scur.fetchall()]
                dcur.execute(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=%s
                    ORDER BY ordinal_position
                    """,
                    (table,),
                )
                dest_cols = [row[0] for row in dcur.fetchall()]
                cols = [c for c in source_cols if c in dest_cols and c not in SKIP_COLUMNS]
                if not cols:
                    print("skip empty", table)
                    continue
                col_sql = ", ".join(quote_ident(c) for c in cols)
                ident = quote_ident(table)
                with scur.copy(f"COPY (SELECT {col_sql} FROM {ident}) TO STDOUT") as reader:
                    with dcur.copy(f"COPY {ident} ({col_sql}) FROM STDIN") as writer:
                        for chunk in reader:
                            writer.write(chunk)
                dcur.execute(f"SELECT count(*) FROM {ident}")
                count = dcur.fetchone()[0]
                print(f"copied {table} {count}")
                copied += 1
            for name, table, definition in foreign_keys:
                dcur.execute(
                    f"ALTER TABLE {table} ADD CONSTRAINT {quote_ident(name)} {definition}"
                )
            dcur.execute(
                """
                SELECT n.nspname, c.relname, a.attname
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_attribute a ON a.attrelid = c.oid
                WHERE n.nspname = 'public'
                  AND a.attnum > 0 AND NOT a.attisdropped
                  AND pg_get_serial_sequence(n.nspname || '.' || c.relname, a.attname) IS NOT NULL
                """
            )
            for schema, table, column in dcur.fetchall():
                seq_ident = f"{quote_ident(schema)}.{quote_ident(table)}"
                dcur.execute(
                    f"SELECT COALESCE(MAX({quote_ident(column)}), 1) FROM {seq_ident}"
                )
                max_id = dcur.fetchone()[0]
                dcur.execute(
                    "SELECT pg_get_serial_sequence(%s, %s)",
                    (f"{schema}.{table}", column),
                )
                seq = dcur.fetchone()[0]
                if seq and isinstance(max_id, int):
                    dcur.execute("SELECT setval(%s, %s, true)", (seq, max_id))
            dst.commit()
            print(f"done tables={copied}")
    except Exception:
        dst.rollback()
        raise
    finally:
        src.close()
        dst.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
