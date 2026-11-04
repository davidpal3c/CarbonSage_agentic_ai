"use client";

import { useEffect, useRef } from "react";

import { evidenceStory } from "@/app/lib/evidence-trail";

/**
 * One centred evidence journey. A line runs down the middle of the section; a
 * pointer (the mark's carbon node) travels it with the scroll position, and the
 * step it has reached is emphasised. Without JavaScript, or under
 * prefers-reduced-motion, the same four steps render in reading order with the
 * line fully drawn, no pointer and no dimming: the story is content first and
 * motion second.
 */
export default function ScrollStory() {
  const root = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let queued = false;
    const update = () => {
      queued = false;
      const rect = el.getBoundingClientRect();
      // The pointer sits at the viewport's vertical centre, clamped to the line.
      const y = Math.max(0, Math.min(rect.height, window.innerHeight * 0.5 - rect.top));
      el.style.setProperty("--pointer", `${y.toFixed(1)}px`);
      // The state lives on the DOM (data attributes), not in React: it only
      // drives presentation, and updating it must not re-render the story.
      const steps = Array.from(el.children) as HTMLElement[];
      let next = 0;
      steps.forEach((step, index) => {
        if (step.offsetTop + 24 <= y) next = index;
      });
      steps.forEach((step, index) => {
        step.dataset.active = index === next ? "true" : "false";
      });
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    el.dataset.live = "true";
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      delete el.dataset.live;
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, []);

  return (
    <ol
      ref={root}
      className="story relative py-4"
      style={{ "--pointer": "0px" } as React.CSSProperties}
    >
      {/* The line, its drawn part, and the pointer. Decorative. */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-4 top-0 w-px bg-spine lg:left-1/2"
      />
      <span
        aria-hidden="true"
        className="story-fill absolute left-4 top-0 w-0.5 -translate-x-1/2 bg-accent lg:left-1/2"
      />
      <span
        aria-hidden="true"
        className="story-pointer absolute left-4 top-0 hidden h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-accent shadow-[0_0_0_1px_var(--accent)] lg:left-1/2"
      />

      {evidenceStory.map((step, index) => (
        <li
          key={step.kicker}
          className="story-step relative grid gap-3 pb-16 pl-12 last:pb-4 lg:grid-cols-2 lg:gap-x-24 lg:pb-28 lg:pl-0"
        >
          <p
            className={`flex items-baseline gap-2 ${
              index % 2 === 0 ? "lg:col-start-1 lg:justify-end lg:text-right" : "lg:col-start-2"
            }`}
          >
            <span className="story-num display-light text-[clamp(2rem,3.4vw,3rem)] text-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm text-muted-foreground">/04</span>
          </p>
          <div
            className={`max-w-[30rem] ${
              index % 2 === 0
                ? "lg:col-start-1 lg:justify-self-end lg:text-right"
                : "lg:col-start-2"
            }`}
          >
            <p className="rail-label text-accent">{step.kicker}</p>
            <h3 className="mt-3 text-[clamp(1.25rem,2vw,1.625rem)] font-light leading-snug tracking-[-0.01em] text-foreground">
              {step.title}
            </h3>
            <p className="mt-2 text-[14px] leading-5 text-accent">{step.summary}</p>
            <p className="mt-3 font-serif text-[16px] leading-6 text-muted-foreground">
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
