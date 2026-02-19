#!/usr/bin/env python3
import sys
import requests
from pathlib import Path

try:
    import cloudscraper
    HAVE_CLOUDSCRAPER = True
except Exception:
    HAVE_CLOUDSCRAPER = False

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

def print_resp_info(source, resp):
    code = getattr(resp, "status_code", None)
    print(f"--- {source} status: {code}")
    headers = getattr(resp, "headers", {})
    print("Headers (partial):")
    for k in ["server","content-type","cf-ray","set-cookie"]:
        if k in headers:
            print(f"  {k}: {headers[k]}")
    txt = getattr(resp, "text", "")[:800]
    print("\nFirst 800 chars of body:\n")
    print(txt)
    print("\n" + ("-"*60) + "\n")

def fetch_with_requests(url):
    s = requests.Session()
    s.headers.update(HEADERS)
    try:
        r = s.get(url, timeout=15)
        return r
    except Exception as e:
        print("requests error:", e)
        return None

def fetch_with_cloudscraper(url):
    if not HAVE_CLOUDSCRAPER:
        print("cloudscraper not installed.")
        return None
    try:
        scr = cloudscraper.create_scraper()
        r = scr.get(url, timeout=30)
        return r
    except Exception as e:
        print("cloudscraper error:", e)
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_fetch_debug.py <url>")
        sys.exit(1)

    url = sys.argv[1]
    print("Testing URL:", url)
    r1 = fetch_with_requests(url)
    if r1 is not None:
        print_resp_info("requests", r1)

    if HAVE_CLOUDSCRAPER:
        r2 = fetch_with_cloudscraper(url)
        if r2 is not None:
            print_resp_info("cloudscraper", r2)
    else:
        print("Install cloudscraper: pip install cloudscraper and retry for deeper test.")
