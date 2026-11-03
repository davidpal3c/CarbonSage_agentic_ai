import BrandMark from "@/app/components/BrandMark";
import BrandWordmark from "@/app/components/BrandWordmark";

const sizes = {
  // Hero-scale: sign-in and other brand moments.
  large: { mark: "h-10 w-10", word: "text-[28px]", gap: "gap-3" },
  // Headers, sidebar and footer.
  compact: { mark: "h-6 w-6", word: "text-[16px]", gap: "gap-2" },
} as const;

/**
 * Large and compact lockups pair the mark with the wordmark; "mark" is the
 * mark alone, with the accessible name carried here because the mark itself is
 * decorative. Place a lockup inside a link and name the link instead.
 */
export default function BrandLockup({
  variant = "compact",
  className = "",
  markClassName = "",
  wordmarkClassName = "",
}: {
  variant?: "large" | "compact" | "mark";
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  if (variant === "mark") {
    return (
      <span role="img" aria-label="CarbonSage" className={className}>
        <BrandMark className={`h-7 w-7 ${markClassName}`} />
      </span>
    );
  }
  const size = sizes[variant];
  return (
    <span className={`inline-flex items-center ${size.gap} ${className}`}>
      <BrandMark className={`${size.mark} shrink-0 ${markClassName}`} />
      <BrandWordmark className={`${size.word} ${wordmarkClassName}`} />
    </span>
  );
}
