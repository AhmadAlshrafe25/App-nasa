import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, Bone, Check,
  ClipboardList, Crosshair, Dumbbell, HeartPulse, Moon,
  Orbit, Radiation, Radio, Shield, Thermometer, Waves, Wind,
} from 'lucide-react';
import './MissionControl.css';

const crew = [
  { name: 'M. Reyes', full: 'Mara Reyes', initials: 'MR', role: 'Commander · CD-1', hr: '64', status: 'NOMINAL', tone: 'teal' },
  { name: 'J. Okafor', full: 'Jules Okafor', initials: 'JO', role: 'Flight engineer · FE-2', hr: '71', status: 'NOMINAL', tone: 'cyan' },
  { name: 'L. Nakamura', full: 'Lena Nakamura', initials: 'LN', role: 'Mission specialist · MS-1', hr: '78', status: 'CRITICAL', tone: 'red' },
  { name: 'T. Lindqvist', full: 'Tove Lindqvist', initials: 'TL', role: 'Flight surgeon · FS-4', hr: '59', status: 'CAUTION', tone: 'amber' },
];

const readings: Record<string, { hr: string; oxygen: string; temp: string; bp: string; resp: string }> = {
  'M. Reyes': { hr: '64', oxygen: '98', temp: '36.8', bp: '118/76', resp: '14' },
  'J. Okafor': { hr: '71', oxygen: '97', temp: '36.7', bp: '122/80', resp: '15' },
  'L. Nakamura': { hr: '78', oxygen: '98', temp: '36.9', bp: '128/84', resp: '16' },
  'T. Lindqvist': { hr: '59', oxygen: '99', temp: '36.6', bp: '116/74', resp: '13' },
};

const vitalDefs = [
  { key: 'hr', label: 'HEART RATE', unit: 'bpm', range: 'Demo reference 50–90', icon: HeartPulse },
  { key: 'oxygen', label: 'BLOOD OXYGEN', unit: '% SpO₂', range: 'Demo reference 95–100%', icon: Waves },
  { key: 'temp', label: 'CORE TEMP', unit: '°C', range: 'Demo reference 36.1–37.2', icon: Thermometer },
  { key: 'bp', label: 'BLOOD PRESSURE', unit: 'mmHg', range: 'Demo reference 90–130 / 60–85', icon: Activity },
  { key: 'resp', label: 'RESPIRATION', unit: 'breaths/min', range: 'Demo reference 12–20', icon: Wind },
];

const muscle = [
  { name: 'Quadriceps mass', value: 8.4, color: 'red' },
  { name: 'Calf mass', value: 5.1, color: 'amber' },
  { name: 'Lumbar muscle', value: 3.8, color: 'teal' },
  { name: 'Tibial bone density', value: 2.6, color: 'teal' },
];
const radiation = [2.3, 2.7, 2.1, 3.4, 2.5, 2.8, 3.0, 2.4, 4.8, 2.9, 2.2, 3.2, 2.6, 3.1];
const sleep = [7.6, 6.2, 7.9, 5.8, 8.1, 7.2, 6.7];
const days = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];

function SectionHeading({ id, index, title, detail }: { id: string; index: string; title: string; detail?: string }) {
  return <div className="mc-section-heading" id={id}>
    <span className="mc-section-index">{index}</span>
    <h2>{title}</h2>
    {detail && <span className="mc-section-detail">{detail}</span>}
  </div>;
}

export function MissionControl() {
  const [selected, setSelected] = useState('L. Nakamura');
  const [acknowledged, setAcknowledged] = useState(false);
  const [utc, setUtc] = useState('17:37:15');
  const activeCrew = crew.find(person => person.name === selected) ?? crew[2];
  const activeReadings = readings[selected];

  useEffect(() => {
    const update = () => setUtc(new Date().toISOString().slice(11, 19));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const reviewExercise = () => document.getElementById('countermeasures')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return <div className="mc">
    <header className="mc-topbar">
      <a href="#overview" className="mc-brand" aria-label="SpaceHealth overview">
        <span className="mc-brand-mark"><Orbit size={21} aria-hidden="true" /></span>
        <span><strong>SPACE<span>·</span>HEALTH</strong><small>Crew health monitoring</small></span>
      </a>
      <div className="mc-clocks">
        <div className="mc-clock"><span>MISSION ELAPSED</span><strong>T+142<span>d</span> 06:46:37</strong></div>
        <div className="mc-clock mc-utc"><span>UTC SAMPLE</span><strong>{utc}</strong></div>
        <div className="mc-link-status"><i /> SIMULATED DATA · NO LIVE SENSORS</div>
      </div>
    </header>

    <div className="mc-layout">
      <aside className="mc-sidebar">
        <div className="mc-side-label">FLIGHT DECK / 01</div>
        <nav aria-label="Dashboard sections" className="mc-nav">
          {[
            { id: 'overview', label: 'Overview', Icon: Crosshair },
            { id: 'crew', label: 'Crew roster', Icon: Orbit },
            { id: 'vitals', label: 'Vital signs', Icon: HeartPulse },
            { id: 'musculoskeletal', label: 'Musculoskeletal', Icon: Bone },
            { id: 'radiation', label: 'Radiation', Icon: Radiation },
            { id: 'sleep', label: 'Sleep and circadian', Icon: Moon },
            { id: 'countermeasures', label: 'Countermeasures', Icon: Dumbbell },
            { id: 'event-log', label: 'Alerts log', Icon: ClipboardList },
          ].map(({ id, label, Icon }, i) => <a key={id} href={`#${id}`} className={`mc-nav-link ${i === 0 ? 'is-active' : ''}`}>
            <Icon size={16} aria-hidden="true" /><span>{label}</span>
            {id === 'event-log' && <b className="mc-nav-count">1</b>}
          </a>)}
        </nav>
        <div className="mc-pass-card">
          <div className="mc-pass-label"><Radio size={14} /> NEXT GROUND PASS</div>
          <strong>18:04 <small>UTC</small></strong>
          <div className="mc-pass-meta"><span>Window 08 min</span><span>Elevation 42°</span></div>
          <div className="mc-pass-line"><i /></div>
          <small className="mc-demo-caption">SIMULATED SCHEDULE</small>
        </div>
        <div className="mc-sidebar-foot"><Shield size={14} /> DEMO ENVIRONMENT <span>v0.8.4</span></div>
      </aside>

      <main className="mc-main">
        <section id="overview" className="mc-overview">
          <div className="mc-page-head">
            <div>
              <div className="mc-eyebrow"><span className="mc-eyebrow-dot" /> ORBITAL STATION / MEDICAL OPERATIONS</div>
              <h1>Crew overview</h1>
              <p>Orbital Station <i /> 4 crew aboard <i /> Mission day 143 of 180</p>
            </div>
            <div className="mc-progress">
              <div><span>MISSION PROGRESS</span><strong>79.4<span>%</span></strong></div>
              <div className="mc-progress-track" aria-label="Mission progress 79.4 percent"><i /></div>
              <small>DAY 143 <span>·</span> 37 DAYS REMAINING</small>
            </div>
          </div>

          <section className={`mc-alert ${acknowledged ? 'is-acknowledged' : ''}`} aria-labelledby="alert-title">
            <span className="mc-alert-icon"><AlertTriangle size={20} aria-hidden="true" /></span>
            <div className="mc-alert-copy">
              <div className="mc-alert-kicker"><b>{acknowledged ? 'ACKNOWLEDGED · DEMO' : 'CRITICAL · SIMULATED SAMPLE'}</b><span>MS1 / BODY COMPOSITION</span></div>
              <h2 id="alert-title">MS1 · L. Nakamura: lower-limb muscle mass at 8.4% loss</h2>
              <p>Illustrative change from the mission reference sample. The 7% marker is a demo visualization threshold only—not an approved medical limit.</p>
            </div>
            <div className="mc-alert-actions">
              <button className="mc-button mc-button-review" onClick={reviewExercise}><Dumbbell size={15} /> Review exercise plan</button>
              <button className="mc-button mc-button-ack" onClick={() => setAcknowledged(true)} disabled={acknowledged}>
                {acknowledged ? <Check size={15} /> : null}{acknowledged ? 'Acknowledged' : 'Acknowledge'}
              </button>
            </div>
          </section>

          <SectionHeading id="crew" index="01" title="Crew roster" detail="4 ACTIVE CREW · ALL VALUES SIMULATED" />
          <div className="mc-crew-grid">
            {crew.map((person, i) => <button key={person.name} className={`mc-crew-card tone-${person.tone} ${selected === person.name ? 'is-selected' : ''}`}
              onClick={() => setSelected(person.name)} aria-pressed={selected === person.name}
              aria-label={`Select ${person.full}, ${person.status.toLowerCase()} sample status`}>
              <span className="mc-crew-top"><span className="mc-avatar">{person.initials}</span><span className={`mc-badge badge-${person.tone}`}>{person.status}</span></span>
              <strong>{person.name}</strong><small>{person.role}</small>
              <span className="mc-crew-bottom"><span><HeartPulse size={13} /> {person.hr} <em>bpm</em></span><span>CREW 0{i + 1}</span></span>
            </button>)}
          </div>

          <SectionHeading id="vitals" index="02" title="Vital signs" detail={`SELECTED CREW · ${activeCrew.name.toUpperCase()} · SIMULATED SAMPLE`} />
          <div className="mc-vitals-grid">
            {vitalDefs.map(item => {
              const Icon = item.icon;
              return <article className={`mc-vital-card ${item.key === 'hr' && selected === 'L. Nakamura' ? 'vital-watch' : ''}`} key={item.key}>
                <div className="mc-vital-head"><span>{item.label}</span><Icon size={15} aria-hidden="true" /></div>
                <div className="mc-vital-value">{activeReadings[item.key as keyof typeof activeReadings]} <small>{item.unit}</small></div>
                <div className="mc-vital-range">{item.range}</div>
                <div className="mc-vital-foot"><span className="mc-sample-dot" /> SAMPLE VALUE <span>NO LIVE SENSOR</span></div>
              </article>;
            })}
          </div>

          <div className="mc-analytics-row">
            <section className="mc-panel mc-muscle-panel">
              <SectionHeading id="musculoskeletal" index="03" title="Musculoskeletal health" detail="MS1 · SIMULATED" />
              <div className="mc-chart-legend"><span><i className="key-red" /> CRITICAL SAMPLE</span><span><i className="key-amber" /> WATCH SAMPLE</span><span><i className="key-teal" /> WITHIN DEMO BAND</span></div>
              <div className="mc-muscle-chart">
                <div className="mc-threshold"><span>7% DEMO MARKER</span></div>
                {muscle.map(row => <div className="mc-muscle-row" key={row.name}>
                  <span className="mc-muscle-name">{row.name}</span>
                  <div className="mc-segments" aria-label={`${row.value}% sample loss`}>
                    {Array.from({ length: 12 }, (_, i) => <i key={i} className={i < Math.round(row.value / 10 * 12) ? `fill-${row.color}` : ''} />)}
                  </div>
                  <strong className={`mc-loss loss-${row.color}`}>−{row.value.toFixed(1)}%</strong>
                </div>)}
              </div>
              <div className="mc-note"><AlertTriangle size={14} /> All values are fictional samples. Threshold is illustrative, not an approved medical limit.</div>
            </section>

            <section className="mc-panel mc-rad-panel">
              <SectionHeading id="radiation" index="04" title="Radiation exposure" detail="SIMULATED DOSE" />
              <div className="mc-dose-readout"><strong>47.2</strong><span>mSv <em>of</em> 120 mSv</span><small>SIMULATED MISSION BUDGET</small></div>
              <div className="mc-budget-track" aria-label="Simulated radiation budget: 47.2 of 120 millisieverts"><i /></div>
              <div className="mc-budget-meta"><span>39.3% of demo budget</span><span>NOT AN APPROVED EXPOSURE LIMIT</span></div>
              <div className="mc-chart-title">DAILY DOSE · LAST 14 DAYS <span>SIMULATED / mSv</span></div>
              <div className="mc-dose-chart" role="img" aria-label="Simulated daily radiation dose chart for 14 days">
                {radiation.map((value, i) => <div className="mc-dose-col" key={i}><i className={value > 4 ? 'bar-spike' : ''} style={{ height: `${value / 5 * 100}%` }} /><small>{i + 1}</small></div>)}
              </div>
              <div className="mc-chart-axis"><span>14 DAYS AGO</span><span>SAMPLE DAY</span></div>
            </section>
          </div>

          <div className="mc-analytics-row mc-lower-row">
            <section className="mc-panel mc-sleep-panel">
              <SectionHeading id="sleep" index="05" title="Sleep and circadian" detail="LAST 7 DAYS · HOURS / NIGHT" />
              <div className="mc-sleep-chart" role="img" aria-label="Simulated sleep duration over seven days, with 8 hour illustrative target">
                <div className="mc-sleep-target"><span>8.0 H DEMO TARGET</span></div>
                {sleep.map((hours, i) => <div className="mc-sleep-col" key={days[i]}>
                  <strong>{hours.toFixed(1)}</strong><div className={`mc-sleep-bar ${hours < 6 ? 'below-target' : ''}`} style={{ height: `${hours / 9 * 100}%` }} /><small>{days[i]}</small>
                </div>)}
              </div>
              <div className="mc-note"><Moon size={14} /> Illustrative sleep target only; not a clinical recommendation.</div>
            </section>

            <section className="mc-panel mc-counter-panel">
              <SectionHeading id="countermeasures" index="06" title="Countermeasures today" detail="SIMULATED SESSION LOG" />
              <div className="mc-workout-list">
                <div className="mc-workout-row recommended">
                  <span className="mc-workout-icon"><Dumbbell size={17} /></span>
                  <div className="mc-workout-info"><strong>Resistive device <small>(ARED)</small></strong><div className="mc-workout-track"><i style={{ width: '75%' }} /></div></div>
                  <b>45 <small>/ 60 min</small></b>
                </div>
                <div className="mc-workout-row">
                  <span className="mc-workout-icon"><Activity size={17} /></span>
                  <div className="mc-workout-info"><strong>Treadmill</strong><div className="mc-workout-track"><i style={{ width: '60%' }} /></div></div>
                  <b>30 <small>/ 50 min</small></b>
                </div>
                <div className="mc-workout-row pending">
                  <span className="mc-workout-icon"><Waves size={17} /></span>
                  <div className="mc-workout-info"><strong>Cycle ergometer</strong><div className="mc-workout-track"><i style={{ width: '0%' }} /></div></div>
                  <span className="mc-pending-pill">CYCLE SESSION PENDING</span>
                </div>
              </div>
              <div className="mc-note"><Dumbbell size={14} /> Recommended row highlighted for the simulated muscle-loss sample.</div>
            </section>
          </div>

          <section className="mc-panel mc-log-panel">
            <SectionHeading id="event-log" index="07" title="Event log" detail="SIMULATED TELEMETRY FEED" />
            <div className="mc-log-head"><span>UTC SAMPLE</span><span>SUBSYSTEM</span><span>EVENT DESCRIPTION</span><span>STATE</span></div>
            {[
              ['14:12:08', 'BIOMED-3', 'MS1 lower-limb sample registered at −8.4%', 'CRITICAL', 'red'],
              ['13:48:31', 'SLEEP-MON', 'Crew sleep window closed · 6.7 h sample', 'INFO', 'steel'],
              ['12:06:14', 'EXERCISE', 'ARED countermeasure logged · 45 min sample', 'NOMINAL', 'teal'],
              ['11:32:52', 'RAD-MON', 'Daily dose sample recorded · 3.1 mSv', 'CAUTION', 'amber'],
            ].map(([time, tag, text, state, tone]) => <div className="mc-log-row" key={time}>
              <time>{time}</time><strong>{tag}</strong><span>{text}</span><b className={`mc-log-state log-${tone}`}>{state}</b>
            </div>)}
            <div className="mc-log-foot"><span><i /> LOCAL DEMO FEED</span><span>NO LIVE TELEMETRY CONNECTED</span><a href="#overview">BACK TO TOP <ArrowUpRight size={13} /></a></div>
          </section>
          <footer className="mc-footer"><span>SPACE·HEALTH / MISSION CONTROL</span><span>FICTIONAL DEMONSTRATION DATA · NOT FOR MEDICAL OR OPERATIONAL USE</span></footer>
        </section>
      </main>
    </div>
  </div>;
}
