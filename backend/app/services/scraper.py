"""Step 1 — fetch KSRM web pages and turn them into clean plain text (plus the page title)."""
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

import requests
import urllib3
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_NOISE_TAGS = ["script", "style", "nav", "footer", "header"]
_MENU_MARKER = "Apply Now"  # the site's repeated top menu ends with this button
_ALLOWED_CHARS = re.compile(r"[^\w\s.,;:!?()\-+%&@₹/]")
_WHITESPACE = re.compile(r"\s+")
_TITLE_SEPARATORS = re.compile(r"\s+[|–—-]\s+")


@dataclass
class Page:
    url: str
    title: str
    text: str


def title_from_url(url: str) -> str:
    """Readable fallback title: 'https://x/academics/courses-intake/' -> 'Courses Intake'."""
    path = urlparse(url).path.strip("/")
    return path.split("/")[-1].replace("-", " ").title() if path else "Home"


def _page_title(soup: BeautifulSoup, url: str) -> str:
    raw = soup.title.get_text(strip=True) if soup.title else ""
    # "Courses & Intake | K.S.R.M. College of Engineering" -> "Courses & Intake"
    title = _TITLE_SEPARATORS.split(raw)[0].strip() if raw else ""
    return title or title_from_url(url)


def scrape_page(url: str, verify_ssl: bool, timeout: int) -> Page:
    response = requests.get(url, verify=verify_ssl, timeout=timeout)
    response.raise_for_status()
    response.encoding = "utf-8"  # avoids mojibake like 'â' / 'ð'
    soup = BeautifulSoup(response.text, "html.parser")
    title = _page_title(soup, url)

    for tag in soup(_NOISE_TAGS):
        tag.decompose()

    text = soup.get_text(separator="\n")
    if _MENU_MARKER in text:
        text = text.split(_MENU_MARKER, 1)[-1]
    return Page(url=url, title=title, text=text)


def scrape_pages(urls: list[str], verify_ssl: bool = False, timeout: int = 15) -> list[Page]:
    """Fetch every page that can be reached; failures are logged and skipped."""
    if not verify_ssl:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    pages: list[Page] = []
    for url in urls:
        try:
            pages.append(scrape_page(url, verify_ssl, timeout))
        except requests.RequestException as exc:
            logger.warning("Skipped %s: %s", url, exc)
    return pages


def clean_text(text: str) -> str:
    """Strip unusual symbols and collapse whitespace."""
    text = _ALLOWED_CHARS.sub("", text)
    return _WHITESPACE.sub(" ", text).strip()
