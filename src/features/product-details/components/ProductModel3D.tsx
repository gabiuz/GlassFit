"use client";

import { Suspense, useRef, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { applyPresentationMaterials } from "@/lib/visualization/materialClassifier";
import type { GlassAppearanceMode } from "@/lib/visualization/types";

// ── Auto-rotating GLB model ──────────────────────────────────────────────────
function Model({
  url,
  aluminumFinish = "white",
  glassAppearance = "clear",
}: {
  url: string;
  aluminumFinish?: string;
  glassAppearance?: GlassAppearanceMode;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    applyPresentationMaterials(clone, glassAppearance, aluminumFinish);
    return clone;
  }, [scene, aluminumFinish, glassAppearance]);

  // Centre + normalise the model so it fills the canvas regardless of source scale
  useEffect(() => {
    if (!groupRef.current) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    groupRef.current.scale.setScalar(scale);
    groupRef.current.position.sub(center.multiplyScalar(scale));
  }, [clonedScene]);

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

// ── Public component ─────────────────────────────────────────────────────────
interface ProductModel3DProps {
  glbUrl: string;
  aluminumFinish?: string;
  glassAppearance?: GlassAppearanceMode;
}

export function ProductModel3D({
  glbUrl,
  aluminumFinish = "white",
  glassAppearance = "clear",
}: ProductModel3DProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 4], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow />
      <directionalLight position={[-5, 4, -3]} intensity={0.5} />
      <Environment preset="city" />

      {/* Model */}
      <Suspense fallback={null}>
        <Model
          url={glbUrl}
          aluminumFinish={aluminumFinish}
          glassAppearance={glassAppearance}
        />
        <ContactShadows
          position={[0, -1.1, 0]}
          opacity={0.35}
          scale={6}
          blur={2.5}
          far={4}
        />
      </Suspense>

      {/* Controls */}
      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI * 0.75}
        dampingFactor={0.08}
        enableDamping
        autoRotate={true}
        autoRotateSpeed={2}
      />
    </Canvas>
  );
}
