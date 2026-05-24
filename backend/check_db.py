import sqlite3
conn = sqlite3.connect('instance/smartpark.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

for t in tables:
    print(f"\n=== {t} (last 5) ===")
    try:
        cur.execute(f"SELECT * FROM {t} ORDER BY rowid DESC LIMIT 5")
        rows = cur.fetchall()
        for r in rows:
            print(dict(r))
    except Exception as e:
        print(f"  error: {e}")

conn.close()
