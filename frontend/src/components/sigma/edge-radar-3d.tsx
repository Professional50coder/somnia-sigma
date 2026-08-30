"use client";

import { useEffect, useRef, useCallback } from "react";

export function EdgeRadar3D() {
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
    scene.fog = new THREE.FogExp2(0x070709, 0.002);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1500);
    camera.position.set(0, 150, 200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x070709, 1);

    // Lights
    scene.add(new THREE.AmbientLight(0x334466, 0.5));
    const pl = new THREE.PointLight(0x6166dc, 2, 500);
    pl.position.set(80, 120, 60);
    scene.add(pl);

    // Radar rings
    const rings: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const ringGeo = new THREE.RingGeometry(i * 30 - 0.5, i * 30 + 0.5, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x6166dc,
        transparent: true,
        opacity: 0.08 + (5 - i) * 0.02,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -20;
      scene.add(ring);
      rings.push(ring);
    }

    // Radar sweep (rotating line)
    const sweepGeo = new THREE.PlaneGeometry(160, 1.5);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x6166dc,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const sweep = new THREE.Mesh(sweepGeo, sweepMat);
    sweep.rotation.x = -Math.PI / 2;
    sweep.position.y = -19;
    scene.add(sweep);

    // Sweep trail (fading arc)
    const trailGeo = new THREE.RingGeometry(0, 160, 64, 1, 0, 0.4);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0x6166dc,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.rotation.x = -Math.PI / 2;
    trail.position.y = -19.5;
    scene.add(trail);

    // Blips (data points)
    const blipGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const blips: any[] = [];
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 130;
      const blipMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x54bbf7 : i % 3 === 1 ? 0x4dbe95 : 0xeab308,
        transparent: true,
        opacity: 0.6,
      });
      const blip = new THREE.Mesh(blipGeo, blipMat);
      blip.position.set(Math.cos(angle) * dist, -18, Math.sin(angle) * dist);
      scene.add(blip);
      blips.push(blip);
    }

    // Cross lines
    const crossMat = new THREE.LineBasicMaterial({ color: 0x6166dc, transparent: true, opacity: 0.05 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pts = [new THREE.Vector3(0, -19, 0), new THREE.Vector3(Math.cos(angle) * 160, -19, Math.sin(angle) * 160)];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(new THREE.Line(lineGeo, crossMat));
    }

    // Floating particles
    const pCount = 200;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 400;
      pPos[i * 3 + 1] = Math.random() * 200 - 20;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x6166dc, size: 0.8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(pGeo, pMat));

    // Mouse
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    let time = 0;
    const animate_loop = () => {
      time += 0.01;
      frameRef.current = requestAnimationFrame(animate_loop);

      // Sweep rotation
      sweep.rotation.z = time * 1.5;
      trail.rotation.z = time * 1.5 - 0.4;

      // Blip pulse
      blips.forEach((b, i) => {
        const scale = 1 + Math.sin(time * 3 + i) * 0.4;
        b.scale.setScalar(scale);
        (b.material as any).opacity = 0.3 + Math.sin(time * 3 + i) * 0.3;
      });

      // Camera mouse react
      camera.position.x += (mouseRef.current.x * 40 - camera.position.x) * 0.02;
      camera.position.y += (-mouseRef.current.y * 20 + 150 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      // Particles float
      const pp = pGeo.attributes.position;
      for (let i = 0; i < pCount; i++) {
        pp.setY(i, pp.getY(i) + Math.sin(time + i * 0.1) * 0.03);
      }
      pp.needsUpdate = true;

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
