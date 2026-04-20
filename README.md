# UV App

`UV App` is a static UV index web app for Charleston, SC. It combines a stylized UV wheel, hourly forecast views, sun-path context, cloud cover, tanning guidance, and a 14-day outlook using live Open-Meteo data with a simulated fallback when the API is unavailable.

## Highlights

- Live UV, cloud cover, sunrise, sunset, and daily UV max data from Open-Meteo
- Interactive UV wheel with sunrise and sunset markers
- Hourly UV and cloud-cover visualization
- Conditions, sun path, and tanning-support guidance
- 14-day outlook
- No build step required for deployment

## Project Tree

```text
UV-App/
├── README.md
├── DEPLOYMENT.md
├── index.html
├── Solace UV.html
├── app.jsx
├── data.jsx
├── icons.jsx
├── panels.jsx
├── styles.css
├── wheel.jsx
└── check2.png
```

## File Roles

- `index.html`
  Deployment-friendly entrypoint for static hosts.
- `Solace UV.html`
  Self-contained version of the app with inline styles and scripts.
- `app.jsx`
  Main application shell and layout composition.
- `data.jsx`
  Data fetching, fallback logic, formatting helpers, and UV utility functions.
- `icons.jsx`
  Shared SVG icon set.
- `panels.jsx`
  Forecast, conditions, tanning, vitamin D, and supporting panels.
- `wheel.jsx`
  Interactive UV wheel and sunrise/sunset marker logic.
- `styles.css`
  Shared design system and layout styling.
- `check2.png`
  Static image asset included with the project.

## Runtime Data Structure

The app normalizes the fetched forecast into this structure:

```text
data
├── live: boolean
├── hourly: number[24]
├── cloud: number[24]
├── currentIdx: number
├── sunrise: Date
├── sunset: Date
├── week: number[14]
└── weekDates: Date[14]
```

### Source Notes

- `hourly`
  Current-day UV values, one per hour.
- `cloud`
  Current-day cloud-cover values, one per hour.
- `week`
  14-day UV max outlook.
- `weekDates`
  Dates aligned to the 14-day outlook.

## Data Flow

```text
Open-Meteo API
└── fetchUVData()
    ├── normalize current-day hourly UV
    ├── normalize current-day cloud cover
    ├── parse sunrise / sunset
    └── build 14-day outlook

Fallback path
└── simulated24h() + simulatedOutlook()
```

## Local Usage

### Option 1: Open directly

Open `index.html` or `Solace UV.html` in a browser.

### Option 2: Serve locally

Any static server works. For example:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for hosting instructions.
