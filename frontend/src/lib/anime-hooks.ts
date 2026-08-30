"use client";

import { useEffect, useRef, useCallback } from "react";
import { animate, stagger, spring, onScroll, createLayout } from "animejs";

/* ─── Staggered reveal on scroll (using anime.js onScroll) ─── */
export function useAnimeReveal(options?: { delay?: number; staggerMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!ref.current || played.current) return;
    const el = ref.current;
    played.current = true;

    const children = el.querySelectorAll("[data-reveal]");
    if (children.length === 0) {
      animate(el, {
        opacity: [0, 1],
        translateY: [30, 0],
        duration: 800,
        delay: options?.delay ?? 0,
        ease: "outQuart",
        autoplay: onScroll({ target: el, enter: "100%" }),
      });
    } else {
      animate(children, {
        opacity: [0, 1],
        translateY: [40, 0],
        duration: 700,
        delay: stagger(options?.staggerMs ?? 80),
        ease: "outExpo",
        autoplay: onScroll({ target: el, enter: "100%" }),
      });
    }
  }, [options?.delay, options?.staggerMs]);

  return ref;
}

/* ─── Number counter (using anime.js onScroll) ─── */
export function useAnimeCounter(target: number, options?: { duration?: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!ref.current || played.current) return;
    const el = ref.current;
    played.current = true;

    const obj = { val: 0 };
    animate(obj, {
      val: target,
      duration: options?.duration ?? 1500,
      ease: "outExpo",
      onUpdate: () => {
        if (el) {
          el.textContent = options?.decimals
            ? obj.val.toFixed(options.decimals)
            : Math.round(obj.val).toLocaleString();
        }
      },
      autoplay: onScroll({ target: el, enter: "100%" }),
    });
  }, [target, options?.duration, options?.decimals]);

  return ref;
}

/* ─── Hover scale spring ─── */
export function useAnimeHover() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const enter = () => {
      animate(el, {
        scale: [1, 1.03],
        translateY: [0, -3],
        duration: 400,
        ease: spring({ stiffness: 400, damping: 20 }),
      });
    };
    const leave = () => {
      animate(el, {
        scale: [1.03, 1],
        translateY: [-3, 0],
        duration: 350,
        ease: spring({ stiffness: 300, damping: 25 }),
      });
    };

    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
    };
  }, []);

  return ref;
}

/* ─── Magnetic button ─── */
export function useAnimeMagnetic(strength = 0.3) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const move = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      animate(el, { translateX: x, translateY: y, duration: 200, ease: "outQuad" });
    };
    const leave = () => {
      animate(el, { translateX: 0, translateY: 0, duration: 500, ease: spring({ stiffness: 250, damping: 15 }) });
    };

    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    };
  }, [strength]);

  return ref;
}

/* ─── Staggered list (using anime.js onScroll) ─── */
export function useAnimeStagger() {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  const trigger = useCallback(() => {
    if (!ref.current || played.current) return;
    played.current = true;
    const items = ref.current.querySelectorAll("[data-stagger]");
    if (items.length === 0) return;

    animate(items, {
      opacity: [0, 1],
      translateX: [-20, 0],
      duration: 500,
      delay: stagger(60),
      ease: "outExpo",
    });
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    animate(el, {
      opacity: [0, 1],
      duration: 1,
      autoplay: onScroll({
        target: el,
        enter: "100%",
        onEnterForward: () => trigger(),
      }),
    });
  }, [trigger]);

  return { ref, trigger };
}

/* ─── Text scramble using anime.js built-in scrambleText ─── */
export function useAnimeScramble(finalText: string, options?: { duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    import("animejs").then(({ scrambleText }) => {
      animate(el, {
        innerHTML: scrambleText({ text: finalText, from: "left", ease: "outExpo" }),
        duration: options?.duration ?? 1500,
        ease: "outExpo",
        autoplay: onScroll({ target: el, enter: "100%" }),
      });
    });
  }, [finalText, options?.duration]);

  return ref;
}

/* ─── Layout-aware container for animated reordering ─── */
export function useAnimeLayout(selector: string) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const layout = createLayout(el, {
      children: selector,
      duration: 400,
      ease: "outExpo",
    });

    layout.record();

    return () => {
      layout.revert();
    };
  }, [selector]);

  return ref;
}
