"""
Runs the migrations on a throwaway local PostgreSQL, so their SQL and their
rules can be tested without touching a Supabase project.

    python3 supabase/tests/test_direct_booking.py [extra.sql ...]

Needs PostgreSQL 15+ with PostGIS (apt: postgresql-16 postgresql-16-postgis-3)
and psycopg 3 (pip: "psycopg[binary]"). Supabase's own pieces (auth, storage,
pg_net, roles) come from shim.sql. Extra .sql files, e.g. migrations still on
other branches, are applied in filename order with the rest.
"""
import glob
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import uuid
from contextlib import contextmanager

import psycopg

HERE = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS = os.path.join(HERE, "..", "migrations")


def _pg_bin() -> str:
    found = sorted(glob.glob("/usr/lib/postgresql/*/bin"), key=lambda p: int(p.split("/")[-2]))
    if not found:
        sys.exit("PostgreSQL not found (apt install postgresql-16 postgresql-16-postgis-3)")
    return found[-1]


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LocalDb:
    """A PostgreSQL cluster in a temp folder, deleted on close."""

    def __init__(self):
        self.bin = _pg_bin()
        self.dir = tempfile.mkdtemp(prefix="lezerv-pg-")
        self.port = _free_port()
        # initdb refuses to run as root; use the postgres system user then.
        self.as_user = ["runuser", "-u", "postgres", "--"] if os.geteuid() == 0 else []
        if self.as_user:
            shutil.chown(self.dir, "postgres")
        data = os.path.join(self.dir, "data")
        self._run("initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-sync")
        self._run("pg_ctl", "-D", data, "-l", os.path.join(self.dir, "log"), "-w", "start",
                  "-o", f"-p {self.port} -k {self.dir} -c listen_addresses='' -c fsync=off")
        self.data = data
        self.conn = psycopg.connect(host=self.dir, port=self.port, user="postgres", dbname="postgres", autocommit=True)

    def _run(self, tool, *args):
        subprocess.run(self.as_user + [os.path.join(self.bin, tool), *args], check=True, stdout=subprocess.DEVNULL)

    def close(self):
        try:
            self.conn.close()
            self._run("pg_ctl", "-D", self.data, "-w", "-m", "immediate", "stop")
        finally:
            shutil.rmtree(self.dir, ignore_errors=True)

    # ── setup ──

    def apply(self, path: str):
        sql = open(path, encoding="utf-8").read()
        # pg_net isn't installed locally; shim.sql provides a stand-in net schema.
        sql = re.sub(r"(?im)^\s*create extension if not exists pg_net[^;]*;", "-- pg_net: see shim.sql", sql)
        try:
            self.conn.execute(sql)
        except psycopg.Error as e:
            raise SystemExit(f"\nFAILED applying {os.path.basename(path)}:\n{e}") from None

    def migrate(self, extra=()):
        self.apply(os.path.join(HERE, "shim.sql"))
        files = glob.glob(os.path.join(MIGRATIONS, "*.sql")) + list(extra)
        for f in sorted(files, key=os.path.basename):
            self.apply(f)
            print("applied", os.path.basename(f))

    # ── acting as people ──

    def new_user(self, email=None, phone=None, name="") -> str:
        uid = str(uuid.uuid4())
        self.conn.execute(
            "insert into auth.users (id, email, phone, raw_user_meta_data) values (%s, %s, %s, jsonb_build_object('full_name', %s::text))",
            (uid, email, phone, name))
        return uid

    @contextmanager
    def as_(self, uid):
        """Run statements the way PostgREST would for this signed-in user (None = anon)."""
        c = self.conn
        c.execute("set role anon" if uid is None else "set role authenticated")
        c.execute("select set_config('request.jwt.claim.sub', %s, false)", (uid or "",))
        try:
            yield c
        finally:
            c.execute("reset role")
            c.execute("select set_config('request.jwt.claim.sub', '', false)")

    def one(self, sql, *params, uid="superuser"):
        """First row of a query, as superuser or as [uid]."""
        if uid == "superuser":
            cur = self.conn.execute(sql, params)
            return cur.fetchone() if cur.description else None
        with self.as_(uid) as c:
            cur = c.execute(sql, params)
            return cur.fetchone() if cur.description else None

    def fails(self, sql, *params, uid=None, contains=""):
        """The statement is refused (and with [contains] in the message, if given)."""
        try:
            with self.as_(uid) as c:
                c.execute(sql, params)
        except psycopg.Error as e:
            return contains.lower() in str(e).lower()
        return False


class Checks:
    def __init__(self):
        self.n = 0

    def __call__(self, name, ok):
        self.n += 1
        print(("PASS  " if ok else "FAIL  ") + name)
        if not ok:
            raise SystemExit(f"check failed: {name}")
