export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight" style={{ fontSize: size }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <rect x="2" y="2" width="28" height="28" rx="8" stroke="rgb(var(--accent))" strokeWidth="2" />
        <path d="M9 21V11l7 6 7-6v10" stroke="rgb(var(--accent))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      Mediary
    </span>
  );
}
