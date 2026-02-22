import bs4
import aiohttp
import asyncio
from typing import Optional

DEFAULT_HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64)'}
LINK_PREFIX = "https://dictionary.cambridge.org"


def parse_audio_links(header_block: Optional[bs4.Tag]) -> tuple[list[str], list[str]]:
    uk_audio_links: list[str] = []
    us_audio_links: list[str] = []

    if header_block is None:
        return uk_audio_links, us_audio_links

    for daud in header_block.find_all("span", {"class": "daud"}):
        parent_class = [item.lower() for item in daud.parent.get("class", [])]
        audio_source = daud.find("source")
        if audio_source is None:
            continue
        src = audio_source.get("src")
        if not src:
            continue
        link = f"{LINK_PREFIX}/{src}"
        if "uk" in parent_class:
            uk_audio_links.append(link)
        elif "us" in parent_class:
            us_audio_links.append(link)

    return uk_audio_links, us_audio_links


async def get_word_audio(
    word: str,
    session: aiohttp.ClientSession,
    timeout: float = 5.0
) -> dict[str, list[str]]:
    url = f"{LINK_PREFIX}/dictionary/english/{word}"
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
        content = await response.read()

    soup = bs4.BeautifulSoup(content, "html.parser")

    uk_links: list[str] = []
    us_links: list[str] = []

    for entry in soup.find_all("div", {"class": lambda x: x and "entry-body__el" in x}):
        header_block = entry.find("div", {"class": "dpos-h"})
        uk, us = parse_audio_links(header_block)
        uk_links.extend(uk)
        us_links.extend(us)

    return {
        "word": word,
        "uk": list(dict.fromkeys(uk_links)),
        "us": list(dict.fromkeys(us_links)),
    }


async def main():
    from pprint import pprint
    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        result = await get_word_audio("hard", session)
        pprint(result)


if __name__ == "__main__":
    asyncio.run(main())