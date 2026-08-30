"use client";

import { useEffect, useRef, useCallback } from "react";

export function TrackRecord3D() {
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

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1500);
    camera.position.set(0, 100, 220);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x070709, 1);

    scene.add(new THREE.AmbientLight(0x334466, 0.5));
    const pl = new THREE.PointLight(0xeab308, 2, 500);
    pl.position.set(50, 120, 80);
    scene.add(pl);

    // Central rotating octahedron (crystal/trophy)
    const crystalGeo = new THREE.OctahedronGeometry(25, 2);
    const crystalMat = new THREE.MeshBasicMaterial({
      color: 0xeab308,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 30;
    scene.add(crystal);

    // Inner glow
    const glowGeo = new THREE.OctahedronGeometry(23, 1);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xeab308,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.y = 30;
    scene.add(glowMesh);

    // Orbiting rings
    const orbitRings: any[] = [];
    for (let i = 0; i < 3; i++) {
      const rGeo = new THREE.TorusGeometry(40 + i * 15, 0.4, 8, 80);
      const rMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xeab308 : i === 1 ? 0x54bbf7 : 0x4dbe95,
        transparent: true,
        opacity: 0.1 - i * 0.02,
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.4;
      ring.rotation.z = i * 0.6;
      scene.add(ring);
      orbitRings.push(ring);
    }

    // Win/loss bars (floating columns)
    const columnCount = 12;
    const columns: any[] = [];
    for (let i = 0; i < columnCount; i++) {
      const isWin = i % 3 !== 2;
      const h = 10 + Math.random() * 60;
      const geo = new THREE.CylinderGeometry(2, 2, h, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: isWin ? 0x4dbe95 : 0xd84f68,
        transparent: true,
        opacity: 0.35,
      });
      const col = new THREE.Mesh(geo, mat);
      const angle = (i / columnCount) * Math.PI * 2;
      const dist = 70 + Math.random() * 30;
      col.position.set(Math.cos(angle) * dist, h / 2 - 30, Math.sin(angle) * dist);
      col.scale.y = 0;
      scene.add(col);
      columns.push({ mesh: col, targetH: h });
    }

    // Floating particles
    const pCount = 250;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 50 + Math.random() * 200;
      pPos[i * 3] = Math.cos(theta) * r;
      pPos[i * 3 + 1] = Math.random() * 200 - 30;
      pPos[i * 3 + 2] = Math.sin(theta) * r;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xeab308, size: 0.8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    scene.add(new THREE.Points(pGeo, pMat));

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    let time = 0;
    let colsAnimated = false;

    const animate_loop = () => {
      time += 0.01;
      frameRef.current = requestAnimationFrame(animate_loop);

      // Crystal rotation + breathing
      crystal.rotation.y += 0.008;
      crystal.rotation.x = Math.sin(time * 0.5) * 0.1;
      const breathe = 1 + Math.sin(time * 0.8) * 0.05;
      crystal.scale.setScalar(breathe);
      glowMesh.rotation.copy(crystal.rotation);
      glowMesh.scale.setScalar(breathe);

      // Orbit rings
      orbitRings.forEach((r, i) => {
        r.rotation.z += 0.002 * (i + 1);
        r.rotation.x = Math.PI / 2 + Math.sin(time * 0.3 + i) * 0.2;
      });

      // Column grow
      if (!colsAnimated && time > 0.5) {
        colsAnimated = true;
        columns.forEach((c, i) => {
          setTimeout(() => { c.mesh.scale.y = 1; }, i * 80);
        });
      }

      // Column pulse
      columns.forEach((c, i) => {
        const pulse = 1 + Math.sin(time * 2 + i * 0.7) * 0.05;
        c.mesh.scale.x = pulse;
        c.mesh.scale.z = pulse;
      });

      // Camera
      camera.position.x += (mouseRef.current.x * 35 - camera.position.x) * 0.02;
      camera.position.y += (-mouseRef.current.y * 20 + 100 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      // Particles orbit
      const pp = pGeo.attributes.position;
      for (let i = 0; i < pCount; i++) {
        const x = pp.getX(i);
        const z = pp.getZ(i);
        const speed = 0.002 + (i % 5) * 0.0005;
        pp.setX(i, x * Math.cos(speed) - z * Math.sin(speed));
        pp.setZ(i, x * Math.sin(speed) + z * Math.cos(speed));
        pp.setY(i, pp.getY(i) + Math.sin(time + i * 0.05) * 0.02);
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
