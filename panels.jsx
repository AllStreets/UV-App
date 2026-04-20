const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM } = React;

/* ============ SKIN TYPES — Fitzpatrick I-VI ============ */
const SKIN_TYPES = [
  { id: 1, label: 'I',   swatch: '#f5d5b8', burnMult: 2.5,  desc: 'Always burns' },
  { id: 2, label: 'II',  swatch: '#e8c090', burnMult: 2.0,  desc: 'Burns easily' },
  { id: 3, label: 'III', swatch: '#c8945a', burnMult: 1.5,  desc: 'Sometimes burns' },
  { id: 4, label: 'IV',  swatch: '#a06835', burnMult: 1.0,  desc: 'Rarely burns' },
  { id: 5, label: 'V',   swatch: '#704020', burnMult: 0.7,  desc: 'Very rarely burns' },
  { id: 6, label: 'VI',  swatch: '#3a1a08', burnMult: 0.5,  desc: 'Never burns' },
];

/* Base MED (Minimal Erythemal Dose) exposure in minutes at UV=1 */
const BASE_MIN_AT_UV1 = 600; // skin type III baseline

function burnMinutes(uv, skinType) {
  if (uv < 0.5) return Infinity;
  const st = SKIN_TYPES.find(s => s.id === skinType) || SKIN_TYPES[2];
  return Math.round((BASE_MIN_AT_UV1 / st.burnMult) / uv);
}

function reapplyMinutes(uv) {
  if (uv < 3)  return 120;
  if (uv < 6)  return 90;
  if (uv < 8)  return 80;
  if (uv < 11) return 60;
  return 40;
}

function spfRec(uv) {
  if (uv < 3)  return 15;
  if (uv < 6)  return 30;
  if (uv < 8)  return 30;
  return 50;
}

/* UV Tanning Score (0-100): rewards moderate UV in sweet-spot window, penalizes extremes */
function tanningScore(uv, envMult) {
  const adjUV = uv * envMult;
  if (adjUV < 1)  return 0;
  if (adjUV < 3)  return Math.round(adjUV / 3 * 35);
  if (adjUV < 6)  return Math.round(35 + (adjUV - 3) / 3 * 55); // 35→90
  if (adjUV < 8)  return Math.round(90 - (adjUV - 6) / 2 * 20); // 90→70
  if (adjUV < 11) return Math.round(70 - (adjUV - 8) / 3 * 40); // 70→30
  return Math.max(0, Math.round(30 - (adjUV - 11) * 10));
}

function scoreLabel(score) {
  if (score < 20) return ['Minimal', '#4cb8a4'];
  if (score < 40) return ['Building', '#86c55e'];
  if (score < 65) return ['Good', '#e4c53e'];
  if (score < 80) return ['Excellent', '#f08030'];
  if (score < 92) return ['Peak', '#e04040'];
  return ['Intense', '#8e32a8'];
}

/* Smart advisory text */
function smartAdvice(uv, skinType, envMult) {
  const adjUV = uv * envMult;
  const burn = burnMinutes(uv, skinType);
  const { level } = uvColor(adjUV);
  if (adjUV < 1)  return { head: 'No UV — sun is below the horizon.', body: 'Enjoy the evening. UV returns near sunrise tomorrow.' };
  if (adjUV < 3)  return { head: 'Light UV — gentle exposure.',        body: `You can stay out comfortably. Burns take over ${burn} min for skin type ${skinType}.` };
  if (adjUV < 6)  return { head: 'Moderate UV — ideal tanning window.', body: `SPF 30 recommended. Safe tanning for up to ${burn} min unprotected for skin type ${skinType}.` };
  if (adjUV < 8)  return { head: 'High UV — protect between sessions.', body: `Reapply sunscreen every ${reapplyMinutes(adjUV)} min. Burns possible in ${burn} min.` };
  if (adjUV < 11) return { head: 'Very high — minimize direct exposure.', body: `Seek shade during peak hours. Burns in as little as ${burn} min. SPF 50 required.` };
  return { head: 'Extreme UV — cover up completely.', body: `Unprotected skin burns in under ${burn} min. SPF 50+, hat, full coverage essential.` };
}

/* ============ SKIN TYPE SELECTOR ============ */
function SkinTypeSelector({ skinType, onChange }) {
  return (
    <div>
      <div className="card-label"><IconEye size={12} />Skin Type — Fitzpatrick Scale</div>
      <div className="skin-types">
        {SKIN_TYPES.map(st => (
          <button key={st.id} className={`skin-type ${skinType === st.id ? 'active' : ''}`} onClick={() => onChange(st.id)}>
            <div className="swatch" style={{ background: st.swatch, border: '1px solid var(--line)' }} />
            <div className="st-label">Type {st.label}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
        {SKIN_TYPES.find(s => s.id === skinType)?.desc} — personalizes burn estimates below
      </div>
    </div>
  );
}

/* ============ BURN TIMER ============ */
function BurnTimer({ uv, skinType, startTime }) {
  const [elapsed, setElapsed] = useS(0);
  const [running, setRunning] = useS(false);
  const intervalRef = useR(null);

  const burnMin = burnMinutes(uv, skinType);
  const safeMin = isFinite(burnMin) ? burnMin : 999;
  const pct = isFinite(burnMin) ? Math.min(1, elapsed / safeMin) : 0;
  const remaining = Math.max(0, safeMin - elapsed);

  useE(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1/60), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  function reset() { setElapsed(0); setRunning(false); }

  const fillColor = pct < 0.5 ? '#86c55e' : pct < 0.75 ? '#e4c53e' : pct < 0.9 ? '#f08030' : '#e04040';

  return (
    <div>
      <div className="card-label"><IconClock size={12} />Burn Timer</div>
      <div className="burn-timer">
        <div className="timer-num serif">
          {isFinite(burnMin) ? (
            running ? `${Math.floor(remaining)}'` : `${burnMin}'`
          ) : '∞'}
        </div>
        <div className="timer-label">
          {running ? `${Math.floor(elapsed)} min elapsed · ${Math.ceil(remaining)} min remaining` : `minutes until burn · skin type ${skinType}`}
        </div>
        <div className="timer-bar">
          <div className="timer-fill" style={{ width: `${pct * 100}%`, background: fillColor }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => setRunning(r => !r)} style={{
          flex: 1, padding: '10px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)',
          background: running ? 'var(--ink)' : 'transparent', color: running ? 'var(--sand-50)' : 'var(--ink)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em',
          textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.18s ease'
        }}>
          {running ? 'Pause' : 'Start Timer'}
        </button>
        <button onClick={reset} style={{
          padding: '10px 16px', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-sm)',
          background: 'transparent', color: 'var(--ink-3)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.18s ease'
        }}>
          Reset
        </button>
      </div>
    </div>
  );
}

/* ============ UV TANNING SCORE ============ */
function TanningScore({ uv, envMult }) {
  const score = tanningScore(uv, envMult);
  const [label, color] = scoreLabel(score);
  const r = 46, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="score-wrap">
      <div className="card-label" style={{ marginBottom: 0 }}><IconSparkle size={12} />Tan Quality Score</div>
      <div className="score-ring" style={{ marginTop: 14 }}>
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sand-100)" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={color}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1), stroke 0.6s ease' }} />
        </svg>
        <div className="score-num">
          <div className="n serif" style={{ color }}>{score}</div>
          <div className="of mono">/ 100</div>
        </div>
      </div>
      <div className="score-label serif" style={{ color }}>{label}</div>
      <div className="score-desc">{score >= 60 ? 'Good tanning conditions' : score >= 30 ? 'Moderate opportunity' : 'Limited UV benefit'}</div>
    </div>
  );
}

/* ============ SUN ARC ============ */
function SunArc({ sunrise, sunset, now }) {
  const w = 340, h = 120;
  const sx = 24, ex = w - 24, baseY = h - 14, peakY = 22;
  const total = sunset - sunrise;
  const progress = Math.max(0, Math.min(1, (now - sunrise) / total));
  const path = `M ${sx} ${baseY} Q ${w/2} ${peakY} ${ex} ${baseY}`;
  const t = progress;
  const sunX = sx + (ex - sx) * t;
  const sunY = baseY + (peakY - baseY) * 4 * t * (1 - t);

  return (
    <div className="sun-arc">
      <svg viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id="arcg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="sunglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="progressG" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>

        <line x1="0" y1={baseY} x2={w} y2={baseY} stroke="var(--line)" strokeWidth="1" />
        <path d={path} fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 5" />
        {progress > 0.01 && (
          <path d={path} fill="none" stroke="url(#progressG)" strokeWidth="2"
                strokeDasharray={`${progress * 320} 1000`} />
        )}
        <circle cx={sunX} cy={sunY} r="20" fill="url(#sunglow)" opacity="0.5" />
        <circle cx={sunX} cy={sunY} r="8" fill="var(--accent-2)" />
        <circle cx={sx} cy={baseY} r="3.5" fill="var(--ink-3)" />
        <circle cx={ex} cy={baseY} r="3.5" fill="var(--ink-3)" />
        <text x={sx} y={baseY + 15} textAnchor="middle" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.08em', fill: 'var(--ink-3)' }}>
          {sunrise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </text>
        <text x={ex} y={baseY + 15} textAnchor="middle" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.08em', fill: 'var(--ink-3)' }}>
          {sunset.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </text>
      </svg>
    </div>
  );
}

/* ============ HOURLY STRIP ============ */
function HourlyStrip({ hourly, cloud = [], currentHour, sunrise, sunset }) {
  const maxUV = 12;
  const nowIdx = Math.floor(currentHour);
  const cloudSeries = hourly.map((_, i) => Math.max(0, Math.min(100, cloud[i] ?? 0)));
  const usefulStart = hourly.findIndex(v => v >= 3);
  const usefulEnd = usefulStart >= 0 ? hourly.length - 1 - [...hourly].reverse().findIndex(v => v >= 3) : -1;
  const avoidStart = hourly.findIndex(v => v >= 8);
  const avoidEnd = avoidStart >= 0 ? hourly.length - 1 - [...hourly].reverse().findIndex(v => v >= 8) : -1;
  const clearestIdx = cloudSeries.reduce((best, cloudPct, i) => {
    if (hourly[i] < 1) return best;
    if (best === -1) return i;
    if (cloudPct < cloudSeries[best]) return i;
    if (cloudPct === cloudSeries[best] && hourly[i] > hourly[best]) return i;
    return best;
  }, -1);
  const daylightHours = sunrise && sunset ? Math.max(0, (sunset - sunrise) / 3600000) : 0;

  function compactHourLabel(hour) {
    const suffix = hour >= 12 ? 'p' : 'a';
    const normalized = hour % 12 === 0 ? 12 : hour % 12;
    return `${normalized}${suffix}`;
  }

  function windowLabel(start, end) {
    if (start < 0 || end < start) return 'None today';
    return `${compactHourLabel(start)} - ${compactHourLabel((end + 1) % 24)}`;
  }

  const insightItems = [
    {
      label: 'Useful UV',
      value: usefulStart >= 0 ? windowLabel(usefulStart, usefulEnd) : 'Limited',
      sub: usefulStart >= 0 ? 'UV 3+ for vitamin D / color' : 'Very soft conditions today'
    },
    {
      label: 'Avoid Window',
      value: avoidStart >= 0 ? windowLabel(avoidStart, avoidEnd) : 'None',
      sub: avoidStart >= 0 ? 'UV 8+ burns fast' : 'Peak stays below severe risk'
    },
    {
      label: 'Clearest Hour',
      value: clearestIdx >= 0 ? compactHourLabel(clearestIdx) : 'After dark',
      sub: clearestIdx >= 0 ? `${cloudSeries[clearestIdx]}% cloud cover` : 'No daylight hours left'
    },
    {
      label: 'Daylight Span',
      value: sunrise && sunset ? `${formatTime(sunrise)} - ${formatTime(sunset)}` : '—',
      sub: sunrise && sunset ? `${daylightHours.toFixed(1)} hrs of sun` : 'Sun times unavailable'
    },
  ];

  return (
    <div>
      <div className="hourly">
        {hourly.map((v, i) => (
          <div key={i} className={`hourly-bar ${i === nowIdx ? 'now' : ''}`}>
            <div className="fill" style={{
              height: `${Math.max(3, (v / maxUV) * 100)}%`,
              background: v > 0 ? uvInterpColor(v) : 'transparent',
              opacity: v > 0 ? 0.9 : 0
            }} />
          </div>
        ))}
      </div>
      <div className="hourly-axis">
        <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
      </div>

      <div className="hourly-secondary">
        <div className="mini-trend">
          <div className="mini-trend-head">
            <span className="mini-trend-title">Cloud Cover</span>
            <span className="mini-trend-meta">{cloudSeries[nowIdx] ?? 0}% now · lower is clearer</span>
          </div>
          <div className="cloud-hourly">
            {cloudSeries.map((cloudPct, i) => (
              <div key={i} className={`cloud-bar-shell ${i === nowIdx ? 'now' : ''}`}>
                <div
                  className="cloud-bar-fill"
                  style={{
                    height: `${Math.max(8, cloudPct)}%`,
                    opacity: Math.max(0.24, cloudPct / 100),
                  }}
                />
              </div>
            ))}
          </div>
          <div className="hourly-axis mini-axis">
            <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
          </div>
        </div>

        <div className="hourly-insights">
          {insightItems.map((item) => (
            <div key={item.label} className="insight-card">
              <div className="insight-k">{item.label}</div>
              <div className="insight-v serif">{item.value}</div>
              <div className="insight-sub">{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ 14-DAY OUTLOOK ============ */
function WeekOutlook({ week, weekDates }) {
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div className="week">
      {week.slice(0, 14).map((v, i) => {
        const d = weekDates[i] || new Date();
        return (
          <div key={i} className="day">
            <div className="dow">{i === 0 ? 'Today' : dows[d.getDay()]}</div>
            <div className="dot" style={{ background: uvInterpColor(v), boxShadow: `0 0 14px ${uvInterpColor(v)}50` }} />
            <div className="peak serif">{v.toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ BEST WINDOWS ============ */
function BestTimes({ best }) {
  const blocks = [
    { name: 'Vitamin D Window', desc: 'UV 3–7 · safe exposure',    when: best.vitaminD,    color: '#86c55e', icon: <IconLeaf size={12} /> },
    { name: 'Safe Tan Window',  desc: 'UV 3–5 · gentle color',     when: best.safeTan,     color: '#e4c53e', icon: <IconSparkle size={12} /> },
    { name: 'Peak Intensity',   desc: `UV ${best.peakValue.toFixed(1)} · strongest`,       when: best.peak,        color: '#e04040', icon: <IconSun size={12} /> },
    { name: 'Avoid Window',     desc: 'UV 8+ · burns quickly',     when: best.avoidWindow, color: '#8e32a8', icon: <IconAlert size={12} /> },
  ];
  return (
    <div>
      {blocks.map((b, i) => (
        <div key={i} className="time-block">
          <div className="left">
            <div className="pip" style={{ background: b.color }} />
            <div>
              <div className="t-name serif">{b.name}</div>
              <div className="t-desc">{b.desc}</div>
            </div>
          </div>
          <div className="t-when mono">{b.when}</div>
        </div>
      ))}
    </div>
  );
}

/* ============ PROTECTION PANEL ============ */
function ProtectionPanel({ uv, skinType }) {
  const burn = burnMinutes(uv, skinType);
  const reapply = reapplyMinutes(uv);
  const spf = spfRec(uv);

  return (
    <div>
      <div className="stat-row">
        <div className="k"><IconShield size={13} />Recommended SPF</div>
        <div className="v serif">{spf}<span className="unit">MIN</span></div>
      </div>
      <div className="stat-row">
        <div className="k"><IconDrop size={13} />Reapply every</div>
        <div className="v serif">{reapply}<span className="unit">MIN</span></div>
      </div>
      <div className="stat-row">
        <div className="k"><IconClock size={13} />Burn estimate</div>
        <div className="v serif">{burn === Infinity ? '∞' : burn}<span className="unit">MIN</span></div>
      </div>
      <div className="stat-row">
        <div className="k"><IconEye size={13} />Eye protection</div>
        <div className="v serif" style={{ fontSize: 16 }}>{uv >= 3 ? 'Required' : 'Optional'}</div>
      </div>
      <div className="stat-row">
        <div className="k"><IconWind size={13} />Clothing</div>
        <div className="v serif" style={{ fontSize: 15 }}>{uv >= 6 ? 'UPF 50' : uv >= 3 ? 'Lightweight' : 'Optional'}</div>
      </div>
    </div>
  );
}

/* ============ CONDITIONS PANEL ============ */
function Conditions({ sunrise, sunset, cloudNow }) {
  const solarNoon = new Date((sunrise.getTime() + sunset.getTime()) / 2);
  const daylight = (sunset - sunrise) / 3600000;
  const now = new Date();
  const remaining = Math.max(0, (sunset - now) / 3600000);

  return (
    <div>
      <div className="stat-row">
        <div className="k"><IconSunrise size={13} />Sunrise</div>
        <div className="v serif">{formatTime(sunrise)}</div>
      </div>
      <div className="stat-row">
        <div className="k"><IconSun size={13} />Solar Noon</div>
        <div className="v serif">{formatTime(solarNoon)}</div>
      </div>
      <div className="stat-row">
        <div className="k"><IconSunset size={13} />Sunset</div>
        <div className="v serif">{formatTime(sunset)}</div>
      </div>
      <div className="stat-row">
        <div className="k"><IconClock size={13} />Daylight Left</div>
        <div className="v serif">{remaining > 0 ? `${remaining.toFixed(1)}` : '0'}<span className="unit">HRS</span></div>
      </div>
      <div className="stat-row">
        <div className="k"><IconCloud size={13} />Cloud Cover</div>
        <div className="v serif">{cloudNow}<span className="unit">%</span></div>
      </div>
    </div>
  );
}

/* ============ BIG STAT MINI CARDS ============ */
function MiniStatCard({ label, value, unit, icon, color, sub }) {
  return (
    <div className="card" style={{ padding: '20px 22px' }}>
      <div className="card-label">{icon}{label}</div>
      <div className="big-stat">
        <div className="num serif" style={{ color: color || 'var(--ink)' }}>
          {value}
          {unit && <span className="unit-sm">{unit}</span>}
        </div>
        {sub && <div className="sub-note">{sub}</div>}
      </div>
    </div>
  );
}

/* ============ ADVISORY BANNER ============ */
function AdvisoryBanner({ uv, skinType, envMult }) {
  const { head, body } = smartAdvice(uv, skinType, envMult);
  const adjUV = uv * envMult;
  const { c } = uvColor(adjUV);
  return (
    <div className="advisory-banner" style={{ background: `linear-gradient(135deg, ${c}ee, ${c}bb)` }}>
      <div className="adv-icon"><IconAlert size={22} stroke="white" /></div>
      <div>
        <div className="adv-head">{head}</div>
        <div className="adv-sub">{body}</div>
      </div>
    </div>
  );
}

/* ============ VITAMIN D ESTIMATOR ============ */
// Rough estimate: average adult produces ~1000 IU per hour at UV index 3,
// scaling linearly. Full-body exposure; typical clothed = 25% body surface.
function vitDPerHour(uv, bodyPct = 0.25) {
  if (uv < 1) return 0;
  const base = (uv / 3) * 1000; // IU/hr at full body exposure
  return Math.round(base * bodyPct);
}

function vitDDaily(hourly, bodyPct = 0.25) {
  return hourly.reduce((sum, v) => sum + vitDPerHour(v, bodyPct), 0);
}

const EXPOSURE_LEVELS = [
  { label: 'Hands & face', pct: 0.10 },
  { label: 'Arms out',     pct: 0.20 },
  { label: 'T-shirt',      pct: 0.30 },
  { label: 'Swimsuit',     pct: 0.70 },
];

function VitaminDCard({ uv, hourly }) {
  const [expIdx, setExpIdx] = useS(1);
  const exp = EXPOSURE_LEVELS[expIdx];
  const nowRate = vitDPerHour(uv, exp.pct);
  const daily   = vitDDaily(hourly, exp.pct);
  const rda     = 600; // IU, general adult RDA
  const rdaPct  = Math.min(100, Math.round((daily / rda) * 100));

  // Time to reach RDA at current UV
  const minsToRDA = nowRate > 0 ? Math.round((rda / nowRate) * 60) : null;

  return (
    <div>
      <div className="card-label"><IconLeaf size={12} />Vitamin D Estimator</div>

      {/* Exposure selector */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
        {EXPOSURE_LEVELS.map((e, i) => (
          <button key={i} onClick={() => setExpIdx(i)} style={{
            padding: '6px 10px', borderRadius: 8,
            border: '1px solid var(--line)',
            background: expIdx === i ? 'var(--ink)' : 'transparent',
            color: expIdx === i ? 'var(--sand-50)' : 'var(--ink-2)',
            fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}>{e.label}</button>
        ))}
      </div>

      <div className="stat-row">
        <div className="k"><IconSun size={13} />Producing now</div>
        <div className="v serif" style={{ color: nowRate > 0 ? '#86c55e' : 'var(--ink-3)' }}>
          {nowRate > 0 ? nowRate : '—'}<span className="unit">{nowRate > 0 ? 'IU/hr' : ''}</span>
        </div>
      </div>
      <div className="stat-row">
        <div className="k"><IconClock size={13} />Minutes to RDA</div>
        <div className="v serif">
          {minsToRDA ? minsToRDA : '∞'}<span className="unit">{minsToRDA ? 'min' : ''}</span>
        </div>
      </div>
      <div className="stat-row">
        <div className="k"><IconSparkle size={13} />Today's potential</div>
        <div className="v serif">{daily > 0 ? daily.toLocaleString() : '—'}<span className="unit">{daily > 0 ? 'IU' : ''}</span>
        </div>
      </div>

      {/* RDA progress bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span className="label" style={{ fontSize: 9 }}>Daily RDA ({rda} IU)</span>
          <span className="label" style={{ fontSize: 9, color: rdaPct >= 100 ? '#86c55e' : 'var(--ink-3)' }}>{rdaPct}%</span>
        </div>
        <div style={{ height: 5, background: 'var(--sand-100)', borderRadius: 100, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 100,
            width: `${rdaPct}%`,
            background: rdaPct >= 100 ? '#86c55e' : rdaPct > 60 ? '#e4c53e' : '#f08030',
            transition: 'width 0.6s ease, background 0.6s ease'
          }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          {rdaPct >= 100 ? 'Full daily dose achievable today' :
           rdaPct > 50 ? 'Good production day' : 'Limited synthesis conditions'}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  SunArc, HourlyStrip, WeekOutlook, BestTimes, ProtectionPanel, Conditions,
  SkinTypeSelector, BurnTimer, TanningScore, MiniStatCard, AdvisoryBanner, VitaminDCard,
  burnMinutes, reapplyMinutes, spfRec, tanningScore, scoreLabel, smartAdvice,
  vitDPerHour, vitDDaily, SKIN_TYPES
});
