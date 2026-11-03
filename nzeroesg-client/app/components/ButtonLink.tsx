import Link from "next/link";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-6 text-[13px] font-medium uppercase tracking-[0.03em] transition-colors";

const variants = {
  // Inverts with the surface: paper on olive, olive on paper.
  primary: "bg-foreground text-background hover:bg-foreground/85",
  ghost:
    "border border-foreground/60 text-foreground hover:border-foreground hover:bg-foreground/10",
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
