# India Disaster & Weather Tracker

A free, self-hosted web app that tracks live weather and natural-disaster events
across India — with saved locations, search history, 20 languages, and a
light/dark theme. Runs on your own machine with one double-click, no paid
API keys required.

## Features

- **Live weather** — current conditions, 24-hour hourly strip, and a 7-day
  forecast for any place in India (or anywhere), via [Open-Meteo](https://open-meteo.com).
- **Condition alerts** — fog, thunderstorm, and heavy-rain flags derived from
  the live forecast.
- **Landslide risk indicator** — a simple *rainfall-based heuristic*
  (low / moderate / high) from forecast rainfall totals. This is **not** an
  official landslide warning — see Limitations below.
- **Live disaster map** — active natural-event markers over India (storms,
  wildfires, floods, volcanoes, etc.) from NASA EONET and GDACS, shown on an
  OpenStreetMap/Leaflet map.
- **Save locations & search history** — stored locally in your browser
  (`localStorage`), no account needed.
- **Settings** — light/dark theme, default location, and **20 languages**
  (10 Indian: Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada,
  Malayalam, Punjabi, Urdu — and 10 international: English, Spanish, French,
  German, Chinese, Arabic, Russian, Portuguese, Japanese, Korean).

## What this is (honestly) and isn't

This app is built entirely from **free, public, no-signup-required** data
sources, which is what makes a ready-to-run free zip possible:

| Purpose | Source used here |
|---|---|
| Weather & forecast | Open-Meteo (free, no key) |
| Place search | Open-Meteo Geocoding (free, no key) |
| Disaster events | NASA EONET + GDACS RSS (free, no key) |
| Map tiles | OpenStreetMap via Leaflet (free) |

The research stack you may have seen referenced elsewhere — MOSDAC/INSAT-3D
satellite imagery, IMD Doppler radar, ERA5/IMDAA reanalysis, PostGIS,
custom-trained ConvLSTM/U-Net/GNN nowcasting models, Firebase/Twilio SMS
alerting — is a genuine large-scale research/production system. It needs
institutional data-access agreements, GPU training infrastructure, and paid
cloud/SMS services, so it can't honestly be delivered as a free local zip
file. This app gives you a **real, working** weather + disaster tracker today;
the "Extending this project" section below points to where each of those
upgrades would plug in if you want to grow it later.

**This app is not an official government alert system.** For official
warnings always check IMD (mausam.imd.gov.in) and your state disaster
management authority.

## Requirements

- Python 3.9 or newer ([python.org/downloads](https://www.python.org/downloads/))
- An internet connection (the app calls free public APIs live)
- Windows, macOS, or Linux

## Quick start

**Windows:** double-click `start.bat`.
**macOS/Linux:** open a terminal in this folder and run `./start.sh`
(first time: `chmod +x start.sh`).

Either script creates a virtual environment, installs the few required
packages, starts the server, and opens `http://localhost:8000` in your
browser automatically. Leave the window open while you use the app; press
`Ctrl+C` in it to stop the server.

### Manual start (any OS)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

Then open `http://localhost:8000` in your browser.

## Project structure

```
disaster-weather-tracker/
├── backend/
│   ├── app.py            # FastAPI server: weather/geocode/disaster proxy + static hosting
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       └── translations.js   # 20-language UI strings
├── start.bat              # Windows one-click launcher
├── start.sh               # macOS/Linux launcher
├── .gitignore
└── README.md
```

## Uploading to GitHub

```bash
cd disaster-weather-tracker
git init
git add .
git commit -m "Initial commit: India disaster & weather tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`venv/` and cache files are already excluded via `.gitignore`, so the repo
stays clean. Anyone who clones it can run `start.bat` / `start.sh` the same
way you did.

## Troubleshooting

- **"Python was not found"** — install Python and make sure "Add to PATH"
  is checked during setup, then re-run the start script.
- **Blank weather/disaster data** — check your internet connection; the app
  needs to reach `api.open-meteo.com`, `eonet.gsfc.nasa.gov`, and
  `gdacs.org`. Corporate/school networks sometimes block these.
- **Port 8000 already in use** — edit the port number in `start.bat`/
  `start.sh` and the `uvicorn` command (e.g. `--port 8001`).
- **Map not showing** — it needs the same internet connection, since map
  tiles come from OpenStreetMap.

## Extending this project

- Swap the landslide heuristic for a real model trained on IMDAA/ERA5
  reanalysis + SRTM terrain slope data.
- Add IMD Doppler radar reflectivity once you have institutional API access.
- Add push/SMS alerts via Firebase Cloud Messaging or Twilio (both have
  free tiers to start).
- Add a FastAPI + PostGIS layer if you want to store and query affected
  population polygons rather than point events.

## License

Free to use, modify, and redistribute for personal or educational purposes.
