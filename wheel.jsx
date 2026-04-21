// UV Wheel — STATIC categorical color wheel (matches reference).
// Green=LOW at left, yellow=MODERATE top-left, orange=HIGH top-right, red=VERY HIGH right, purple=EXTREME bottom.
// A pointer indicates where the current UV falls on the category scale.
// Dragging the wheel scrubs through the day's hourly UV.

const { useState, useEffect, useRef } = React;

function UVWheel({ hourly, currentHour, sunrise, sunset, motion = 70, envMultiplier = 1, onScrub, isScrubbing, setIsScrubbing }) {
  const size = 600;
  const cx = size / 2;
  const cy = size / 2;
  const wrapRef = useRef(null);
  const [activeMarker, setActiveMarker] = useState(null);

  // Current UV
  const adjHourly = hourly.map(v => v * envMultiplier);
  const hLow = Math.floor(currentHour) % 24;
  const hHigh = (hLow + 1) % 24;
  const frac = currentHour - hLow;
  const currentUV = adjHourly[hLow] * (1 - frac) + adjHourly[hHigh] * frac;
  const { level, c: uvC } = uvColor(currentUV);

  const R_OUTER = 268;
  const R_INNER = 198;

  // ====== STATIC CATEGORICAL WHEEL ======
  // Bands (clockwise from 12 o'clock = 0°):
  //  0-72°   : HIGH (orange)       — top-right
  //  72-144° : VERY HIGH (red)     — right
  //  144-216°: EXTREME (purple)    — bottom
  //  216-288°: LOW (green)         — bottom-left/left
  //  288-360°: MODERATE (yellow)   — top-left
  // Each band = 72° (5 equal bands)
  const BANDS = [
    { label: 'HIGH',      start: 0,   end: 72,  c0: '#e8a63a', c1: '#e66b2a' },
    { label: 'VERY HIGH', start: 72,  end: 144, c0: '#e66b2a', c1: '#c93a3a' },
    { label: 'EXTREME',   start: 144, end: 216, c0: '#c93a3a', c1: '#6b3aa8' },
    { label: 'LOW',       start: 216, end: 288, c0: '#3a9a6a', c1: '#8fc96a' },
    { label: 'MODERATE',  start: 288, end: 360, c0: '#8fc96a', c1: '#e8c53a' },
  ];

  function polar(angleDeg, r) {
    // angleDeg: 0 = top (12 o'clock), clockwise
    const a = (angleDeg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function bandPath(startDeg, endDeg, r0, r1) {
    const [x0, y0] = polar(startDeg, r1);
    const [x1, y1] = polar(endDeg, r1);
    const [x2, y2] = polar(endDeg, r0);
    const [x3, y3] = polar(startDeg, r0);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`;
  }

  // Find where the current UV falls on the category scale → that angle on the wheel
  // LOW = UV 0-3, MODERATE = 3-6, HIGH = 6-8, VERY HIGH = 8-11, EXTREME = 11+
  // Map UV to band angle center with interpolation within the band.
  function uvToCategoryAngle(uv) {
    // Each band covers a UV range and occupies 72°
    // Ordering around the wheel starting from 0° (top) going clockwise:
    //  HIGH (6-8)   : 0°..72°    center 36°
    //  VERY HIGH (8-11): 72°..144° center 108°
    //  EXTREME (11-13+): 144°..216° center 180°
    //  LOW (0-3)    : 216°..288°  center 252°  (we'll map 0→216, 3→288)
    //  MODERATE (3-6): 288°..360° center 324°
    if (uv < 3) {
      const t = uv / 3;
      return 216 + t * 72;
    } else if (uv < 6) {
      const t = (uv - 3) / 3;
      return 288 + t * 72;
    } else if (uv < 8) {
      const t = (uv - 6) / 2;
      return 0 + t * 72;
    } else if (uv < 11) {
      const t = (uv - 8) / 3;
      return 72 + t * 72;
    } else {
      const t = Math.min(1, (uv - 11) / 2);
      return 144 + t * 72;
    }
  }

  const pointerAngle = uvToCategoryAngle(currentUV);
  const wheelRotation = -pointerAngle;

  // Build curved-text arc paths for each band, always drawn in a direction that keeps text right-side up.
  // For bands whose midpoint is in the top half (angles near 0/360) we draw LEFT->RIGHT along the TOP of the arc.
  // For bands at the bottom, we draw RIGHT->LEFT along the BOTTOM so text reads right-side up.
  const R_TEXT = (R_INNER + R_OUTER) / 2 + 3;

  function textArcPath(startDeg, endDeg, r, flip = false) {
    // If flip, swap start/end and use opposite sweep so text goes the other way along the arc
    let s = startDeg, e = endDeg, sweep = 1;
    if (flip) { s = endDeg; e = startDeg; sweep = 0; }
    const [x0, y0] = polar(s, r);
    const [x1, y1] = polar(e, r);
    const delta = flip ? (startDeg - endDeg) : (endDeg - startDeg);
    const large = Math.abs(delta) > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
  }

  // Time label
  const hh = Math.floor(currentHour);
  const mm = Math.floor((currentHour - hh) * 60);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hhDisp = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  const timeLabel = `${hhDisp}:${String(mm).padStart(2, '0')} ${ampm}`;

  const uvInt = Math.floor(currentUV);
  const uvDec = Math.round((currentUV - uvInt) * 10);

  const breatheDuration = `${Math.max(2, 12 - motion / 10)}s`;

  // === DRAG: convert pointer to hour (0-24) based on angle around center ===
  function pointerToHour(clientX, clientY) {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left - rect.width / 2;
    const py = clientY - rect.top - rect.height / 2;
    let a = Math.atan2(py, px) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    return (a / (Math.PI * 2)) * 24;
  }

  function handleDown(e) {
    e.preventDefault();
    setIsScrubbing(true);
    const pt = e.touches ? e.touches[0] : e;
    onScrub(pointerToHour(pt.clientX, pt.clientY));
  }

  useEffect(() => {
    if (!isScrubbing) return;
    function move(e) {
      const pt = e.touches ? e.touches[0] : e;
      onScrub(pointerToHour(pt.clientX, pt.clientY));
    }
    function up() { setIsScrubbing(false); }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [isScrubbing]);

  // Hour-of-day marker — smaller dot on outer edge showing the currently-viewed hour
  const hourAngle = (currentHour / 24) * 360;
  const [hx, hy] = polar(hourAngle, R_OUTER + 14);

  return (
    <div
      ref={wrapRef}
      className="wheel-wrap"
      onPointerDown={handleDown}
      style={{ cursor: isScrubbing ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}
    >
      <svg viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {BANDS.map((b, i) => (
            <linearGradient key={i} id={`bandg-${i}`}
                            gradientUnits="userSpaceOnUse"
                            x1={polar(b.start, R_OUTER)[0]} y1={polar(b.start, R_OUTER)[1]}
                            x2={polar(b.end, R_OUTER)[0]}   y2={polar(b.end, R_OUTER)[1]}>
              <stop offset="0%" stopColor={b.c0} />
              <stop offset="100%" stopColor={b.c1} />
            </linearGradient>
          ))}
          <radialGradient id="outerHalo" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor={uvC} stopOpacity="0.3" />
            <stop offset="100%" stopColor={uvC} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0.97" />
            <stop offset="100%" stopColor={uvC} stopOpacity="0.2" />
          </radialGradient>
          {BANDS.map((b, i) => {
            // For bands whose mid-angle is between 90° and 270° (right/bottom/left), flip so text reads right-side up
            const mid = (b.start + b.end) / 2;
            const flip = mid > 90 && mid < 270;
            return (
              <path key={`tp-${i}`} id={`bandpath-${i}`}
                    d={textArcPath(b.start + 4, b.end - 4, R_TEXT, flip)}
                    fill="none" />
            );
          })}
        </defs>

        {/* Ambient halo */}
        <g style={{ animation: `breathe ${breatheDuration} ease-in-out infinite`, transformOrigin: `${cx}px ${cy}px`}}>
          <circle cx={cx} cy={cy} r={300} fill="url(#outerHalo)" />
        </g>

        {/* Dashed outer ring */}
        <circle cx={cx} cy={cy} r={285} fill="none" stroke="var(--ink-2)" strokeWidth="0.5" strokeDasharray="1 8" opacity="0.35" />

        {/* Hour ticks outside the colored ring */}
        {Array.from({length: 24}).map((_, i) => {
          const [x0, y0] = polar((i / 24) * 360, R_OUTER + 6);
          const [x1, y1] = polar((i / 24) * 360, i % 6 === 0 ? R_OUTER + 16 : R_OUTER + 10);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1}
                       stroke="var(--ink-2)"
                       strokeWidth={i % 6 === 0 ? 1.2 : 0.5}
                       opacity={i % 6 === 0 ? 0.7 : 0.3} />;
        })}

        {/* Hour numerals */}
        {[0, 6, 12, 18].map(h => {
          const [x, y] = polar((h / 24) * 360, R_OUTER + 34);
          const lbl = h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`;
          return (
            <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  style={{fontFamily: 'JetBrains Mono, monospace', fontSize: 13, letterSpacing: '0.08em', fill: 'var(--ink-2)', fontWeight: 500}}>
              {lbl}
            </text>
          );
        })}

        {/* Rotating UV band ring only */}
        <g style={{ transform: `rotate(${wheelRotation}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: isScrubbing ? 'transform 0.15s ease-out' : 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {BANDS.map((b, i) => (
            <path key={i}
                  d={bandPath(b.start, b.end, R_INNER, R_OUTER)}
                  fill={`url(#bandg-${i})`} />
          ))}

          {/* Band divider lines (thin) */}
          {BANDS.map((b, i) => {
            const [x0, y0] = polar(b.start, R_INNER);
            const [x1, y1] = polar(b.start, R_OUTER);
            return <line key={`div-${i}`} x1={x0} y1={y0} x2={x1} y2={y1}
                         stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />;
          })}

          {/* Subtle inner & outer ring borders */}
          <circle cx={cx} cy={cy} r={R_INNER} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={R_OUTER} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />

          {/* Curved band labels */}
          {BANDS.map((b, i) => (
            <text key={`lbl-${i}`}
                  style={{fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', fill: 'rgba(255,255,255,0.98)'}}>
              <textPath href={`#bandpath-${i}`} startOffset="50%" textAnchor="middle">
                {b.label}
              </textPath>
            </text>
          ))}
        </g>

        {/* Sunrise / Sunset markers — refined badges with hover/click emphasis */}
        {[
          [sunrise.getHours() + sunrise.getMinutes()/60, 'rise'],
          [sunset.getHours()  + sunset.getMinutes()/60,  'set'],
        ].map(([h, label]) => {
          const angle = (h / 24) * 360;
          const [x, y] = polar(angle, R_OUTER + 42);
          const isRise = label === 'rise';
          const isActive = activeMarker === label;
          const iconColor = isRise ? '#f5a321' : '#d94f2a';
          const bgColor   = isRise ? 'rgba(255, 251, 240, 0.96)' : 'rgba(255, 245, 240, 0.96)';
          const glowColor = isRise ? 'rgba(245, 163, 33, 0.18)' : 'rgba(217, 79, 42, 0.16)';
          const iconStroke = isActive ? 'rgba(255,255,255,0.98)' : iconColor;
          const [rx, ry] = polar(angle, R_OUTER + 3);
          const [bx, by] = polar(angle, R_OUTER + 24);
          return (
            <g key={label}
               tabIndex={0}
               role="button"
               aria-label={isRise ? 'Sunrise details' : 'Sunset details'}
               style={{ cursor: 'pointer', outline: 'none' }}
               onPointerEnter={() => setActiveMarker(label)}
               onPointerLeave={() => setActiveMarker(curr => (curr === label ? null : curr))}
               onFocus={() => setActiveMarker(label)}
               onBlur={() => setActiveMarker(curr => (curr === label ? null : curr))}
                 onClick={() => {
                   setActiveMarker(label);
                   onScrub(h);
                 }}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     setActiveMarker(label);
                     onScrub(h);
                   }
                }}>
              <title>{isRise ? 'Sunrise' : 'Sunset'}</title>

              <circle cx={x} cy={y} r={isActive ? '18' : '15.5'} fill={glowColor} opacity={isActive ? '0.88' : '0.52'} />

              <line x1={rx} y1={ry} x2={bx} y2={by}
                    stroke={iconColor} strokeWidth={isActive ? '1.2' : '1'} strokeDasharray="1.5 4" opacity={isActive ? '0.72' : '0.42'} />

              <circle cx={x} cy={y} r="13.25" fill={isActive ? iconColor : bgColor} stroke="rgba(255,255,255,0.8)" strokeWidth="1.05" />
              <circle cx={x} cy={y} r="13.25" fill="none" stroke={isActive ? 'rgba(255,255,255,0.28)' : iconColor} strokeWidth="1.05" opacity={isActive ? '1' : '0.58'} />

              <line x1={x-6} y1={y+1.5} x2={x+6} y2={y+1.5}
                    stroke={iconStroke} strokeWidth="1.3" strokeLinecap="round" opacity={isActive ? '1' : '0.84'} />

              {isRise
                ? (
                  <>
                    <path d={`M ${x-4.9} ${y+1.5} A 4.9 4.9 0 0 1 ${x+4.9} ${y+1.5}`}
                          fill="none" stroke={iconStroke} strokeWidth="1.65" strokeLinecap="round" />
                    <path d={`M ${x} ${y-7.7} L ${x} ${y-5.6} M ${x-2.3} ${y-6.4} L ${x} ${y-8.6} L ${x+2.3} ${y-6.4}`}
                          fill="none" stroke={iconStroke} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )
                : (
                  <>
                    <path d={`M ${x-4.9} ${y+1.5} A 4.9 4.9 0 0 1 ${x+4.9} ${y+1.5}`}
                          fill="none" stroke={iconStroke} strokeWidth="1.65" strokeLinecap="round" />
                    <path d={`M ${x} ${y-9.2} L ${x} ${y-7.4} M ${x-2.3} ${y-8.1} L ${x} ${y-5.9} L ${x+2.3} ${y-8.1}`}
                          fill="none" stroke={iconStroke} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )
              }
            </g>
          );
        })}

        {/* === HOUR POINTER on outer edge — shows where "this hour" falls === */}
        <g style={{transform: `rotate(${hourAngle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: isScrubbing ? 'transform 0.15s ease-out' : 'transform 0.6s ease-out'}}>
          <circle cx={cx} cy={cy - R_OUTER - 14} r="6" fill="var(--ink-0)" />
          <circle cx={cx} cy={cy - R_OUTER - 14} r="10" fill="none" stroke="var(--ink-0)" strokeWidth="0.8" opacity="0.3" />
        </g>

        {/* Inner white disc (readout background) */}
        <circle cx={cx} cy={cy} r={R_INNER - 4} fill="url(#orb)" />
        <circle cx={cx} cy={cy} r={R_INNER - 4} fill="none" stroke={uvC} strokeWidth="1" opacity="0.25" />

        {/* Pulsing inner ring */}
        <g style={{transformOrigin: `${cx}px ${cy}px`, animation: `breathe ${breatheDuration} ease-in-out infinite`}}>
          <circle cx={cx} cy={cy} r={R_INNER - 14} fill="none" stroke={uvC} strokeWidth="0.5" opacity="0.35" strokeDasharray="2 4" />
        </g>

        {/* Fixed north pointer — aligns the wheel under a stationary indicator */}
        <g>
          <path d={`M ${cx} ${cy - R_OUTER + 4} l -10 16 l 20 0 z`}
                fill="white"
                stroke={uvC}
                strokeWidth="2"
                strokeLinejoin="round" />
          <circle cx={cx} cy={cy - R_OUTER + 4} r="3" fill={uvC} />
        </g>
      </svg>

      {/* Center readout */}
      <div className="wheel-readout">
        <div className="label-top" style={{color: uvC, fontWeight: 700}}>{level.toUpperCase()}</div>
        <div className="uv-num">
          {uvInt}
          <span className="decimal">.{uvDec}</span>
        </div>
        <div className="time mono" style={{marginTop: 8}}>{timeLabel}</div>
        {envMultiplier !== 1 && (
          <div className="mono" style={{fontSize: 10, color: uvC, marginTop: 6, letterSpacing: '0.14em'}}>
            {envMultiplier > 1 ? `+${Math.round((envMultiplier - 1) * 100)}%` : `${Math.round((envMultiplier - 1) * 100)}%`} ENV
          </div>
        )}
        {isScrubbing && (
          <div className="mono" style={{fontSize: 9, color: 'var(--ink-2)', marginTop: 6, letterSpacing: '0.18em'}}>
            ◉ SCRUBBING
          </div>
        )}
      </div>
    </div>
  );
}

window.UVWheel = UVWheel;
