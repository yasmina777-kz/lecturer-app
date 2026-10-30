import { useEffect, useRef } from "react";

/** Decorative projected particle orbits; no audio or lecture state lives here. */
export function ParticleField({ paused = false }: { paused?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1,
      height = 1,
      frame = 0,
      elapsed = phase.current,
      previous = 0,
      visible = true;
    let light = document.documentElement.dataset.theme === "light";
    let seed = 41;
    const random = () =>
      ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const points = Array.from({ length: 2100 }, () => {
      const angle = random() * Math.PI * 2;
      const tube = random() * Math.PI * 2;
      const radius = 0.83 + Math.cos(tube) * 0.16;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(tube) * 0.18,
        z: Math.sin(angle) * radius,
        gold: random() > 0.61,
        size: 0.4 + random() * 1.15,
      };
    });
    const stars = Array.from({ length: 95 }, () => ({
      x: random(),
      y: random(),
      size: 0.4 + random(),
      phase: random() * 6,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      stars.forEach((p) => {
        ctx.fillStyle = light
          ? `rgba(112,97,75,${0.22 + 0.15 * Math.sin(elapsed + p.phase)})`
          : `rgba(188,218,245,${0.35 + 0.2 * Math.sin(elapsed + p.phase)})`;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      const turn = elapsed * 0.11;
      const scale = Math.min(width * 0.47, height * 0.46);
      points.forEach((p) => {
        const rx = p.x * Math.cos(turn) - p.z * Math.sin(turn);
        const rz = p.x * Math.sin(turn) + p.z * Math.cos(turn);
        const y = p.y * 0.62 - rz * 0.79;
        const z = p.y * 0.79 + rz * 0.62;
        const x = rx * 0.9 - y * 0.43;
        const tiltedY = rx * 0.43 + y * 0.9;
        const perspective = 2.8 / (2.8 + z);
        const opacity = 0.25 + (z + 1) * 0.29;
        ctx.fillStyle = light
          ? p.gold
            ? `rgba(157,106,33,${opacity})`
            : `rgba(132,119,92,${opacity})`
          : p.gold
            ? `rgba(244,195,111,${opacity})`
            : `rgba(155,210,255,${opacity})`;
        ctx.beginPath();
        ctx.arc(
          width / 2 + x * scale * perspective,
          height / 2 + tiltedY * scale * perspective,
          p.size * perspective,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
    };
    const running = () =>
      !paused && !reduced.matches && visible && !document.hidden;
    const tick = (now: number) => {
      if (!running()) {
        frame = 0;
        previous = 0;
        return;
      }
      if (!previous || now - previous >= 32) {
        elapsed += previous ? Math.min((now - previous) / 1000, 0.06) : 0;
        phase.current = elapsed;
        previous = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      draw();
      if (running()) frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      sync();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const theme = new MutationObserver(() => {
      light = document.documentElement.dataset.theme === "light";
      draw();
    });
    resize.observe(element);
    intersection.observe(element);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      theme.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused]);
  return <canvas ref={canvas} className="nova-particles" aria-hidden="true" />;
}
