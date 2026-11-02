import { useId } from "react";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

export default function BrandMark({
  className = "h-8 w-8",
  title,
}: BrandMarkProps) {
  const maskId = `carbonsage-leaf-${useId().replaceAll(":", "")}`;

  return (
    <svg
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 text-[#4a4465] dark:text-[#9fcbad] ${className}`}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="24"
          height="24"
        >
          <rect width="24" height="24" fill="white" />
          <path
            d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
            fill="none"
            stroke="black"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
            fill="none"
            stroke="black"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="12"
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
