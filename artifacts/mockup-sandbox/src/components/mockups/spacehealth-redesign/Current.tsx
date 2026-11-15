import {
  Activity, Bell, ClipboardList, Dumbbell, HeartPulse, Moon, Orbit,
  Radiation, Thermometer, Waves, Wind,
} from 'lucide-react';
import './_group.css';

const vitals = [
  { label: 'Heart rate', value: '64', unit: 'bpm', icon: HeartPulse },
  { label: 'Blood oxygen', value: '98', unit: '% SpO₂', icon: Waves },
  { label: 'Respiration', value: '14', unit: 'breaths/min', icon: Wind },
  { label: 'Core temperature', value: '36.8', unit: '°C', icon: Thermometer },
  { label: 'Systolic pressure', value: '118', unit: 'mmHg', icon: Activity },
  { label: 'Diastolic pressure', value: '76', unit: 'mmHg', icon: Activity },
  { label: 'Stress', value: '3', unit: '/ 10', icon: Activity },
  { label: 'Heart variability', value: '58', unit: 'ms', icon: HeartPulse },
  { label: 'Sleep', value: '7.4', unit: 'hours', icon: Moon },
  { label: 'Activity', value: '90', unit: 'min', icon: Activity },
  { label: 'Water', value: '1.8', unit: 'L', icon: Waves },
];

const cabin = [
  { label: 'Cabin O₂', value: '21%', status: 'Normal' },
  { label: 'CO₂', value: '1,800 ppm', status: 'Normal' },
  { label: 'Pressure', value: '101.3 kPa', status: 'Normal' },
  { label: 'Temperature', value: '22°C', status: 'Normal' },
  { label: 'Humidity', value: '45%', status: 'Normal' },
];

function Current() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Orbit size={19} /></span>
          <span className="brand-name">SpaceHealth</span>
        </div>
        <nav className="nav-list" aria-label="Current navigation">
          {[
            { label: 'Readings', icon: Radiation, active: true },
            { label: 'Muscle & bone', icon: Dumbbell },
            { label: 'Alerts', icon: Bell },
            { label: 'Log', icon: ClipboardList },
          ].map(({ label, icon: Icon, active }) => (
            <div key={label} className={`nav-link ${active ? 'active' : ''}`}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">Ad astra per asphera</div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="crew-branding"><strong className="crew-name">Mara Velez</strong></div>
          <span className="sensor-live-pill"><span className="live-dot" /> Demo · no live sensors</span>
          <div className="mission-time"><span className="wrist-day">Day 142</span><div className="earth-clock"><span className="earth-clock-label">Earth time</span><time>17:37</time></div></div>
        </header>
        <main className="main-content">
          <div className="page-heading"><h1>Readings</h1><span className="wrist-alert"><Bell size={15} /> 1 alert</span></div>

          <section className="panel radiation-panel">
            <div className="radiation-caption"><Radiation size={18} /><strong>Radiation now · Wrist dosimeter</strong><span>Sample</span></div>
            <div className="radiation-value">30.0<span> µSv/h</span></div>
            <div className="radiation-state"><strong>Above the earlier sample pattern</strong></div>
            <div className="radiation-comparison">Statistical change · not an exposure limit</div>
          </section>

          <div className="section-head"><h2 className="section-title">Cabin readings</h2><span className="short-hint">Simulated</span></div>
          <div className="grid signal-grid">
            {cabin.map(item => (
              <article key={item.label} className="panel signal-card">
                <div className="signal-head"><span className="signal-name">{item.label}</span><span className="signal-status">{item.status}</span></div>
                <div className="signal-large">{item.value}</div>
                <div className="signal-foot"><span>Sample value</span><span>No live sensor</span></div>
              </article>
            ))}
          </div>

          <div className="readings-trend-heading">
            <strong>Readings + trends</strong>
            <div className="period-tabs"><button type="button" className="selected">7d</button><button type="button">14d</button></div>
          </div>
          <div className="grid wrist-reading-grid">
            {vitals.map(({ label, value, unit, icon: Icon }, index) => (
              <article key={`${label}-${index}`} className="panel metric-card compact-reading">
                <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={16} /></span></div>
                <div className="metric-value">{value} <span className="metric-unit">{unit}</span></div>
                <span className="vital-zone-pill">Normal · sample</span>
                <div className="reading-inline-trend">
                  <svg className="sparkline" viewBox="0 0 300 74" aria-hidden="true">
                    <path d={`M6 48 L${46 + index * 3} 35 L${100 + index * 2} 43 L${150 + index * 2} 22 L${202 + index} 31 L294 20`} fill="none" stroke="var(--signal-color)" strokeWidth="3" />
                  </svg>
                  <div className="chart-labels"><span>7 days</span><span>Now</span></div>
                </div>
              </article>
            ))}
          </div>

          <div className="section-head"><h2 className="section-title">More</h2></div>
          <div className="panel panel-pad"><Dumbbell size={17} /> Workouts &nbsp;·&nbsp; Family care &nbsp;·&nbsp; Sync Earth</div>
          <div className="legal-strip"><Orbit size={16} /> All readings are sample data. No live sensors are connected.</div>
        </main>
        <footer className="mission-footer"><strong className="mission-motto">Ad astra per asphera</strong><span>To the stars through hardship.</span></footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <span className="active"><Radiation /><small>Readings</small></span>
        <span><Dumbbell /><small>Body</small></span>
        <span><Bell /><small>Alerts</small></span>
        <span><ClipboardList /><small>Log</small></span>
      </nav>
      <button type="button" className="astro-floating-button"><Orbit size={24} /><span>Astro</span></button>
    </div>
  );
}

export { Current };
