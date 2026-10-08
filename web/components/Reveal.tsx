"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends HTMLElement>(threshold = 0.25): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0, rootMargin: `0px 0px -${Math.round(threshold * 30)}% 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

export function Reveal({ children, className = "rv", delay = 0, style }: { children: ReactNode; className?: "rv" | "mask" | string; delay?: number; style?: CSSProperties }) {
  // the observed wrapper is never clipped (a clipped target can report no intersection)
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  return (
    <div ref={ref}>
      <div className={className} data-in={seen} style={{ transitionDelay: `${delay}ms`, ...style }}>
        {children}
      </div>
    </div>
  );
}
