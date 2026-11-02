import Link from "next/link";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-5 text-[15px] font-semibold transition-colors";

const variants = {
  primary: "bg-secondary text-white hover:bg-secondary/90",
  ghost:
    "border-[1.5px] border-foreground text-foreground hover:bg-foreground hover:text-background",
  onBand: "bg-secondary text-white hover:bg-secondary/90",
} as const;

export default function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}
