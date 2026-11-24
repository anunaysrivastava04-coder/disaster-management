"""
India Disaster & Weather Tracker - Backend
Uses only free, no-API-key-required public data sources:
  - Open-Meteo (weather + geocoding)       https://open-meteo.com
  - NASA EONET (live natural event feed)   https://eonet.gsfc.nasa.gov
  - GDACS RSS (global disaster alerts)     https://www.gdacs.org
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import requests
import feedparser
import os

app = FastAPI(title="India Disaster & Weather Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rough bounding box for India, used to filter global disaster feeds
INDIA_BBOX = {"min_lat": 6.0, "max_lat": 38.0, "min_lon": 68.0, "max_lon": 98.0}

WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall", 77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
}
FOG_CODES = {45, 48}
THUNDER_CODES = {95, 96, 99}
HEAVY_RAIN_CODES = {65, 67, 82, 99}


@app.get("/api/geocode")
def geocode(q: str):
    """Search for a place name -> list of matching locations (India preferred)."""
    try:
        r = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": q, "count": 10, "language": "en", "format": "json"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json().get("results", []) or []
    except Exception:
        data = []
    india = [d for d in data if d.get("country_code") == "IN"]
    return {"results": india or data}


@app.get("/api/weather")
def weather(lat: float, lon: float):
    """Current conditions + hourly (48h) + 7-day forecast for a coordinate."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,"
                   "precipitation,weathercode,windspeed_10m,surface_pressure",
        "hourly": "temperature_2m,precipitation_probability,weathercode,relative_humidity_2m",
        "daily": "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,"
                 "precipitation_probability_max,windspeed_10m_max",
        "timezone": "auto",
        "forecast_days": 7,
    }
    r = requests.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=15)
    r.raise_for_status()
    data = r.json()

    code = data.get("current", {}).get("weathercode")
    data["current"]["description"] = WEATHER_CODES.get(code, "Unknown")
    data["alert_flags"] = {
        "fog": code in FOG_CODES,
        "thunderstorm": code in THUNDER_CODES,
        "heavy_rain": code in HEAVY_RAIN_CODES,
    }

    daily_precip = data.get("daily", {}).get("precipitation_sum", []) or []
    top3 = [p for p in daily_precip[:3] if p is not None]
    peak = max(top3) if top3 else 0
    # Heuristic only (no slope/soil data available for free) - clearly labelled in UI
    if peak > 100:
        risk = "high"
    elif peak > 50:
        risk = "moderate"
    else:
        risk = "low"
    data["landslide_risk_heuristic"] = risk
    return data


@app.get("/api/disasters")
def disasters():
    """Merge live NASA EONET events (India bbox) with India-relevant GDACS alerts."""
    events = []

    try:
        r = requests.get(
            "https://eonet.gsfc.nasa.gov/api/v3/events",
            params={"status": "open", "days": 60, "limit": 150},
            timeout=15,
        )
        r.raise_for_status()
        for ev in r.json().get("events", []):
            for geo in ev.get("geometry", []):
                coords = geo.get("coordinates")
                if not coords or len(coords) < 2:
                    continue
                lon, lat = coords[0], coords[1]
                if (INDIA_BBOX["min_lat"] <= lat <= INDIA_BBOX["max_lat"]
                        and INDIA_BBOX["min_lon"] <= lon <= INDIA_BBOX["max_lon"]):
                    cats = ev.get("categories", [{}])
                    srcs = ev.get("sources", [{}])
                    events.append({
                        "source": "NASA EONET",
                        "title": ev.get("title"),
                        "category": cats[0].get("title", "Event") if cats else "Event",
                        "lat": lat,
                        "lon": lon,
                        "date": geo.get("date"),
                        "link": srcs[0].get("url", "") if srcs else "",
                    })
    except Exception:
        pass

    try:
        feed = feedparser.parse("https://www.gdacs.org/xml/rss.xml")
        for entry in feed.entries:
            try:
                title = entry.get("title", "") or ""
                summary = entry.get("summary", "") or ""
                if "india" not in (title + summary).lower():
                    continue
                lat = float(entry.get("geo_lat", 0) or 0)
                lon = float(entry.get("geo_long", 0) or 0)
                events.append({
                    "source": "GDACS",
                    "title": title,
                    "category": entry.get("gdacs_eventtype", "Disaster Alert"),
                    "lat": lat,
                    "lon": lon,
                    "date": entry.get("published", ""),
                    "link": entry.get("link", ""),
                })
            except Exception:
                continue
    except Exception:
        pass

    return {"count": len(events), "events": events}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the frontend (must be registered last so /api/* routes above take priority)
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
