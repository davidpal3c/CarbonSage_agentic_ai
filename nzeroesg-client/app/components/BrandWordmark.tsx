export default function BrandWordmark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span className={`brand-wordmark ${className}`} aria-label="CarbonSage">
      Carbon<span className="brand-wordmark-sage">Sage</span>
    </span>
  );
}
