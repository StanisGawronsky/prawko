type Props = {
  label: string;
  /** 0 = czas minął, 1 = pełny pozostały czas */
  remainingFraction: number;
};

export function ExamProgressBar({ label, remainingFraction }: Props) {
  const pct = Math.min(100, Math.max(0, remainingFraction * 100));
  return (
    <div className="time-progress">
      <div className="time-progress-head">
        <span>{label}</span>
        <span className="time-progress-pct">{Math.ceil(pct)}%</span>
      </div>
      <div className="time-progress-track" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="time-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
