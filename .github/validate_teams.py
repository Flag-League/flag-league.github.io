#!/usr/bin/env python3
"""Validate teams.json: JSON Schema shape plus referential integrity.

Run locally with:  python .github/validate_teams.py
Requires:          pip install jsonschema
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    data = json.loads((ROOT / "teams.json").read_text())
    schema = json.loads((ROOT / "teams.schema.json").read_text())

    errors = []

    # 1. Shape / types, from teams.schema.json.
    validator = Draft7Validator(schema)
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in err.path) or "(root)"
        errors.append(f"schema: {loc}: {err.message}")

    # 2. Checks the schema can't express: unique team ids, and every event a
    #    team references must exist in the top-level events map.
    event_ids = set(data.get("events", {}))
    seen = set()
    for team in data.get("teams", []):
        tid = team.get("id", "?")
        if tid in seen:
            errors.append(f"refs: duplicate team id '{tid}'")
        seen.add(tid)
        for eid in team.get("events", {}):
            if eid not in event_ids:
                errors.append(f"refs: team '{tid}' references unknown event '{eid}'")

    if errors:
        print(f"teams.json is invalid ({len(errors)} problem(s)):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(
        f"teams.json OK: {len(data['events'])} events, {len(data['teams'])} teams."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
