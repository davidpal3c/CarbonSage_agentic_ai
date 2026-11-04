"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A clipped frame whose contents drift a bounded distance as it crosses the
 * viewport (restrained parallax). The child is oversized by `range` px on each
 * side so the drift never exposes an edge. The caller positions the frame
 * (`relative` or `absolute`). Nothing moves under
 * prefers-reduced-motion, and the content is rendered either way: motion only
 * changes a transform, never what is shown or its order.
 */
export default function Parallax({
  children,
  range = 36,
  className = "",
}: {
  children: ReactNode;
  range?: number;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frameEl = frame.current;
    const layerEl = layer.current;
    if (!frameEl || !layerEl) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    let visible = false;
    let queued = false;
    let animationFrame = 0;

    const update = () => {
      queued = false;
      const rect = frameEl.getBoundingClientRect();
      const viewport = window.innerHeight;
      // -1 as the frame enters at the bottom, +1 as it leaves at the top.
      const progress =
        (rect.top + rect.height / 2 - viewport / 2) /
        ((viewport + rect.height) / 2);
      const clamped = Math.max(-1, Math.min(1, progress));
      layerEl.style.transform = `translate3d(0, ${(-clamped * range).toFixed(1)}px, 0)`;
    };
    const queue = () => {
      if (!visible || queued || motionPreference.matches) return;
      queued = true;
      animationFrame = requestAnimationFrame(update);
    };
    const syncMotion = () => {
      if (motionPreference.matches) {
        cancelAnimationFrame(animationFrame);
        queued = false;
        layerEl.style.transform = "";
      } else {
        queue();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) queue();
      },
      { rootMargin: "20% 0px" },
    );
    observer.observe(frameEl);
    motionPreference.addEventListener("change", syncMotion);
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      motionPreference.removeEventListener("change", syncMotion);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [range]);

  return (
    <div ref={frame} className={`overflow-hidden ${className}`}>
      <div
        ref={layer}
        className="absolute inset-x-0 will-change-transform"
        style={{ top: -range, bottom: -range }}
      >
        {children}
      </div>
    </div>
  );
}
