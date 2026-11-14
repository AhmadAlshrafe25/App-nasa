import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ExternalLink, Info, Orbit, Radio, ShieldAlert, UsersRound, Wind } from 'lucide-react';
import { Link } from 'wouter';
import { Eyebrow, Panel, SampleBadge } from '@/components/bits';
import { usePageMeta } from '@/hooks/use-page-meta';
import {
  DEMO_MISSION_DAYS,
  EXAMPLE_TRIGGERS,
  HAZARDS,
  RESEARCH_SOURCES,
  SAMPLE_REFERENCE_NOTE,
  getChangedReadings,
  getHazard,
  type HazardId,
  type SampleStatus,
} from '@/lib/hazards';

const HAZARD_ICONS = {
  radiation: ShieldAlert,
  isolation: UsersRound,
  distance: Radio,
  gravity: Orbit,
  environment: Wind,
} satisfies Record<HazardId, typeof ShieldAlert>;

const STATUS_STYLE: Record<SampleStatus, string> = {
  normal: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  warning: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  danger: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
};

function ReadingTile({ label, value, unit, unknown = false }: { label: string; value: string | number; unit?: string; unknown?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3" data-testid={'reading-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={'mt-1 font-mono text-lg ' + (unknown ? 'text-muted-foreground' : 'text-foreground')}>
        {unknown ? 'Unknown' : value} {!unknown && unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </p>
      {unknown && <p className="mt-1 text-[11px] text-muted-foreground">Not included in this sample</p>}
    </div>
  );
}

export default function HazardsPage() {
  usePageMeta('Five hazards', 'Offline NASA HRP and CSA spaceflight hazard guide with fictional example readings.');
  const [selectedDayNumber, setSelectedDayNumber] = useState(DEMO_MISSION_DAYS[0].missionDay);
  const selectedDay = DEMO_MISSION_DAYS.find((day) => day.missionDay === selectedDayNumber) ?? DEMO_MISSION_DAYS[0];
  const changes = getChangedReadings(selectedDay);

  return (
    <div className="space-y-6" data-testid="page-hazards">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>NASA HRP · CSA · Offline reference</Eyebrow>
          <h1 className="mt-2 font-display text-5xl leading-none sm:text-6xl">Five hazards,<br className="sm:hidden" /> clearly explained</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A local guide to the main risks in long missions. This page uses bundled examples only; it does not read sensors or send data.
          </p>
        </div>
        <SampleBadge>Fictional examples</SampleBadge>
      </div>

      <Panel aria-labelledby="sample-day-title" data-testid="section-sample-days">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Eyebrow>Illustrative mission log</Eyebrow>
            <h2 id="sample-day-title" className="mt-1 font-display text-3xl">Three example days</h2>
          </div>
          <span className={'rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider ' + STATUS_STYLE[selectedDay.status]}
            data-testid="badge-sample-status">{selectedDay.statusLabel}</span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground" aria-live="polite" data-testid="text-sample-explanation">
          Day {selectedDay.missionDay}: {selectedDay.statusExplanation}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Choose a fictional mission day">
          {DEMO_MISSION_DAYS.map((day) => (
            <button key={day.missionDay} type="button" aria-pressed={selectedDayNumber === day.missionDay}
              onClick={() => setSelectedDayNumber(day.missionDay)}
              className={'min-h-14 rounded-xl border px-2 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ' +
                (selectedDayNumber === day.missionDay ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:bg-muted/70')}
              data-testid={'button-day-' + day.missionDay}>
              <span className="block text-sm font-medium">Day {day.missionDay}</span>
              <span className="block text-xs text-muted-foreground">{day.statusLabel}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Sample readings">
          <ReadingTile label="Heart rate" value={selectedDay.readings.heartRateBpm} unit="bpm" />
          <ReadingTile label="SpO₂" value={selectedDay.readings.spo2Percent.toFixed(1)} unit="%" />
          <ReadingTile label="Sleep" value={selectedDay.readings.sleepHours.toFixed(1)} unit="hours" />
          <ReadingTile label="Stress" value={selectedDay.readings.stressScore} unit="/ 10" />
          <ReadingTile label="Radiation" value={selectedDay.readings.radiationMsvDay.toFixed(2)} unit="mSv / day" />
          <ReadingTile label="Cabin CO₂" value={selectedDay.readings.cabinCo2Ppm} unit="ppm · sample" />
          <ReadingTile label="Blood pressure" value="" unknown={selectedDay.readings.bloodPressure === null} />
          <ReadingTile label="Isolation" value="" unknown={selectedDay.readings.isolationLevel === null} />
        </div>

        <div className="mt-4 grid gap-3 rounded-xl border border-border/70 bg-background/40 p-4 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Radiation source:</span> {selectedDay.readings.radiationSource}</p>
          <p><span className="text-muted-foreground">Gravity phase:</span> {selectedDay.gravityPhase}</p>
          <p><span className="text-muted-foreground">One-way delay:</span> {selectedDay.readings.commDelayMinutes} minutes · simulated</p>
          <p><span className="text-muted-foreground">Data source:</span> fictional sample row, not live telemetry</p>
        </div>

        <div className="mt-4 rounded-xl border border-border/70 bg-background/35 p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-sm font-semibold">What changed from the previous sample?</h3>
          </div>
          {changes.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">This is the first sample day, so there is no earlier reading to compare.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="list-reading-changes">
              {changes.map((change) => {
                const ChangeIcon = change.change.startsWith('+') ? ArrowUpRight : ArrowDownRight;
                return (
                  <li key={change.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{change.label}: <span className="text-foreground">{change.before} → {change.after}</span></span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-foreground"><ChangeIcon className="h-3 w-3" aria-hidden="true" />{change.change}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {selectedDay.primaryHazards.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Source example associates this day with: {selectedDay.primaryHazards.map((id) => getHazard(id)?.title).filter(Boolean).join(' · ')}.
            </p>
          )}
        </div>
      </Panel>

      <section aria-labelledby="hazard-list-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <Eyebrow>RIDGE framework</Eyebrow>
            <h2 id="hazard-list-title" className="mt-1 font-display text-3xl">The five spaceflight hazards</h2>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">Reference cards · no live sensor data</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {HAZARDS.map((hazard) => {
            const Icon = HAZARD_ICONS[hazard.id];
            return (
              <Panel key={hazard.id} aria-labelledby={'hazard-title-' + hazard.id} data-testid={'hazard-card-' + hazard.id} className="h-full">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/70 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <Eyebrow>Hazard {hazard.number}</Eyebrow>
                    <h3 id={'hazard-title-' + hazard.id} className="mt-1 font-display text-2xl">{hazard.title}</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{hazard.summary}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">What to observe</h4>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {hazard.indicators.map((indicator) => <li key={indicator} className="flex gap-2"><span className="text-primary" aria-hidden="true">•</span>{indicator}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Why it matters</h4>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {hazard.possibleEffects.map((effect) => <li key={effect} className="flex gap-2"><span className="text-accent" aria-hidden="true">•</span>{effect}</li>)}
                    </ul>
                  </div>
                </div>
                <p className="mt-4 rounded-lg border border-border/70 bg-background/45 p-3 text-sm leading-relaxed">
                  <span className="font-semibold text-foreground">Demo response: </span><span className="text-muted-foreground">{hazard.demoResponse}</span>
                </p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {hazard.sourceIds.map((sourceId) => {
                    const source = RESEARCH_SOURCES[sourceId];
                    return <a key={sourceId} href={source.href} target="_blank" rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                      data-testid={'link-source-' + sourceId}>
                      {source.title}<ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>;
                  })}
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <Panel aria-labelledby="trigger-title" data-testid="section-example-triggers">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Example rules only</Eyebrow>
            <h2 id="trigger-title" className="mt-1 font-display text-3xl">Signals that may prompt a review</h2>
          </div>
          <SampleBadge>Not validated limits</SampleBadge>
        </div>
        <ul className="mt-4 divide-y divide-border/70" data-testid="list-example-triggers">
          {EXAMPLE_TRIGGERS.map((trigger) => (
            <li key={trigger.label} className="grid gap-1 py-3 text-sm sm:grid-cols-[170px_1fr]">
              <strong>{trigger.label}</strong>
              <span className="text-muted-foreground">{trigger.example}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-relaxed text-muted-foreground" data-testid="text-threshold-disclaimer">
          {SAMPLE_REFERENCE_NOTE} Sample labels above are copied from the supplied fictional records. They are not produced by a medical model.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          For a private demonstration check-in, open <Link href="/check-in" className="text-primary underline underline-offset-4">Check-in</Link>. No data is sent from this reference page.
        </p>
      </Panel>

      <Panel aria-labelledby="sources-title" data-testid="section-research-sources">
        <Eyebrow>Source list</Eyebrow>
        <h2 id="sources-title" className="mt-1 font-display text-3xl">NASA and CSA references</h2>
        <p className="mt-2 text-sm text-muted-foreground">These links are provided for background reading. The example bands above are from the supplied project brief, not official operational standards.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(RESEARCH_SOURCES).map(([id, source]) => (
            <li key={id}>
              <a href={source.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />{source.label}
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
