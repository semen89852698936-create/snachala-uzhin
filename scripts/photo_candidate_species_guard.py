"""Read-only metadata triage. A URL mismatch is not visual proof."""
import json
import sys

def risky_candidates(data):
    findings = []
    for item in data.get("sources", []):
        url = item.get("source_page", "").lower()
        title = item.get("recipe_title", "").lower()
        if "chicken" in url and ("свин" in title or "говяж" in title):
            findings.append({"n": item["n"], "recipe_id": item["recipe_id"], "reason": "species_mismatch_in_url_only"})
    return findings

if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as f:
        print(json.dumps(risky_candidates(json.load(f)), ensure_ascii=False, indent=2))
