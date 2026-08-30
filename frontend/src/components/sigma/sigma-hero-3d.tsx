"use client";

import { useEffect, useRef, useCallback } from "react";

export function SigmaHero3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);
  const initRef = useRef(false);

  const setup = useCallback(async () => {
    if (initRef.current || !canvasRef.current) return;
    initRef.current = true;

    const [
      THREE_MOD,
      ADAPTER_MOD,
    ] = await Promise.all([
      import("three"),
      import("animejs/adapters/three"),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const THREE = THREE_MOD as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = ADAPTER_MOD as any;
    const { animate, stagger, createTimeline, utils } = adapter;
    const { lerp, damp } = utils;

    const canvas = canvasRef.current!;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    // ─── Scene ───
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070709, 0.0015);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2000);
    camera.position.set(0, 80, 260);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x070709, 1);

    // ─── Lights ───
    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambient);

    const point1 = new THREE.PointLight(0x54bbf7, 2, 500);
    point1.position.set(100, 120, 80);
    scene.add(point1);

    const point2 = new THREE.PointLight(0x4dbe95, 1.5, 400);
    point2.position.set(-80, 60, -60);
    scene.add(point2);

    // ─── Wireframe Globe ───
    const globeGeo = new THREE.IcosahedronGeometry(90, 4);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x54bbf7,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    globe.position.set(0, 20, 0);
    scene.add(globe);

    // Inner glow sphere
    const glowGeo = new THREE.IcosahedronGeometry(88, 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x54bbf7,
      transparent: true,
      opacity: 0.03,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(globe.position);
    scene.add(glow);

    // ─── Sigma Wave Terrain ───
    const terrainW = 120;
    const terrainD = 80;
    const segW = 100;
    const segD = 60;
    const terrainGeo = new THREE.PlaneGeometry(terrainW, terrainD, segW, segD);
    terrainGeo.rotateX(-Math.PI / 2);

    const terrainMat = new THREE.MeshBasicMaterial({
      color: 0x4dbe95,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.set(0, -40, 0);
    scene.add(terrain);

    // Store original positions
    const terrainPos = terrainGeo.attributes.position;
    const origY = new Float32Array(terrainPos.count);
    for (let i = 0; i < terrainPos.count; i++) {
      origY[i] = terrainPos.getY(i);
    }

    // ─── Floating Particles (data points) ───
    const particleCount = 600;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    const particlePhases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 100 + Math.random() * 160;

      particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 180;
      particlePositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      particleSpeeds[i] = 0.2 + Math.random() * 0.6;
      particlePhases[i] = Math.random() * Math.PI * 2;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x54bbf7,
      size: 1.5,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ─── Orbiting Rings (data streams) ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rings: any[] = [];
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(110 + i * 20, 0.3, 8, 120);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x54bbf7 : i === 1 ? 0x4dbe95 : 0xeab308,
        transparent: true,
        opacity: 0.08 + i * 0.03,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.3;
      ring.rotation.z = i * 0.4;
      scene.add(ring);
      rings.push(ring);
    }

    // ─── Node Points on Globe ───
    const nodeCount = 24;
    const nodeGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const nodes: any[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const nodeMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x54bbf7 : i % 3 === 1 ? 0x4dbe95 : 0xeab308,
        transparent: true,
        opacity: 0.8,
      });
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      const theta = (i / nodeCount) * Math.PI * 2;
      const phi = Math.acos(2 * ((i * 0.618) % 1) - 1);
      const r = 92;
      node.position.set(
        globe.position.x + r * Math.sin(phi) * Math.cos(theta),
        globe.position.y + r * Math.sin(phi) * Math.sin(theta),
        globe.position.z + r * Math.cos(phi)
      );
      scene.add(node);
      nodes.push(node);
    }

    // ─── Connection Lines between nodes ───
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x54bbf7,
      transparent: true,
      opacity: 0.06,
    });
    const lines: any[] = [];
    for (let i = 0; i < 12; i++) {
      const a = nodes[i % nodeCount];
      const b = nodes[(i + 3 + Math.floor(i * 0.7)) % nodeCount];
      const lineGeo = new THREE.BufferGeometry().setFromPoints([a.position, b.position]);
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
      lines.push(line);
    }

    // ─── Entrance Timeline ───
    const tl = createTimeline({
      defaults: { duration: 2000, ease: "outExpo" },
    });

    tl.add(globe, { scale: [0, 1], rotateY: [0, 360] }, 0);
    tl.add(terrain, { opacity: [0, 0.15], y: [-80, -40] }, 200);
    tl.add(particles, { opacity: [0, 0.5] }, 400);
    tl.add(rings[0], { opacity: [0, 0.08], scale: [0, 1] }, 300);
    tl.add(rings[1], { opacity: [0, 0.1], scale: [0, 1] }, 450);
    tl.add(rings[2], { opacity: [0, 0.12], scale: [0, 1] }, 600);

    // Stagger node appearance
    nodes.forEach((node, i) => {
      animate(node, {
        scale: [0, 1],
        opacity: [0, 0.8],
        duration: 600,
        delay: 800 + i * 50,
        ease: "outExpo",
      });
    });

    // ─── Mouse tracking ───
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    // ─── Animation Loop ───
    let time = 0;
    const animate_loop = () => {
      time += 0.01;
      frameRef.current = requestAnimationFrame(animate_loop);

      // Globe rotation
      globe.rotation.y += 0.002;
      globe.rotation.x = Math.sin(time * 0.3) * 0.05;
      glow.rotation.copy(globe.rotation);

      // Mouse-reactive camera using lerp and damp from anime.js utils
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const targetX = mx * 30;
      const targetY = -my * 20 + 80;
      camera.position.x = lerp(camera.position.x, targetX, 0.02) as number;
      camera.position.y = lerp(camera.position.y, targetY, 0.02) as number;
      camera.lookAt(0, 0, 0);

      // Terrain wave
      for (let i = 0; i < terrainPos.count; i++) {
        const x = terrainPos.getX(i);
        const z = terrainPos.getZ(i);
        const wave1 = Math.sin(x * 0.05 + time * 1.5) * 3;
        const wave2 = Math.cos(z * 0.08 + time * 1.2) * 2;
        const wave3 = Math.sin((x + z) * 0.03 + time * 0.8) * 4;
        terrainPos.setY(i, origY[i] + wave1 + wave2 + wave3);
      }
      terrainPos.needsUpdate = true;
      terrain.rotation.y = time * 0.05;

      // Particle floating
      const pPos = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const speed = particleSpeeds[i];
        const phase = particlePhases[i];
        pPos.setY(
          i,
          pPos.getY(i) + Math.sin(time * speed + phase) * 0.08
        );
      }
      pPos.needsUpdate = true;
      particles.rotation.y = time * 0.02;

      // Rings rotation
      rings.forEach((ring, i) => {
        ring.rotation.z += 0.001 * (i + 1);
        ring.rotation.x = Math.PI / 2 + Math.sin(time * 0.2 + i) * 0.15;
      });

      // Node pulse
      nodes.forEach((node, i) => {
        const scale = 1 + Math.sin(time * 2 + i * 0.5) * 0.3;
        node.scale.setScalar(scale);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (node.material as any).opacity =
          0.5 + Math.sin(time * 2 + i * 0.5) * 0.3;
      });

      // Line pulse
      lines.forEach((line, i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (line.material as any).opacity =
          0.03 + Math.sin(time * 1.5 + i * 0.8) * 0.04;
      });

      // Globe breathing
      const breathe = 1 + Math.sin(time * 0.5) * 0.015;
      globe.scale.setScalar(breathe);
      glow.scale.setScalar(breathe);

      // Light orbit
      point1.position.x = Math.cos(time * 0.3) * 120;
      point1.position.z = Math.sin(time * 0.3) * 80;
      point2.position.x = Math.cos(time * 0.2 + 2) * 100;
      point2.position.z = Math.sin(time * 0.2 + 2) * 100;

      renderer.render(scene, camera);
    };

    animate_loop();

    // ─── Resize ───
    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // ─── Cleanup ───
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    setup().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, [setup]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
