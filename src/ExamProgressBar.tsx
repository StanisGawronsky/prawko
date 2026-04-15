type Props = {
  label: string;
  /** 0 = czas minął, 1 = pełny pozostały czas */
  remainingFraction: number;
  /** Pozostały czas (do obliczenia mm:ss / mm:ss) */
  remainingMs: number;
  /** Całkowity czas fazy (dostępność / a11y) */
  totalMs: number;
};

function formatMs(ms: number): string {
  if (ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function ExamProgressBar({ label, remainingFraction, remainingMs, totalMs }: Props) {
  const pct = Math.min(100, Math.max(0, remainingFraction * 100));
  const elapsedMs = Math.min(totalMs, Math.max(0, totalMs - remainingMs));
  const rangeLabel = `${formatMs(elapsedMs)} / ${formatMs(totalMs)}`;
  return (
    <div className="time-progress">
      <div className="time-progress-head">
        <span>{label}</span>
        <span className="time-progress-time">{rangeLabel}</span>
      </div>
      <div
        className="time-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(elapsedMs)}
        aria-valuemin={0}
        aria-valuemax={totalMs}
        aria-valuetext={`${rangeLabel}, ${label}`}
      >
        <div className="time-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
