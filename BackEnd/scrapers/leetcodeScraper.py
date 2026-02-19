#!/usr/bin/env python3
"""
build_codeforces_dataset.py
Creates dataset.json from Codeforces problem metadata + optional scraping of statements & sample tests.

Usage:
  pip install -r requirements.txt
  python build_codeforces_dataset.py --out dataset.json --max-problems 200 --min-rating 900 --max-rating 1800 --fetch-pages --use-cloudscraper

Notes:
  - The script uses the official Codeforces API for metadata and optionally fetches problem pages for statements/sample-tests.
  - It caches fetched HTML under ./cf_cache so you can resume or re-run without re-downloading.
  - Be polite: don't set rate too low. Default is 1.5s between fetches (randomized).
"""

import requests
import time
import random
import os
import json
import argparse
import re
from bs4 import BeautifulSoup
from html import unescape
from pathlib import Path
from tqdm import tqdm

# Optional: pip install html2text to convert html->markdown (fallback: strip tags)
try:
    import html2text
    HAVE_HTML2TEXT = True
except Exception:
    HAVE_HTML2TEXT = False

# Optional cloudscraper fallback
try:
    import cloudscraper
    HAVE_CLOUDSCRAPER = True
except Exception:
    HAVE_CLOUDSCRAPER = False

CF_API_BASE = "https://codeforces.com/api"

# Realistic browser headers (helps avoid simple bot blocks)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://codeforces.com/",
    "Connection": "keep-alive",
}

CACHE_DIR = Path("cf_cache")
CACHE_DIR.mkdir(exist_ok=True)

# Create a requests session and set headers
session = requests.Session()
session.headers.update(HEADERS)

# If using cloudscraper, create a scraper instance lazily
_scraper = None
def get_cloudscraper():
    global _scraper
    if _scraper is None:
        _scraper = cloudscraper.create_scraper() if HAVE_CLOUDSCRAPER else None
    return _scraper

def api_problemset_problems(tags=None):
    params = {}
    if tags:
        params["tags"] = tags  # semicolon-separated
    url = f"{CF_API_BASE}/problemset.problems"
    r = session.get(url, params=params, timeout=20)
    r.raise_for_status()
    resp = r.json()
    if resp.get("status") != "OK":
        raise RuntimeError("CF API error: " + str(resp))
    return resp["result"]["problems"], resp["result"]["problemStatistics"]

def rating_to_bucket(rating):
    if rating is None:
        return "unknown"
    r = int(rating)
    if r <= 1200:
        return "easy"
    if r <= 1700:
        return "medium"
    return "hard"

def build_problem_url(p):
    if "contestId" in p and p.get("contestId") is not None:
        return f"https://codeforces.com/problemset/problem/{p['contestId']}/{p['index']}"
    return f"https://codeforces.com/problemset/problem/{p.get('contestId','')}/{p['index']}"

def fetch_and_cache(url, cache_path: Path, sleep_base=1.5, max_retries=3, use_cloudscraper=False):
    """
    Fetch URL and cache to cache_path. Resume from cache if present.
    Retries on transient errors and falls back to cloudscraper optionally.
    sleep_base: base seconds to wait before the request (randomized).
    """
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")

    # polite randomized delay
    delay = random.uniform(sleep_base, sleep_base * 1.4)
    time.sleep(delay)

    last_exc = None
    for attempt in range(1, max_retries + 1):
        try:
            # primary request via requests.Session
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
            txt = resp.text
            cache_path.write_text(txt, encoding="utf-8")
            return txt
        except requests.exceptions.HTTPError as he:
            status = getattr(he.response, "status_code", None)
            last_exc = he
            # If it's a 403 and cloudscraper is allowed, try cloudscraper
            if status == 403 and use_cloudscraper and HAVE_CLOUDSCRAPER:
                try:
                    scraper = get_cloudscraper()
                    if scraper is not None:
                        resp = scraper.get(url, timeout=30)
                        resp.raise_for_status()
                        txt = resp.text
                        cache_path.write_text(txt, encoding="utf-8")
                        return txt
                except Exception as ce:
                    last_exc = ce
                    # fallthrough to retry/backoff
            # for 404 or other permanent errors, break immediately
            if status in (404, 410):
                raise
        except Exception as e:
            last_exc = e

        # exponential backoff before next retry
        backoff = (2 ** attempt) + random.uniform(0, 1.0)
        time.sleep(backoff)

    # All retries failed
    raise last_exc

def parse_problem_page(html_text):
    """
    Extract the problem statement fragment and visible sample tests.
    Returns dict: {"statement_md": md_text, "visible_examples": [{"input":..., "output":...}, ...]}
    """
    soup = BeautifulSoup(html_text, "html.parser")
    ps = soup.select_one("div.problem-statement")

    samples = []
    statement_html = ""

    if ps:
        statement_html = str(ps)

        samp_div = ps.select_one("div.sample-tests") or ps.select_one("div.sample-test")
        if samp_div:
            inputs = samp_div.select("div.input pre")
            outputs = samp_div.select("div.output pre")
            for i_idx in range(min(len(inputs), len(outputs))):
                inp = inputs[i_idx].get_text("\n", strip=False)
                out = outputs[i_idx].get_text("\n", strip=False)
                samples.append({"input": unescape(inp), "output": unescape(out)})

    if statement_html:
        statement_soup = BeautifulSoup(statement_html, "html.parser")
        for tag in statement_soup(["script", "style"]):
            tag.decompose()

        if HAVE_HTML2TEXT:
            h = html2text.HTML2Text()
            h.body_width = 0
            md = h.handle(str(statement_soup))
        else:
            md = statement_soup.get_text("\n", strip=True)

        md = re.sub(r'\n\s*\n+', '\n\n', md).strip()
    else:
        md = ""

    return {"statement_md": md, "visible_examples": samples}

def select_problems(problems, min_rating, max_rating, tags=None, limit=None):
    selected = []
    for p in problems:
        r = p.get("rating")
        if r is None:
            continue
        if r < min_rating or r > max_rating:
            continue
        if tags:
            if not set(tags).intersection(set(p.get("tags", []))):
                continue
        selected.append(p)
        if limit and len(selected) >= limit:
            break
    return selected

def main(args):
    print("Fetching problem metadata from Codeforces API...")
    problems, stats = api_problemset_problems(tags=None)
    print(f"Total problems from API: {len(problems)}")

    tags = args.tags.split(",") if args.tags else None
    sel = select_problems(problems, args.min_rating, args.max_rating, tags=tags, limit=args.max_problems)
    print(f"Selected {len(sel)} problems (rating {args.min_rating}-{args.max_rating})")

    dataset = []
    failed_fetches = []

    for p in tqdm(sel, desc="Processing problems"):
        pid = f"{p.get('contestId','')}{p['index']}"
        url = build_problem_url(p)
        problem_obj = {
            "id": pid,
            "contestId": p.get("contestId"),
            "index": p.get("index"),
            "title": p.get("name"),
            "cf_rating": p.get("rating"),
            "tags": p.get("tags", []),
            "url": url,
            "difficulty_bucket": rating_to_bucket(p.get("rating")),
            "statement_markdown": None,
            "visible_examples": [],
            "source": "codeforces",
            "notes": {"generator_placeholder": None, "reference_solution": None}
        }

        if args.fetch_pages:
            safe_fn = f"problem_{pid}.html".replace("/", "_")
            cache_path = CACHE_DIR / safe_fn
            try:
                html_text = fetch_and_cache(
                    url,
                    cache_path,
                    sleep_base=args.rate,
                    max_retries=args.max_retries,
                    use_cloudscraper=args.use_cloudscraper
                )
                parsed = parse_problem_page(html_text)
                problem_obj["statement_markdown"] = parsed["statement_md"]
                problem_obj["visible_examples"] = parsed["visible_examples"]
            except Exception as e:
                err = str(e)
                problem_obj["notes"]["page_fetch_error"] = err
                failed_fetches.append({"id": pid, "url": url, "error": err})

        dataset.append(problem_obj)

    outp = Path(args.out)
    outp.write_text(json.dumps(dataset, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(dataset)} problems to {outp.resolve()}")

    if failed_fetches:
        print(f"\n{len(failed_fetches)} page fetches failed. See 'failed_fetches.json' for details.")
        Path("failed_fetches.json").write_text(json.dumps(failed_fetches, indent=2, ensure_ascii=False), encoding="utf-8")
        print("You can re-run the script to retry only the failed items (cache will be used for successful ones).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="dataset.json")
    parser.add_argument("--max-problems", type=int, default=200)
    parser.add_argument("--min-rating", type=int, default=900)
    parser.add_argument("--max-rating", type=int, default=1800)
    parser.add_argument("--tags", default="")  # comma-separated
    parser.add_argument("--fetch-pages", action="store_true", help="Fetch problem pages and parse statements/samples")
    parser.add_argument("--rate", type=float, default=1.5, help="base seconds to sleep between page fetches (randomized)")
    parser.add_argument("--max-retries", type=int, default=3, help="number of retries for each page fetch")
    parser.add_argument("--use-cloudscraper", action="store_true", help="use cloudscraper as fallback for 403 responses (requires cloudscraper installed)")
    args = parser.parse_args()
    main(args)
