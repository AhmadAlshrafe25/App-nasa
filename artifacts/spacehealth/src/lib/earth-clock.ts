// Always use Eastern civil time, including daylight-saving transitions.
const easternFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'short',
});

export function formatEasternClock(now: Date): string {
  return easternFormatter.format(now);
}
