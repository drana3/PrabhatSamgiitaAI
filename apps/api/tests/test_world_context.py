from app.services.world_context import (
    NDMA_SACHET_URL,
    english_disaster_fallback,
    extract_english_cap_headline,
    needs_english_headline,
    parse_india_disaster_alerts,
)


def test_india_alert_feed_prioritizes_disasters_and_skips_routine_weather() -> None:
    payload = """<?xml version="1.0"?><rss><channel>
      <item><title>River Ganga is in above normal flood situation in Bihar.</title>
        <link>https://sachet.ndma.gov.in/alert/1</link></item>
      <item><title>Light rain is likely in parts of Delhi.</title>
        <link>https://sachet.ndma.gov.in/alert/2</link></item>
      <item><title>Earthquake alert for a district in Assam.</title>
        <link>https://sachet.ndma.gov.in/alert/3</link></item>
    </channel></rss>"""

    signals = parse_india_disaster_alerts(payload)

    assert [signal.category for signal in signals] == ["disaster", "disaster"]
    assert all(signal.source_name == "NDMA SACHET" for signal in signals)
    assert all("Delhi" not in signal.title for signal in signals)


def test_humanitarian_signals_use_public_ndma_homepage() -> None:
    payload = """<?xml version="1.0"?><rss><channel>
      <item><title>Severe flood alert in Kerala.</title>
        <link>https://sachet.ndma.gov.in/cap_public_website/FetchXMLFile?identifier=1785672086661008</link></item>
    </channel></rss>"""

    signals = parse_india_disaster_alerts(payload)

    assert signals[0].source_url.endswith("FetchXMLFile?identifier=1785672086661008")
    assert NDMA_SACHET_URL == "https://sachet.ndma.gov.in/"


def test_multilingual_alert_uses_authoritative_english_cap_headline() -> None:
    malayalam = (
        "പത്തനംതിട്ട ജില്ലയിൽ മലക്കരയിലെ പമ്പാ നദി അതിരൂക്ഷ വെള്ളപ്പൊക്ക "
        "(Severe Flood) സാധ്യത നിലയിൽ ഒഴുകുന്നു."
    )
    cap = """<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
      <cap:info><cap:language>en-IN</cap:language>
        <cap:headline>River Pamba at Malakkara in Pathanamthitta district of Kerala
        continues to flow in severe flood situation.</cap:headline></cap:info>
      <cap:info><cap:language>ML</cap:language>
        <cap:headline>പ്രാദേശിക മുന്നറിയിപ്പ്</cap:headline></cap:info>
    </cap:alert>"""

    assert needs_english_headline(malayalam) is True
    assert extract_english_cap_headline(cap) == (
        "River Pamba at Malakkara in Pathanamthitta district of Kerala "
        "continues to flow in severe flood situation."
    )
    assert english_disaster_fallback(malayalam) == "Severe Flood alert in India"
