import { AlertTriangle } from "lucide-react";

import { Button } from "./button";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main className="center-state" role="alert">
      <AlertTriangle aria-hidden="true" size={24} />
      <h1>档案读取中断</h1>
      <p>{message}</p>
      {onRetry ? <Button onClick={onRetry}>重新调取</Button> : null}
    </main>
  );
}

