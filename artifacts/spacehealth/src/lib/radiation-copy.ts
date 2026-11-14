import type { RadiationAnalysis } from './radiation';

/** Plain-language comparisons, deliberately separate from any safety judgement. */
export function describeRadiation(analysis: RadiationAnalysis) {
  if (analysis.status === 'unavailable') {
    return { value: 'Unknown', unit: '', status: 'No reading available', comparison: 'Cannot check radiation', unknown: true };
  }
  if (analysis.status === 'insufficient') {
    return { value: 'Unknown', unit: '', status: 'More readings needed', comparison: 'Not enough data to compare', unknown: true };
  }
  const ratio = analysis.baseline !== null && analysis.baseline > 0 && analysis.doseRate !== null
    ? analysis.doseRate / analysis.baseline : null;
  return {
    value: ratio === null ? (analysis.status === 'spike' ? 'Rise' : 'No rise') : ratio.toFixed(1),
    unit: ratio === null ? '' : '×',
    status: analysis.status === 'spike' ? 'Higher than usual' : 'No unusual rise',
    comparison: ratio === null ? 'Compared with earlier samples' : 'the usual sample level',
    unknown: false,
  };
}
