import { Leaf } from "lucide-react";

export function LoadingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-accent">
        <Leaf aria-hidden="true" className="h-4 w-4" />
      </div>
      <div className="rounded-2xl border border-border bg-card px-4 py-3">
        <p className="mb-2 text-xs font-semibold text-primary">CarbonSage</p>
        <div className="flex gap-1.5" aria-label="CarbonSage is responding">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
              style={{ animationDelay: `${index * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
