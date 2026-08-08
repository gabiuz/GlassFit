"use client";

import { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

// ── Auto-rotating GLB model ──────────────────────────────────────────────────
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

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
  }, [scene]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

// ── Public component ─────────────────────────────────────────────────────────
interface ProductModel3DProps {
  glbUrl: string;
}

export function ProductModel3D({ glbUrl }: ProductModel3DProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

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
        <Model url={glbUrl} />
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
