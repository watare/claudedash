interface ProgressBarProps {
  percent: number;
  showLabel?: boolean;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  showLabel = true,
  height = 6,
}) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 bg-[#2B3139] rounded-full overflow-hidden"
        style={{ height }}
        role="progressbar"
        aria-valuenow={clampedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${clampedPercent}%`}
      >
        <div
          className="h-full bg-[#F0B90B] rounded-full transition-all duration-300"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-[#848E9C] w-10 text-right">
          {clampedPercent}%
        </span>
      )}
    </div>
  );
};
