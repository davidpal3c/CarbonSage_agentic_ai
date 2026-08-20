"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

export function AnimatedNumber({
  value,
  maximumFractionDigits = 0,
  suffix = "",
}: {
  value: number;
  maximumFractionDigits?: number;
  suffix?: string;
}) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits,
        minimumFractionDigits: maximumFractionDigits,
      }),
    [maximumFractionDigits],
  );
  const [display, setDisplay] = useState(() =>
    formatter.format(motionValue.get()),
  );

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(formatter.format(latest)),
    });
    return () => controls.stop();
  }, [formatter, motionValue, reduceMotion, value]);

  const finalValue = `${formatter.format(value)}${suffix}`;
  const visibleValue = reduceMotion ? formatter.format(value) : display;
  return (
    <span className="tabular-nums">
      <span className="sr-only">{finalValue}</span>
      <span aria-hidden="true">
        {visibleValue}
        {suffix}
      </span>
    </span>
  );
}
