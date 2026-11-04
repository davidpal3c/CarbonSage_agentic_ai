// "Carbon" is set in a dot matrix drawn here (5 x 7 grid, one dot per lit
// cell), so it needs no font licence and scales with the surrounding type.
// "Sage" is set in the page's grotesque (Archivo, OFL).
const GLYPHS: Record<string, readonly string[]> = {
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  b: ["10000", "10000", "10110", "11001", "10001", "11001", "10110"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  n: ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
};

const WORD = "Carbon";
const CELL = 5;
const GAP = 1;
const COLUMNS = WORD.length * CELL + (WORD.length - 1) * GAP;

const dots = [...WORD].flatMap((letter, index) =>
  GLYPHS[letter].flatMap((row, y) =>
    [...row].flatMap((cell, x) =>
      cell === "1" ? [{ cx: index * (CELL + GAP) + x + 0.5, cy: y + 0.5 }] : [],
    ),
  ),
);

export default function BrandWordmark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="CarbonSage"
      className={`brand-wordmark inline-flex items-baseline ${className}`}
    >
      <svg
        viewBox={`0 0 ${COLUMNS} 7`}
        aria-hidden="true"
        className="h-[0.7em] w-auto self-baseline overflow-visible"
        fill="currentColor"
      >
        {dots.map((dot) => (
          <circle
            key={`${dot.cx}-${dot.cy}`}
            cx={dot.cx}
            cy={dot.cy}
            r="0.57"
          />
        ))}
      </svg>
      <span aria-hidden="true" className="brand-wordmark-sage ml-[0.14em]">
        Sage
      </span>
    </span>
  );
}
