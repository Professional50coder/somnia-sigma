"use client";

import { useEffect, useRef, useCallback } from "react";

export function Backtest3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);
  const initRef = useRef(false);

  const setup = useCallback(async () => {
    if (initRef.current || !canvasRef.current) return;
    initRef.current = true;

    const THREE_MOD = await import("three");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const THREE = THREE_MOD as any;

    const canvas = canvasRef.current!;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070709, 0.003);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1500);
    camera.position.set(0, 120, 200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x070709, 1);

    scene.add(new THREE.AmbientLight(0x334466, 0.4));
    const pl1 = new THREE.PointLight(0x54bbf7, 1.5, 400);
    pl1.position.set(60, 100, 60);
    scene.add(pl1);
    const pl2 = new THREE.PointLight(0x4dbe95, 1, 300);
    pl2.position.set(-60, 80, -40);
    scene.add(pl2);

    // Calibration bars (3D histogram)
    const barCount = 20;
    const bars: any[] = [];
    const barWidth = 8;
    const gap = 2;
    const totalW = barCount * (barWidth + gap);

    for (let i = 0; i < barCount; i++) {
      const h = 10 + Math.random() * 80;
      const geo = new THREE.BoxGeometry(barWidth, h, barWidth);
      const mat = new THREE.MeshBasicMaterial({
        color: i < barCount / 2 ? 0x54bbf7 : 0x4dbe95,
        transparent: true,
        opacity: 0.4,
      });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(i * (barWidth + gap) - totalW / 2, h / 2 - 40, 0);
      bar.scale.y = 0;
      scene.add(bar);
      bars.push({ mesh: bar, targetH: h });
    }

    // Diagonal calibration line (perfect = diagonal)
    const linePts = [
      new THREE.Vector3(-totalW / 2, -40, barWidth + 5),
      new THREE.Vector3(totalW / 2, 60, barWidth + 5),
    ];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xeab308, transparent: true, opacity: 0.4 });
    scene.add(new THREE.Line(lineGeo, lineMat));

    // Floating grid plane
    const gridGeo = new THREE.PlaneGeometry(400, 400, 40, 40);
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x54bbf7, wireframe: true, transparent: true, opacity: 0.03 });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -42;
    scene.add(grid);

    // Particles
    const pCount = 150;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 400;
      pPos[i * 3 + 1] = Math.random() * 150 - 30;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x4dbe95, size: 0.7, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(pGeo, pMat));

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    let time = 0;
    let barsAnimated = false;

    const animate_loop = () => {
      time += 0.01;
      frameRef.current = requestAnimationFrame(animate_loop);

      // Animate bars growing
      if (!barsAnimated && time > 0.5) {
        barsAnimated = true;
        bars.forEach((b, i) => {
          const delay = i * 50;
          setTimeout(() => {
            if (b.mesh) {
              b.mesh.scale.y = 1;
              b.mesh.position.y = b.targetH / 2 - 40;
            }
          }, delay);
        });
      }

      // Bar breathing
      bars.forEach((b, i) => {
        const breathe = 1 + Math.sin(time * 1.5 + i * 0.3) * 0.03;
        b.mesh.scale.x = breathe;
        b.mesh.scale.z = breathe;
        (b.mesh.material as any).opacity = 0.3 + Math.sin(time * 2 + i * 0.5) * 0.1;
      });

      // Camera
      camera.position.x += (mouseRef.current.x * 30 - camera.position.x) * 0.02;
      camera.position.y += (-mouseRef.current.y * 15 + 120 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      // Grid subtle wave
      grid.position.z = Math.sin(time * 0.3) * 5;

      renderer.render(scene, camera);
    };
    animate_loop();

    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    setup().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [setup]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}
