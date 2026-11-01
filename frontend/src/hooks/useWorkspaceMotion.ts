import { useEffect, type RefObject } from "react";

// Content stays visible without JavaScript; only cards entering the viewport animate.
export function useWorkspaceMotion(
  root: RefObject<HTMLElement>,
  route: string,
) {
  useEffect(() => {
    const element = root.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const animations = new Set<Animation>();
    const selector =
      ".sign-level-card,.sign-exercise-card,.activity-entry-links>a,.activity-scenario,.sign-word-card,[data-workspace-enter]";
    const observer = new IntersectionObserver(
      (entries) => {
        let index = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          if (preference.matches || !("animate" in entry.target)) continue;
          const animation = entry.target.animate(
            [
              { opacity: 0, translate: "0 18px" },
              { opacity: 1, translate: "0 0" },
            ],
            {
              duration: 420,
              delay: Math.min(index++ * 55, 165),
              easing: "cubic-bezier(.2,.75,.25,1)",
              fill: "backwards",
            },
          );
          animations.add(animation);
          animation.finished.then(
            () => animations.delete(animation),
            () => animations.delete(animation),
          );
        }
      },
      { threshold: 0.08 },
    );
    const observe = (node: Element) => {
      const candidates = [
        ...(node.matches(selector) ? [node] : []),
        ...node.querySelectorAll(selector),
      ];
      for (const card of candidates)
        if (!seen.has(card)) {
          seen.add(card);
          observer.observe(card);
        }
    };
    observe(element);
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes)
          if (node instanceof Element) {
            observer.unobserve(node);
            for (const card of node.querySelectorAll(selector))
              observer.unobserve(card);
          }
        for (const node of record.addedNodes)
          if (node instanceof Element) observe(node);
      }
    });
    mutations.observe(element, { childList: true, subtree: true });
    const cancel = () => {
      if (preference.matches)
        for (const animation of animations) animation.cancel();
    };
    preference.addEventListener("change", cancel);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      preference.removeEventListener("change", cancel);
      for (const animation of animations) animation.cancel();
    };
  }, [root, route]);
}
