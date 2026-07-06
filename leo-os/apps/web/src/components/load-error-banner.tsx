import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadErrorBanner({
  message = "Couldn't load data. Check your connection and try again.",
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retry"}
      </Button>
    </div>
  );
}
