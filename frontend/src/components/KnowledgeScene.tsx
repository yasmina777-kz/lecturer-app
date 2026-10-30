import { useEffect, useRef } from "react";

/** A real WebGL scene, loaded only when its section approaches the viewport. */
export function KnowledgeScene({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pause = useRef(paused);
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    pause.current = paused;
    refresh.current();
  }, [paused]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false,
      started = false;
    let cleanup = () => {};
    const load = async () => {
      const THREE = await import("three");
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch {
        element.dataset.fallback = "true";
        return;
      }
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 30);
      camera.position.set(0, 0.25, 7.6);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      element.appendChild(renderer.domElement);
      element.dataset.ready = "true";
      const ambient = new THREE.AmbientLight(0xc2dfff, 1.25);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xd6eeff, 2.4);
      key.position.set(-3, 3, 4);
      scene.add(key);
      const rim = new THREE.PointLight(0xf0b86c, 8);
      rim.position.set(3, 2, 2);
      scene.add(rim);
      const group = new THREE.Group();
      scene.add(group);
      const blue = new THREE.MeshPhysicalMaterial({
        color: 0x83bde8,
        metalness: 0.3,
        roughness: 0.17,
        clearcoat: 1,
      });
      const gold = new THREE.MeshStandardMaterial({
        color: 0xedc481,
        metalness: 0.35,
        roughness: 0.36,
      });
      const paper = new THREE.MeshStandardMaterial({color:0xfff5df,roughness:.82,side:THREE.DoubleSide});
      const cover = new THREE.MeshStandardMaterial({color:0x254c70,roughness:.48,metalness:.12,side:THREE.DoubleSide});
      const ink = new THREE.MeshBasicMaterial({color:0x8e998d,transparent:true,opacity:.6});
      const book = new THREE.Group();
      book.rotation.set(-.33,-.25,-.1); group.add(book);
      const pageDepth = (u:number) => .13+Math.sin(u*Math.PI)*.24+u*.09;
      for(const side of [-1,1]) {
        for(let sheet=0;sheet<5;sheet++) {
          const geometry=new THREE.PlaneGeometry(1.05,1.32,24,1);
          const vertices=geometry.attributes.position;
          for(let i=0;i<vertices.count;i++){
            const u=vertices.getX(i)/1.05+.5;
            vertices.setXYZ(i,side*u*(sheet===4?1.09:1.05),vertices.getY(i)*(sheet===4?1.05:1),pageDepth(u)-sheet*.027);
          }
          geometry.computeVertexNormals();
          book.add(new THREE.Mesh(geometry,sheet===4?cover:paper));
        }
        for(let row=0;row<6;row++){
          const points=Array.from({length:20},(_,i)=>{const u=.16+i/19*(row===5?.48:.66);return new THREE.Vector3(side*u*1.05,.43-row*.16,pageDepth(u)+.008);});
          const curve=new THREE.CatmullRomCurve3(points);
          book.add(new THREE.Mesh(new THREE.TubeGeometry(curve,20,.006,5,false),ink));
        }
      }
      const spine=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1.35,20),gold);spine.position.z=.1;book.add(spine);
      const orbitGroups=[0,1].map(i=>{
        const orbit=new THREE.Group();orbit.rotation.set(.4+i*.65,.15+i*.35,-.35+i*.85);orbit.position.z=-.55;
        orbit.add(new THREE.Mesh(new THREE.TorusGeometry(1.64+i*.22,.014,12,160),i?blue:gold));
        const node=new THREE.Mesh(new THREE.SphereGeometry(.095,32,20),i?blue:gold);node.position.x=1.64+i*.22;orbit.add(node);
        group.add(orbit);return orbit;
      });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0,
        visible = true,
        previous = 0,
        time = 0,
        pointerX = 0,
        pointerY = 0;
      const render = () => renderer.render(scene, camera);
      const running = () =>
        !pause.current && !reduced.matches && visible && !document.hidden;
      const animate = (now: number) => {
        if (!running()) {
          frame = 0;
          previous = 0;
          return;
        }
        if (!previous || now > previous) {
          time += previous ? Math.min((now - previous) / 1000, 0.06) : 0;
          previous = now;
          group.rotation.y += (pointerX * 0.18 - group.rotation.y) * 0.06;
          group.rotation.x += (pointerY * 0.1 - group.rotation.x) * 0.06;
          book.position.y = Math.sin(time*.8)*.09;
          book.rotation.y = -.25+Math.sin(time*.45)*.18;
          book.rotation.z = -.1+Math.sin(time*.6)*.035;
          orbitGroups.forEach(
            (orbit, i) =>
              (orbit.rotation.z = -.35 + i*.85 + time*(.16+i*.05)),
          );
          render();
        }
        frame = requestAnimationFrame(animate);
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = 0;
        render();
        if (running()) frame = requestAnimationFrame(animate);
      };
      const applyPalette = () => {
        const light = document.documentElement.dataset.theme === "light";
        blue.color.setHex(light ? 0xd8c19b : 0x83bde8);
        gold.color.setHex(light ? 0xad8751 : 0xedc481);
        cover.color.setHex(light ? 0x9a7955 : 0x254c70);
        paper.color.setHex(light ? 0xfff9ed : 0xfff5df);
        ambient.color.setHex(light ? 0xfff3df : 0xc2dfff);
        key.color.setHex(light ? 0xffecd2 : 0xd6eeff);
        scene.traverse((object) => {
          if (
            object instanceof THREE.LineSegments &&
            object.material instanceof THREE.LineBasicMaterial
          ) {
            object.material.color.setHex(light ? 0xb49c79 : 0x97c9e9);
          }
        });
        render();
      };
      applyPalette();
      const paletteObserver = new MutationObserver(applyPalette);
      paletteObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      refresh.current = sync;
      const resize = new ResizeObserver(() => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        sync();
      });
      const view = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      });
      const move = (event: PointerEvent) => {
        if (reduced.matches || pause.current) return;
        const rect = element.getBoundingClientRect();
        pointerX = (event.clientX - rect.left) / rect.width - 0.5;
        pointerY = (event.clientY - rect.top) / rect.height - 0.5;
      };
      const leave = () => {
        pointerX = 0;
        pointerY = 0;
      };
      resize.observe(element);
      view.observe(element);
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", leave);
      reduced.addEventListener("change", sync);
      document.addEventListener("visibilitychange", sync);
      cleanup = () => {
        cancelAnimationFrame(frame);
        paletteObserver.disconnect();
        resize.disconnect();
        view.disconnect();
        reduced.removeEventListener("change", sync);
        document.removeEventListener("visibilitychange", sync);
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", leave);
        refresh.current = () => {};
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
            obj.geometry.dispose();
            const materials = Array.isArray(obj.material)
              ? obj.material
              : [obj.material];
            materials.forEach((m) => m.dispose());
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
        delete element.dataset.ready;
      };
      sync();
    };
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          near.disconnect();
          void load().catch(() => {
            element.dataset.fallback = "true";
          });
        }
      },
      { rootMargin: "250px" },
    );
    near.observe(element);
    return () => {
      disposed = true;
      near.disconnect();
      cleanup();
    };
  }, []);
  return (
    <div className="knowledge-webgl" ref={host} aria-hidden="true">
      <div className="knowledge-orb-fallback">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
