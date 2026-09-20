"use client";

import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { applyPresentationMaterials } from "@/lib/visualization/materialClassifier";
import type { AluminumFinishKey } from "@/lib/visualization/colorVariations";
import type { GlassAppearanceMode, GlassColorKey, GlassThicknessMm } from "@/lib/visualization/types";
import {
  calculateModelTransform,
  calculatePreviewLayoutPositions,
  getPreviewOverflowLabel,
  getVisiblePreviewModelCount,
} from "@/lib/products/productPreviewConfiguration";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
}

class PreviewErrorBoundary extends Component<PreviewErrorBoundaryProps, PreviewErrorBoundaryState> {
  state: PreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PreviewErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: PreviewErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-neutral-700">
          The 3D preview could not be displayed.
        </div>
      );
    }
    return this.props.children;
  }
}

interface ModelProps {
  url: string;
  aluminumFinish: AluminumFinishKey;
  glassAppearance: GlassAppearanceMode;
  glassColor: GlassColorKey;
  glassThicknessMm: GlassThicknessMm;
  widthCm?: number;
  heightCm?: number;
  quantity: number;
}

function disposePresentationMaterials(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  materials.forEach((material) => material.dispose());
}

function Model({
  url,
  aluminumFinish,
  glassAppearance,
  glassColor,
  glassThicknessMm,
  widthCm,
  heightCm,
  quantity,
}: ModelProps) {
  const { scene } = useGLTF(url);

  const preparedModel = useMemo(() => {
    const clone = scene.clone(true);
    applyPresentationMaterials(clone, {
      aluminumFinish,
      glassAppearance,
      glassColor,
      glassThicknessMm,
    });
    return clone;
  }, [scene, aluminumFinish, glassAppearance, glassColor, glassThicknessMm]);

  useEffect(() => () => disposePresentationMaterials(preparedModel), [preparedModel]);

  const arrangedGroup = useMemo(() => {
    preparedModel.updateMatrixWorld(true);
    const sourceBox = new THREE.Box3().setFromObject(preparedModel);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    const sourceCenter = sourceBox.getCenter(new THREE.Vector3());
    const dimensions = widthCm !== undefined && heightCm !== undefined ? { widthCm, heightCm } : undefined;
    const transform = calculateModelTransform(sourceSize, sourceCenter, dimensions);
    if (!transform) throw new Error("The preview model has empty or invalid bounds.");

    const count = getVisiblePreviewModelCount(quantity);
    const instances = Array.from({ length: count }, () => {
      const instanceRoot = new THREE.Group();
      instanceRoot.add(preparedModel.clone(true));
      instanceRoot.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
      instanceRoot.position.set(transform.position.x, transform.position.y, transform.position.z);
      instanceRoot.updateMatrixWorld(true);
      return instanceRoot;
    });

    const modelWidth = new THREE.Box3().setFromObject(instances[0]).getSize(new THREE.Vector3()).x;
    const positions = calculatePreviewLayoutPositions(quantity, modelWidth);
    instances.forEach((instance, index) => {
      instance.position.x += positions[index] ?? 0;
    });

    const group = new THREE.Group();
    group.add(...instances);
    group.updateMatrixWorld(true);
    const groupBox = new THREE.Box3().setFromObject(group);
    const groupSize = groupBox.getSize(new THREE.Vector3());
    const groupCenter = groupBox.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(groupSize.x, groupSize.y, groupSize.z);
    if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
      throw new Error("The preview model could not be fitted.");
    }
    const fitScale = 2 / maxDimension;
    group.scale.setScalar(fitScale);
    group.position.set(-groupCenter.x * fitScale, -groupCenter.y * fitScale, -groupCenter.z * fitScale);
    return group;
  }, [preparedModel, widthCm, heightCm, quantity]);

  return <primitive object={arrangedGroup} />;
}

export interface ProductModel3DProps {
  glbUrl: string;
  aluminumFinish: AluminumFinishKey;
  glassAppearance: GlassAppearanceMode;
  glassColor: GlassColorKey;
  glassThicknessMm: GlassThicknessMm;
  widthCm?: number;
  heightCm?: number;
  quantity: number;
}

export function ProductModel3D(props: ProductModel3DProps) {
  const overflowLabel = getPreviewOverflowLabel(props.quantity);
  const resetKey = [props.glbUrl, props.aluminumFinish, props.glassAppearance, props.glassColor, props.glassThicknessMm].join(":");

  return (
    <div className="relative h-full w-full">
      <PreviewErrorBoundary resetKey={resetKey}>
        <Canvas
          camera={{ position: [0, 0.5, 4], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: "100%", height: "100%", background: "transparent" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow />
          <directionalLight position={[-5, 4, -3]} intensity={0.5} />
          <Environment preset="city" />
          <Suspense fallback={null}>
            <Model url={props.glbUrl} {...props} />
            <ContactShadows position={[0, -1.1, 0]} opacity={0.35} scale={6} blur={2.5} far={4} />
          </Suspense>
          <OrbitControls
            enableZoom
            enablePan={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI * 0.75}
            dampingFactor={0.08}
            enableDamping
            autoRotate
            autoRotateSpeed={2}
          />
        </Canvas>
      </PreviewErrorBoundary>
      {overflowLabel && (
        <span
          className="absolute left-4 top-4 z-10 rounded-full bg-black/75 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
          aria-label={`${overflowLabel} products not shown in the preview`}
        >
          {overflowLabel}
        </span>
      )}
    </div>
  );
}
