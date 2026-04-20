// Open-Meteo data layer with realistic fallback for Charleston, SC
// Charleston coords: 32.7765° N, 79.9311° W

const CHARLESTON = { lat: 32.7765, lon: -79.9311 };
const FORECAST_DAYS = 14;

// Map UV -> color + level
function uvColor(uv) {
  if (uv < 1) return { c: '#4fb8a8', level: 'Minimal',    idx: 0 };
  if (uv < 3) return { c: '#8fc96a', level: 'Low',        idx: 1 };
  if (uv < 6) return { c: '#e6c94a', level: 'Moderate',   idx: 2 };
  if (uv < 8) return { c: '#f08a3a', level: 'High',       idx: 3 };
  if (uv < 11) return { c: '#e64b3c', level: 'Very High', idx: 4 };
  return { c: '#8e3aa8', level: 'Extreme', idx: 5 };
}

function uvInterpColor(uv) {
  // Smooth gradient color
  const stops = [
    [0, [79, 184, 168]],
    [1, [143, 201, 106]],
    [3, [230, 201, 74]],
    [6, [240, 138, 58]],
    [8, [230, 75, 60]],
    [11, [142, 58, 168]],
    [13, [90, 30, 130]]
  ];
  if (uv <= 0) return `rgb(${stops[0][1].join(',')})`;
  for (let i = 0; i < stops.length - 1; i++) {
    const [u0, c0] = stops[i], [u1, c1] = stops[i+1];
    if (uv >= u0 && uv <= u1) {
      const t = (uv - u0) / (u1 - u0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
      return `rgb(${r},${g},${b})`;
    }
  }
  return `rgb(${stops[stops.length-1][1].join(',')})`;
}

// Realistic simulated 24h UV for Charleston in late spring
function simulated24h() {
  // Bell curve peaking at solar noon (~13:15 EDT) with peak ~9.5
  const peak = 9.2;
  const noon = 13.2;
  const sunrise = 6.5;
  const sunset = 19.75;
  const arr = [];
  for (let h = 0; h < 24; h++) {
    if (h < sunrise || h > sunset) {
      arr.push(0);
      continue;
    }
    // Cosine-shaped window between sunrise and sunset
    const phase = (h - noon) / (sunset - sunrise) * Math.PI;
    const v = peak * Math.pow(Math.cos(phase), 2.2);
    arr.push(Math.max(0, v));
  }
  return arr.map(v => Math.round(v * 10) / 10);
}

function simulatedOutlook(days = FORECAST_DAYS) {
  const baseline = [8.5, 9.1, 9.4, 8.8, 7.2, 9.6, 9.9];
  return Array.from({ length: days }, (_, i) => {
    const base = baseline[i % baseline.length];
    const drift = Math.sin(i * 0.65) * 0.45 + (i >= 7 ? -0.2 : 0);
    return Math.max(0, Math.round((base + drift) * 10) / 10);
  });
}

async function fetchUVData() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CHARLESTON.lat}&longitude=${CHARLESTON.lon}&hourly=uv_index,cloud_cover&daily=uv_index_max,sunrise,sunset&timezone=America%2FNew_York&forecast_days=${FORECAST_DAYS}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API failed');
    const json = await res.json();

    const now = new Date();
    const nowStr = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const times = json.hourly.time;
    const uvs = json.hourly.uv_index;
    const clouds = json.hourly.cloud_cover;

    // Find index matching current hour
    const nowIdx = times.findIndex(t => t.startsWith(nowStr));
    const today = nowIdx >= 0 ? Math.floor(nowIdx / 24) * 24 : 0;
    const hourly = uvs.slice(today, today + 24).map(v => Math.max(0, Math.round(v * 10) / 10));
    const cloudToday = clouds.slice(today, today + 24);

    // Sun times
    const sunrise = json.daily.sunrise[0];
    const sunset = json.daily.sunset[0];

    return {
      live: true,
      hourly,
      cloud: cloudToday,
      currentIdx: nowIdx >= 0 ? nowIdx - today : now.getHours(),
      sunrise: new Date(sunrise),
      sunset: new Date(sunset),
      week: json.daily.uv_index_max.slice(0, FORECAST_DAYS).map(v => Math.round(v * 10) / 10),
      weekDates: json.daily.sunrise.map(s => new Date(s)),
    };
  } catch (e) {
    console.warn('Using simulated data:', e.message);
    const hourly = simulated24h();
    const now = new Date();
    const today0 = new Date(now);
    today0.setHours(0, 0, 0, 0);
    return {
      live: false,
      hourly,
      cloud: hourly.map((_, h) => Math.round(20 + 30 * Math.sin(h / 3))),
      currentIdx: now.getHours() + now.getMinutes() / 60,
      sunrise: new Date(today0.getTime() + 6.5 * 3600 * 1000),
      sunset: new Date(today0.getTime() + 19.75 * 3600 * 1000),
      week: simulatedOutlook(),
      weekDates: Array.from({length: FORECAST_DAYS}, (_, i) => {
        const d = new Date(today0); d.setDate(d.getDate() + i); return d;
      }),
    };
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function findBestTimes(hourly, sunrise, sunset) {
  // Vitamin D window: UV 3-7, any time
  // Safe tan: UV 3-5 only
  // Burn zone: UV 8+
  const vitdStart = hourly.findIndex(v => v >= 3);
  const vitdEnd = hourly.length - 1 - [...hourly].reverse().findIndex(v => v >= 3);
  const safeTan = hourly.map((v, i) => ({ v, i })).filter(x => x.v >= 3 && x.v < 6);
  const burnStart = hourly.findIndex(v => v >= 8);
  const burnEnd = hourly.length - 1 - [...hourly].reverse().findIndex(v => v >= 8);
  const peakIdx = hourly.indexOf(Math.max(...hourly));

  const hToTime = h => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hh = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    return `${hh}:00 ${suffix}`;
  };

  return {
    vitaminD: vitdStart >= 0 ? `${hToTime(vitdStart)} – ${hToTime(vitdEnd + 1)}` : 'Limited',
    safeTan: safeTan.length ? `${hToTime(safeTan[0].i)} – ${hToTime(safeTan[safeTan.length-1].i + 1)}` : 'None today',
    avoidWindow: burnStart >= 0 ? `${hToTime(burnStart)} – ${hToTime(burnEnd + 1)}` : 'None',
    peak: `${hToTime(peakIdx)}`,
    peakValue: hourly[peakIdx],
  };
}

// Time to burn (minutes) for avg skin type III at given UV
function timeToBurn(uv) {
  if (uv < 1) return Infinity;
  return Math.round(200 / uv);
}

// Sunscreen reapply cadence
function reapplyMinutes(uv) {
  if (uv < 3) return 120;
  if (uv < 6) return 90;
  if (uv < 8) return 80;
  return 60;
}

Object.assign(window, {
  fetchUVData, uvColor, uvInterpColor, formatTime, findBestTimes,
  timeToBurn, reapplyMinutes, simulated24h, simulatedOutlook, CHARLESTON, FORECAST_DAYS
});
