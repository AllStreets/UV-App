const { useState: uS, useEffect: uE, useRef: uR } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "solar",
  "motion": 70
}/*EDITMODE-END*/;

const ENVIRONMENTS = {
  unset:  { label: 'Open Sky',  mult: 1.0,  icon: 'IconSun',      desc: 'Baseline UV' },
  beach:  { label: 'Beach',     mult: 1.25, icon: 'IconWave',     desc: 'Sand reflects +25%' },
  water:  { label: 'On Water',  mult: 1.35, icon: 'IconDrop',     desc: 'Water reflects +35%' },
  snow:   { label: 'Snow',      mult: 1.65, icon: 'IconSparkle',  desc: 'Snow reflects +65%' },
  city:   { label: 'City',      mult: 1.1,  icon: 'IconPin',      desc: 'Glass/concrete +10%' },
  shade:  { label: 'Shade',     mult: 0.35, icon: 'IconCloud',    desc: 'Partial shade −65%' },
};

function App() {
  const [data, setData]       = uS(null);
  const [loading, setLoading] = uS(true);
  const [tweaks, setTweaks]   = uS(TWEAK_DEFAULTS);
  const [showTweaks, setShowTweaks] = uS(false);
  const [envKey, setEnvKey]   = uS('unset');
  const [skinType, setSkinType] = uS(3);
  const [scrubHour, setScrubHour] = uS(-1);
  const [isScrubbing, setIsScrubbing] = uS(false);
  const [scrolled, setScrolled] = uS(false);
  const [tick, setTick]       = uS(0);

  // Sticky header scroll detection
  uE(() => {
    const handler = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // 30s live tick
  uE(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Theme
  uE(() => {
    // solar = default warm (no data-theme), dusk = dark mode
    document.documentElement.dataset.theme = tweaks.theme === 'dusk' ? 'dusk' : '';
  }, [tweaks.theme]);

  // Edit mode
  uE(() => {
    const h = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setShowTweaks(true);
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false);
    };
    window.addEventListener('message', h);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', h);
  }, []);

  function updateTweak(key, val) {
    setTweaks(t => {
      const next = { ...t, [key]: val };
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
      return next;
    });
  }

  uE(() => {
    fetchUVData().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.24em', color: 'var(--ink-3)' }}>
          LOADING · CHARLESTON
        </div>
      </div>
    );
  }

  const now       = new Date();
  const liveHour  = now.getHours() + now.getMinutes() / 60;
  const currentHour = scrubHour >= 0 ? scrubHour : liveHour;
  const isLive    = scrubHour < 0;

  const env       = ENVIRONMENTS[envKey];
  const envMult   = env.mult;
  const adjHourly = data.hourly.map(v => v * envMult);

  const hLow   = Math.floor(currentHour) % 24;
  const hHigh  = (hLow + 1) % 24;
  const frac   = currentHour - hLow;
  const currentUV = adjHourly[hLow] * (1 - frac) + adjHourly[hHigh] * frac;
  const { level, c: uvC } = uvColor(currentUV);

  const cloudNow  = data.cloud?.[hLow] ?? 20;
  const best      = findBestTimes(adjHourly, data.sunrise, data.sunset);
  const burnMin   = burnMinutes(currentUV, skinType);
  const score     = tanningScore(currentUV, 1); // env already baked in
  const [scoreLabel_, scoreColor] = scoreLabel(score);

  // Sun hours remaining
  const sunRemaining = Math.max(0, (data.sunset - now) / 3600000).toFixed(1);

  function EnvIcon({ k }) {
    const names = { unset: IconSun, beach: IconWave, water: IconDrop, snow: IconSparkle, city: IconPin, shade: IconCloud };
    const Ico = names[k] || IconSun;
    return <Ico size={14} />;
  }

  return (
    <div className="app">
      <div className="sky" />
      <div className="sun-halo" />

      {/* ── STICKY HEADER ── */}
      <header className={`sticky-bar ${scrolled ? 'scrolled' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 34 34" width="34" height="34">
              <defs>
                <radialGradient id="bG">
                  <stop offset="0%" stopColor="var(--accent-2)" />
                  <stop offset="100%" stopColor="var(--accent)" />
                </radialGradient>
              </defs>
              <circle cx="17" cy="17" r="7" fill="url(#bG)" />
              <circle cx="17" cy="17" r="13" fill="none" stroke="var(--ink)" strokeWidth="0.5" strokeDasharray="1 3.2"
                      className="spin-slow" style={{ transformOrigin: '17px 17px' }} />
            </svg>
          </div>
          <div className="brand-text">
            <h1 className="serif">Solace<span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>.</span></h1>
            <div className="sub mono">UV · Charleston, SC</div>
          </div>
        </div>

        <div className="header-right">
          {scrolled && (
            <div className="live-pill fade-up">
              <span className="live-dot" style={{ background: uvC }} />
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em' }}>UV {currentUV.toFixed(1)}</span>
              <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: uvC }}>{level}</span>
            </div>
          )}
          <div className="location-text">
            <div className="city serif">
              {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="coords mono">
              <span className="status">
                <span className="live-dot" style={{ width: 5, height: 5, display: 'inline-block', borderRadius: '50%', background: data.live ? '#4db86a' : '#e4c53e', animation: 'blip 2s ease-in-out infinite' }} />
                &nbsp;{data.live ? 'Live · Open-Meteo' : 'Simulated'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span>{isLive ? 'Live Reading' : 'Scrubbed View'}</span>
          <span className="sep">·</span>
          <span>April 20, 2026</span>
          <span className="sep">·</span>
          <span>Charleston</span>
        </div>

        <div className="hero-tagline serif">
          Currently <strong style={{ color: uvC }}>{level}</strong> UV exposure{' '}
          {!isLive && <span style={{ fontSize: 26, fontStyle: 'normal', fontFamily: 'JetBrains Mono, monospace', color: 'var(--ink-3)' }}>· preview</span>}
        </div>

        <UVWheel
          hourly={data.hourly}
          currentHour={currentHour}
          sunrise={data.sunrise}
          sunset={data.sunset}
          motion={tweaks.motion}
          envMultiplier={envMult}
          onScrub={setScrubHour}
          isScrubbing={isScrubbing}
          setIsScrubbing={setIsScrubbing}
        />

        {/* Legend */}
        <div style={{ width: '100%', maxWidth: 640, marginTop: 14 }}>
          <div className="legend">
            {[['#4cb8a4'], ['#86c55e'], ['#e4c53e'], ['#f08030'], ['#e04040'], ['#8e32a8']].map(([c], i) => (
              <div key={i} className="legend-seg" style={{ background: c }} />
            ))}
          </div>
          <div className="legend-labels">
            <span>0</span><span>Low</span><span>Mod</span><span>High</span><span>V. High</span><span>11+</span>
          </div>
        </div>

        {/* Scrub hint / return to now */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div className="hero-hint">
            <span className="pulse" />
            Drag the wheel to explore UV through the day
          </div>
          {!isLive && (
            <button className="return-now" onClick={() => setScrubHour(-1)}>
              <IconClock size={11} /> Return to now
            </button>
          )}
        </div>
      </section>

      {/* ── ENVIRONMENT SELECTOR ── */}
      <section className="env-section">
        <div className="env-section-label label">
          <IconWave size={11} style={{ display: 'inline', marginRight: 8 }} />
          Environment · adjusts UV for reflective surfaces
        </div>
        <div className="env-pills">
          {Object.entries(ENVIRONMENTS).map(([k, env]) => {
            const pct = env.mult === 1 ? '' : env.mult > 1
              ? ` +${Math.round((env.mult - 1) * 100)}%`
              : ` ${Math.round((env.mult - 1) * 100)}%`;
            return (
              <button key={k} className={`env-pill ${envKey === k ? 'active' : ''}`} onClick={() => setEnvKey(k)}>
                <EnvIcon k={k} />
                {env.label}
                {pct && <span className="pct">{pct}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── SMART ADVISORY ── */}
      <AdvisoryBanner uv={currentUV} skinType={skinType} envMult={envMult} />

      {/* ── DIVIDER ── */}
      <div className="section-divider" />

      {/* ── ROW 1: MINI STATS (4 across) ── */}
      <div className="section-label label"><IconSun size={11} />At a glance</div>
      <div className="grid-4">
        <MiniStatCard label="UV Index" value={currentUV.toFixed(1)} icon={<IconSun size={11} />}
          color={uvC} sub={`${level} · ${isLive ? 'Live' : 'Scrubbed'}`} />
        <MiniStatCard label="Time to Burn" value={burnMin === Infinity ? '∞' : burnMin} unit="min"
          icon={<IconAlert size={11} />} sub={`Skin type ${skinType}`}
          color={burnMin < 20 ? '#e04040' : burnMin < 45 ? '#f08030' : 'var(--ink)'} />
        <MiniStatCard label="Tan Score" value={score} unit="/100"
          icon={<IconSparkle size={11} />} sub={scoreLabel_} color={scoreColor} />
        <MiniStatCard label="Sun Remaining" value={sunRemaining} unit="hrs"
          icon={<IconSunset size={11} />} sub={`Sunset ${formatTime(data.sunset)}`} />
      </div>

      {/* ── ROW 2: BEST WINDOWS + SKIN + HOURLY ── */}
      <div className="section-divider" style={{ margin: '32px 0 24px' }} />
      <div className="section-label label"><IconLeaf size={11} />Tanning Guide</div>
      <div className="grid-3">

        <div className="card">
          <div className="card-label"><IconLeaf size={12} />Best Windows</div>
          <BestTimes best={best} />
        </div>

        <div className="card">
          <SkinTypeSelector skinType={skinType} onChange={setSkinType} />
          <div style={{ marginTop: 22 }}>
            <BurnTimer uv={currentUV} skinType={skinType} />
          </div>
          <div style={{ marginTop: 22, borderTop: '1px solid var(--line-2)', paddingTop: 20 }}>
            <TanningScore uv={currentUV} envMult={envMult} />
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <VitaminDCard uv={currentUV} hourly={adjHourly} />
          <div style={{ marginTop: 20, borderTop: '1px solid var(--line-2)', paddingTop: 20 }}>
            <div className="card-label"><IconShield size={12} />Protection</div>
            <ProtectionPanel uv={currentUV} skinType={skinType} />
          </div>
        </div>
      </div>

      {/* ── ROW 3: HOURLY FORECAST + SUN ARC + CONDITIONS ── */}
      <div className="section-divider" style={{ margin: '32px 0 24px' }} />
      <div className="section-label label"><IconClock size={11} />Today's Forecast</div>
      <div className="grid-2">
        <div className="card">
          <div className="card-label" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconSun size={12} />Hourly UV</span>
            <span className="card-label-right mono">Peak · {best.peakValue.toFixed(1)} · {best.peak}</span>
          </div>
          <HourlyStrip
            hourly={adjHourly}
            cloud={data.cloud}
            currentHour={currentHour}
            sunrise={data.sunrise}
            sunset={data.sunset}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-label"><IconClock size={12} />Sun Path · Today</div>
            <SunArc sunrise={data.sunrise} sunset={data.sunset} now={now} />
          </div>
          <div className="card" id="conditions-section">
            <div className="card-label"><IconPin size={12} />Conditions</div>
            <Conditions sunrise={data.sunrise} sunset={data.sunset} cloudNow={cloudNow} />
          </div>
        </div>
      </div>

      {/* ── ROW 4: 14-DAY + SMART TIP ── */}
      <div className="section-divider" style={{ margin: '32px 0 24px' }} />
      <div className="section-label label"><IconSparkle size={11} />14-Day Outlook</div>
      <div className="card">
        <WeekOutlook week={data.week} weekDates={data.weekDates} />
      </div>

      <div className="tip-card" style={{ marginTop: 20 }}>
        <div className="tip-label mono">Charleston · Local Knowledge</div>
        <div className="tip-text serif">
          "Charleston's latitude puts it at the edge of the subtropical UV envelope — summer peak readings routinely exceed 10.
          The harbor's open water and white sand beaches can amplify exposure by up to 35%."
        </div>
      </div>

      {/* ── TWEAKS PANEL ── */}
      <div className={`tweaks ${showTweaks ? 'visible' : ''}`}>
        <h3>Tweaks</h3>
        <div className="tweak-row">
          <label>Mode</label>
          <div className="seg">
            <button className={tweaks.theme !== 'dusk' ? 'active' : ''} onClick={() => updateTweak('theme', 'solar')}>
              Solar Mode
            </button>
            <button className={tweaks.theme === 'dusk' ? 'active' : ''} onClick={() => updateTweak('theme', 'dusk')}>
              Dusk Mode
            </button>
          </div>
        </div>
        <div className="tweak-row">
          <label>Motion · {tweaks.motion}%</label>
          <input type="range" min="0" max="100" step="5" value={tweaks.motion}
                 onChange={e => updateTweak('motion', Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
