export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-lockup" aria-label="对话标尺">
      <svg
        aria-hidden="true"
        className="brand-symbol"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M5.5 7.5h14v10h-8l-4 3v-3h-2z" />
        <path d="M12.5 13.5h14v10h-2v3l-4-3h-8z" />
        <path d="m16.2 18.4 2.1 2.1 3.9-4.2" />
      </svg>
      {!compact && (
        <span className="brand-copy">
          <strong>对话标尺</strong>
          <small>CONVERSATION QA</small>
        </span>
      )}
    </span>
  );
}
