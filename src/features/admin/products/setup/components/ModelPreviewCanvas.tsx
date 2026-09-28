"use client";

import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RotateCw, RefreshCw, X, Loader2, Eye, AlertCircle } from "lucide-react";

export interface ModelPreviewCanvasProps {
  modelSource: string | File;
  fileName: string;
  fileSizeBytes: number;
  onRemove: () => void;
  onExpand?: () => void;
}

export function recenterAndNormalizeGroup(group: THREE.Group): void {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center);
  group.updateMatrixWorld(true);
}

function LoadedModel({
  source,
  onError,
}: {
  source: string | File;
  onError: (err: string) => void;
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const loader = new GLTFLoader();

    if (typeof source === "string") {
      // Remote R2 URL
      loader.load(
        source,
        (gltf) => {
          if (!isCancelled) {
            const root = gltf.scene;
            recenterAndNormalizeGroup(root);
            setScene(root);
          }
        },
        undefined,
        (err) => {
          console.error("Failed to load 3D model:", err);
          if (!isCancelled) {
            onError("Failed to load remote 3D model.");
          }
        }
      );
    } else {
      // Local File object
      source
        .arrayBuffer()
        .then((buf) => {
          if (isCancelled) return;
          loader.parse(
            buf,
            "",
            (gltf) => {
              if (!isCancelled) {
                const root = gltf.scene;
                recenterAndNormalizeGroup(root);
                setScene(root);
              }
            },
            (err) => {
              console.error("Failed to parse local GLB:", err);
              if (!isCancelled) {
                onError("Invalid 3D model file format.");
              }
            }
          );
        })
        .catch((err: unknown) => {
          console.error("Could not read local file buffer:", err);
          if (!isCancelled) {
            onError("Could not read local file buffer.");
          }
        });
    }

    return () => {
      isCancelled = true;
      if (scene) {
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else if (obj.material) {
              obj.material.dispose();
            }
          }
        });
      }
    };
  }, [source, onError, scene]);

  if (!scene) {
    return null;
  }

  return <primitive object={scene} />;
}

export function ModelPreviewCanvas({
  modelSource,
  fileName,
  fileSizeBytes,
  onRemove,
  onExpand,
}: ModelPreviewCanvasProps) {
  const [autoRotate, setAutoRotate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="relative w-full aspect-square bg-[#0f1422] rounded-[16px] border border-neutral-200 overflow-hidden group">
      {errorMessage ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900">
          <AlertCircle className="size-10 text-red-400 mb-3" />
          <p className="font-medium text-sm text-red-300 mb-1">{errorMessage}</p>
          <p className="text-xs text-neutral-400 mb-4">Please remove or replace the model file.</p>
          <button
            type="button"
            onClick={onRemove}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Clear Model
          </button>
        </div>
      ) : (
        <Canvas
          shadows
          camera={{ position: [0, 1.5, 3], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.6} adjustCamera={1.2}>
              <LoadedModel source={modelSource} onError={setErrorMessage} />
            </Stage>
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            autoRotate={autoRotate}
            autoRotateSpeed={2.0}
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Canvas>
      )}

      {/* Top Toolbar Controls */}
      {!errorMessage && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
          <button
            type="button"
            onClick={handleResetCamera}
            title="Reset Camera View"
            className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md backdrop-blur-sm transition-colors border border-white/10 cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? "Pause Turntable" : "Start Turntable"}
            className={`p-1.5 rounded-md backdrop-blur-sm transition-colors border cursor-pointer ${
              autoRotate
                ? "bg-[#07b6d3] text-white border-[#07b6d3]"
                : "bg-black/60 hover:bg-black/80 text-white border-white/10"
            }`}
          >
            <RotateCw className="size-3.5" />
          </button>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              title="Expand Preview"
              className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md backdrop-blur-sm transition-colors border border-white/10 cursor-pointer"
            >
              <Eye className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Top-Right Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        title="Remove 3D Model"
        className="absolute top-3 right-3 p-1.5 bg-white/90 hover:bg-red-50 text-neutral-500 hover:text-red-500 rounded-full transition-colors border border-neutral-200 shadow-sm z-10 cursor-pointer"
      >
        <X className="size-4" />
      </button>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 inset-x-0 p-2.5 bg-black/60 backdrop-blur-sm border-t border-white/10 flex items-center justify-between text-xs text-white z-10 pointer-events-none">
        <p className="font-medium truncate max-w-[180px]">{fileName}</p>
        <p className="text-white/60">{(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
      </div>
    </div>
  );
}
