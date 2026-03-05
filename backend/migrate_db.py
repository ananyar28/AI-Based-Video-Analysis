"""
migrate_db.py
=============
Drops all existing AegisVision tables and recreates them with the current schema.

WARNING: This deletes all existing data in the database.
Only run this during development when you're OK losing data.

Usage:
    cd backend
    venv\Scripts\python.exe migrate_db.py
"""

import sys
from sqlalchemy import text
import database
import models

def migrate():
    print("\n=== AegisVision DB Migration ===\n")
    engine = database.engine

    with engine.connect() as conn:
        print("Dropping existing tables (if any)...")
        # Drop in reverse dependency order to avoid FK constraint violations
        tables = [
            "frame_results",
            "alerts",
            "streams",
            "videos",
            "users",
        ]
        for table in tables:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                print(f"  ✓ Dropped: {table}")
            except Exception as e:
                print(f"  ✗ Could not drop {table}: {e}")
        conn.commit()

    print("\nRecreating all tables with current schema...")
    try:
        models.Base.metadata.create_all(bind=engine)
        print("  ✓ Created: users")
        print("  ✓ Created: videos (with fps, resolution, frames_analyzed etc.)")
        print("  ✓ Created: frame_results")
        print("  ✓ Created: alerts")
        print("  ✓ Created: streams")
    except Exception as e:
        print(f"  ✗ Failed to create tables: {e}")
        sys.exit(1)

    print("\n✅ Migration complete. Database is ready.\n")


if __name__ == "__main__":
    migrate()
