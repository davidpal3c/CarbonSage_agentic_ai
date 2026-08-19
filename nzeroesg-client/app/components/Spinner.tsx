import { LoaderCircle } from "lucide-react";

export function Spinner({
  className = "h-4 w-4",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center"
    >
      <LoaderCircle
        aria-hidden="true"
        className={`${className} animate-spin`}
      />
    </span>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex min-h-24 items-center justify-center text-muted-foreground"
    >
      <Spinner className="h-5 w-5" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
