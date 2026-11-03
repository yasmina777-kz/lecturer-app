import { useEffect, useRef, useState } from "react";

/** Five independently folding glass ribbons; the portrait is a separate, still layer. */
export function LandingWaves({ paused }: { paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const gl = element.getContext("webgl", {
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    if (!gl) return;
    let frame = 0;
    let visible = true;
    let elapsed = 0;
    let previous = 0;
    let dirty = true;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0 };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const vertex = gl.createShader(gl.VERTEX_SHADER)!;
    const fragment = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(
      vertex,
      `
      attribute vec2 position;
      varying vec2 uv;
      varying mediump vec3 surfaceNormal;
      varying mediump vec3 surfacePosition;
      uniform mediump float time;
      uniform mediump float layer;
      uniform vec2 pointer;
      vec3 surface(vec2 st) {
        float u = st.x;
        float v = st.y * 2.0 - 1.0;
        float phase = layer * 1.65;
        float growth = smoothstep(.12, .78, u);
        // Unequal travelling folds, rather than a shared central hill.
        float sweep = sin(u * 9.2 - time * .43 + phase) * .25
          + sin(u * 15.1 + time * .29 + phase * 1.7) * .1;
        float rightLift = smoothstep(.48, .98, u)
          * (.73 - layer * .14 + .1 * sin(time * .33 + phase));
        // A smaller, independently moving fold balances the tall right-hand ribbons.
        float leftFold = exp(-pow((u - .2 - .035 * sin(time * .27 + phase)) / .16, 2.0))
          * smoothstep(.035, .13, u);
        float leftLift = leftFold * (.25 - layer * .035 + .055 * sin(time * .37 + phase));
        vec3 center = vec3(
          -1.04 + u * 2.22,
          -.69 + growth * (.32 + sweep) + rightLift + leftLift,
          sin(u * 5.0 + time * .36 + phase) * .28 + layer * .12
        );
        float width = (.008 * sin(u * 3.14159) + .36 * growth + .11 * leftFold) * (1.0 - .28 * layer);
        float twist = sin(u * 6.3 - time * .38 + phase) * 1.1
          + sin(u * 11.0 + time * .23 + phase) * .3 + layer * .5;
        vec3 across = vec3(.12 * sin(twist), cos(twist), sin(twist));
        vec3 p = center + across * v * width;
        // Curved cross-section produces a broad, moving fold with a fine glass lip.
        p.z += (1.0 - v * v) * width * (.65 + .3 * sin(u * 6.0 + time * .5));
        p.y += sin(v * 2.2 + u * 5.0 - time * .46) * .035 * growth;
        p.xy += pointer * growth * .045;
        return p;
      }
      void main() {
        uv = position;
        vec3 p = surface(position);
        vec3 tangent = surface(position + vec2(.002, 0.0)) - surface(position - vec2(.002, 0.0));
        vec3 across = surface(position + vec2(0.0, .002)) - surface(position - vec2(0.0, .002));
        surfaceNormal = normalize(cross(tangent, across));
        surfacePosition = p;
        gl_Position = vec4(p.xy, p.z * .2, 1.0);
      }
    `,
    );
    gl.shaderSource(
      fragment,
      `
      precision mediump float;
      varying vec2 uv;
      varying mediump vec3 surfaceNormal;
      varying mediump vec3 surfacePosition;
      uniform float time;
      uniform float layer;
      void main() {
        vec3 n = normalize(surfaceNormal);
        if (n.z < 0.0) n = -n;
        vec3 view = normalize(vec3(-surfacePosition.xy * .12, 1.0));
        vec3 reflection = reflect(-view, n);
        float fresnel = pow(1.0 - max(dot(n, view), 0.0), 3.0);
        float diffuse = .64 + .36 * max(dot(n, normalize(vec3(-.4,.8,1.0))), 0.0);
        vec3 blue = mix(vec3(.32,.49,.84), vec3(.64,.76,.98), uv.y);
        float rose = exp(-pow((uv.x - .64 - .13 * sin(time * .28 + layer)) / .14, 2.0));
        blue = mix(blue, vec3(.85,.65,.83), rose * .32);
        vec3 color = blue * diffuse;
        // Reflections of two wide studio lights and a thin rim on curved glass.
        float softbox = exp(-pow((reflection.x + .42) / .33, 2.0) - pow((reflection.y - .48) / .85, 2.0));
        float strip = exp(-pow((reflection.y - .36 - reflection.x * .3) / .055, 2.0));
        float edge = pow(abs(uv.y * 2.0 - 1.0), 22.0);
        color = mix(color, vec3(.91,.95,1.0), softbox * .68);
        color += vec3(.21,.22,.24) * strip + vec3(.12,.14,.18) * fresnel;
        color = mix(color, vec3(.89,.93,1.0), edge * .56);
        float alpha = smoothstep(.04,.14,uv.x) * (1.0-smoothstep(.96,1.0,uv.x));
        alpha *= smoothstep(0.0,.018,uv.y) * (1.0-smoothstep(.982,1.0,uv.y));
        alpha *= .88 + fresnel * .1;
        gl_FragColor = vec4(color * alpha, alpha);
      }
    `,
    );
    gl.compileShader(vertex);
    gl.compileShader(fragment);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const points: number[] = [];
    // Extra ribbons share the previous total vertex budget.
    const columns = 128;
    const rows = 24;
    const layers = [0, 0.5, 1, 1.5, 2];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < columns; x++) {
        const a = x / columns,
          b = y / rows,
          c = (x + 1) / columns,
          d = (y + 1) / rows;
        points.push(a, b, c, b, a, d, a, d, c, b, c, d);
      }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, "time");
    const pointerUniform = gl.getUniformLocation(program, "pointer");
    const layerUniform = gl.getUniformLocation(program, "layer");
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (!visible || document.hidden) return;
      const moving = !pausedRef.current && !reduced.matches;
      if (!moving && !dirty) return;
      if (moving) {
        elapsed += delta;
        pointer.vx +=
          ((pointer.targetX - pointer.x) * 42 - pointer.vx * 13) * delta;
        pointer.vy +=
          ((pointer.targetY - pointer.y) * 42 - pointer.vy * 13) * delta;
        pointer.x += pointer.vx * delta;
        pointer.y += pointer.vy * delta;
      }
      dirty = false;
      gl.uniform1f(time, elapsed);
      gl.uniform2f(pointerUniform, pointer.x, pointer.y);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (const layer of layers) {
        gl.uniform1f(layerUniform, layer);
        gl.drawArrays(gl.TRIANGLES, 0, points.length / 2);
      }
    };
    const resize = new ResizeObserver(() => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.round(element.clientWidth * scale);
      element.height = Math.round(element.clientHeight * scale);
      gl.viewport(0, 0, element.width, element.height);
      dirty = true;
    });
    resize.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersection.observe(element);
    const hero = element.closest(".mentor-hero");
    const onPointerMove = (event: Event) => {
      const e = event as PointerEvent;
      if (
        e.pointerType !== "mouse" ||
        pausedRef.current ||
        reduced.matches ||
        !hero
      )
        return;
      const bounds = hero.getBoundingClientRect();
      pointer.targetX = ((e.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointer.targetY = -((e.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    const onPointerLeave = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    };
    hero?.addEventListener("pointermove", onPointerMove, { passive: true });
    hero?.addEventListener("pointerleave", onPointerLeave);
    setReady(true);
    frame = requestAnimationFrame(render);
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      setReady(false);
    };
    element.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      hero?.removeEventListener("pointermove", onPointerMove);
      hero?.removeEventListener("pointerleave", onPointerLeave);
      element.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);
  return (
    <div
      className={`landing-waves${ready ? " is-ready" : ""}`}
      aria-hidden="true"
    >
      <img
        src="/images/landing-v2/blue-ribbon.webp"
        alt=""
        style={{ opacity: ready ? 0 : 1 }}
      />
      <canvas ref={canvas} style={{ opacity: ready ? 1 : 0 }} />
    </div>
  );
}
