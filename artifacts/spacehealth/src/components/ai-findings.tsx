import { useCallback, useEffect, useState } from 'react';
import type { Dashboard, MetricComparison } from '@workspace/api-client-react';
import { getDashboard } from '@/lib/space-api';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; dashboard: Dashboard }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

const metricLabels: Record<string, string> = {
  heart_rate_bpm: 'Heart rate', sleep_hours: 'Sleep', stress_score: 'Stress', radiation_msv: 'Radiation (mSv)',
};

const statusLabels: Record<MetricComparison['status'], string> = {
  within_range: 'Within own range', elevated: 'Elevated', markedly_elevated: 'Markedly elevated',
  reduced: 'Reduced', markedly_reduced: 'Markedly reduced', insufficient_history: 'Not enough history',
};

export function AiFindings() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const result = await getDashboard();
    if (result.status === 'ok') setState({ kind: 'ok', dashboard: result.data });
    else if (result.status === 'offline') setState({ kind: 'offline' });
    else setState({ kind: 'error', message: result.message });
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <section className="ai-findings" aria-label="Statistical findings" data-testid="section-ai-findings">
    <h4>Health trends</h4>
    <p className="ai-note">Sample history · not a diagnosis.</p>
    {state.kind === 'loading' && <p role="status" data-testid="status-ai-loading">Loading findings…</p>}
    {state.kind === 'offline' && <div role="status" data-testid="status-ai-offline">
      <p>Trends unavailable. Check your connection.</p>
      <button type="button" className="care-btn" onClick={() => void load()} data-testid="button-ai-retry">Retry</button>
    </div>}
    {state.kind === 'error' && <div role="alert" data-testid="status-ai-error">
      <p>Could not load findings: {state.message}</p>
      <button type="button" className="care-btn" onClick={() => void load()} data-testid="button-ai-retry">Retry</button>
    </div>}
    {state.kind === 'ok' && <Findings dashboard={state.dashboard} />}
  </section>;
}

function Findings({ dashboard }: { dashboard: Dashboard }) {
  const forest = dashboard.isolation_forest;
  return <>
    <p className="ai-risk" data-testid="text-ai-risk">Overall: {dashboard.risk_level}</p>
    <details><summary>Pattern details</summary>
    <h5>Unusual readings</h5>
    {forest.available && forest.anomaly_score !== null && forest.anomaly_score !== undefined
      ? <p data-testid="text-forest-result">Score <strong data-testid="text-forest-score">{forest.anomaly_score.toFixed(3)}</strong> · Outlier: <strong data-testid="text-forest-outlier">{forest.is_outlier ? 'yes' : 'no'}</strong></p>
      : <p data-testid="text-forest-unavailable">Not available. {forest.note}</p>}
    {forest.available && <p className="ai-note">{forest.note}</p>}

    <h5>Compared with your usual range</h5>
    <table className="readings-table" data-testid="table-baseline-comparison"><thead><tr><th>Metric</th><th>Z-score</th><th>Status</th></tr></thead><tbody>
      {Object.entries(dashboard.baseline_comparison).map(([key, item]) => <tr key={key} data-testid={`row-baseline-${key}`}>
        <td>{metricLabels[key] ?? key}</td>
        <td>{item.z_score === null || item.z_score === undefined ? 'No baseline' : item.z_score.toFixed(2)}</td>
        <td>{statusLabels[item.status] ?? item.status}</td>
      </tr>)}
    </tbody></table>

    </details>
    <h5>Recent changes</h5>
    {dashboard.trend_alerts.length
      ? <ul data-testid="list-trend-alerts">{dashboard.trend_alerts.map(alert => <li key={alert}>{alert}</li>)}</ul>
      : <p data-testid="text-trend-none">No 3-day trend alerts from the logs checked.</p>}

    <details><summary>Why this was flagged</summary>
    <ul data-testid="list-ai-reasons">{dashboard.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    </details>
    <h5>Next steps</h5>
    <ul data-testid="list-ai-actions">{dashboard.recommended_actions.map(action => <li key={action}>{action}</li>)}</ul>
  </>;
}
