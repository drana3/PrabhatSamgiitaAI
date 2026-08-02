from app.services.world_context import parse_india_disaster_alerts


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
