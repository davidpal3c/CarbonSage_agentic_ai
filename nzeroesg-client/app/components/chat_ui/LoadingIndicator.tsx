import BrandMark from "@/app/components/BrandMark";

export function LoadingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <BrandMark className="h-9 w-9" />
      <div className="rounded-2xl border border-border bg-transparent px-4 py-3 shadow-sm">
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
