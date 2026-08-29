export function LoadingState({ label = "正在调取案件档案…" }: { label?: string }) {
  return (
    <main className="center-state" aria-busy="true">
      <span className="mechanical-loader" aria-hidden="true" />
      <p role="status">{label}</p>
    </main>
  );
}

