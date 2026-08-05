"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { RotateCw, FlipHorizontal, RotateCcw, Trash2 } from "lucide-react";
import Button from "@/components/shared/Button";
import { AddProductModal } from "./AddProductModal";
import { Product } from "@/features/product/data/products";

interface ProductModelWorkspaceProps {
  uploadedImage: string | null;
  onBack: () => void;
}

export function ProductModelWorkspace({
  uploadedImage,
  onBack,
}: ProductModelWorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(10);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);

  // Accordion State Values
  const [ambientLight, setAmbientLight] = useState(true);
  const [autoShadow, setAutoShadow] = useState(true);
  const [autoRealism, setAutoRealism] = useState(true);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [alumFinish, setAlumFinish] = useState("analok");
  const [glassType, setGlassType] = useState("tempered");
  const [widthCm, setWidthCm] = useState("140");
  const [heightCm, setHeightCm] = useState("120");
  const [thicknessMm, setThicknessMm] = useState("3");
  const [quantity, setQuantity] = useState(1);
  const [occlusions, setOcclusions] = useState([
    { id: 1, label: "Product Label", confidence: "0%", active: false },
    { id: 2, label: "Product Label", confidence: "0%", active: false },
    { id: 3, label: "Product Label", confidence: "0%", active: false },
  ]);

  const [selectedProduct, setSelectedProduct] = useState(true);
  const [rotateAngle, setRotateAngle] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Add Product");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  // Background image source: room background canvas
  const bgImage = "/comparison_assets/room_without_furniture.png";
  // Overlay image inside the click-to-select box: uploaded image or selected product model
  const productOverlayImage = uploadedImage || activeProduct?.image || "/images/modular_cabinets.png";

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotateAngle((prev) => prev + 90);
  };

  const handleFlip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped((prev) => !prev);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotateAngle(0);
    setIsFlipped(false);
    setZoomLevel(10);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(false);
  };

  const handleOpenAddModal = (title: string) => {
    setModalTitle(title);
    setIsAddModalOpen(true);
  };

  const handleSelectProduct = (product: Product) => {
    setActiveProduct(product);
    setSelectedProduct(true);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 5, 50));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 5, 5));
  };

  const toggleAccordion = (title: string) => {
    setOpenAccordions((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  const toggleOcclusion = (id: number) => {
    setOcclusions((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, active: !item.active } : item
      )
    );
  };

  return (
    <div className="w-full max-w-367 mx-auto px-4 sm:px-6 flex flex-col gap-10 items-center">
      {/* ── Section Header ── */}
      <div className="flex flex-col gap-4 items-center justify-center text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-black leading-tight">
          View <span className="text-green">Product Model</span>
        </h1>
        <p className="text-lg sm:text-2xl lg:text-[28px] font-normal text-black/90 tracking-tight leading-normal">
          Inspect the product before adding it to your space.
        </p>
      </div>

      {/* ── Top Toolbar Controls ── */}
      <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Undo, Redo, Zoom */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-center md:justify-start">
          {/* Undo / Redo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="bg-[#0f1422] hover:bg-black text-white px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer"
            >
              Undo
            </button>
            <button
              type="button"
              className="bg-white border border-[#c3c3c3] hover:bg-neutral-50 text-[#0f1422] px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer"
            >
              Redo
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="bg-white border border-[#c3c3c3] flex items-center justify-center gap-3 px-4 py-2 rounded-[10px] select-none">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
            >
              <Image
                src="/visualization/minus-solid-full 1.svg"
                alt="Zoom out"
                width={12}
                height={12}
              />
            </button>
            <span className="text-[#0f1422] text-base font-medium min-w-10 text-center">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
            >
              <Image
                src="/visualization/plus-solid-full 1.svg"
                alt="Zoom in"
                width={12}
                height={12}
              />
            </button>
          </div>
        </div>

        {/* Right: Change Product Banner */}
        <div className="bg-[#f5f5f5] flex flex-wrap items-center justify-center md:justify-end gap-4 px-4 py-2.5 rounded-[20px] shadow-xs relative">
          <span className="text-green text-lg sm:text-xl font-normal tracking-[-0.38px] whitespace-nowrap">
            Want to make changes?
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenAddModal("Add Product")}
              className="bg-[#0f1422] hover:bg-black text-white px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer whitespace-nowrap"
            >
              Add Product
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal("Change Product")}
              className="bg-green hover:bg-[#06a3bd] text-white px-4 py-2 rounded-[10px] text-sm font-normal transition-colors cursor-pointer whitespace-nowrap"
            >
              Change Product
            </button>
          </div>

          {/* Add / Change Product Anchored Popover */}
          <AddProductModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onSelectProduct={handleSelectProduct}
            title={modalTitle}
          />
        </div>
      </div>

      {/* ── Main Interactive Layout (Canvas + Sidebar) ── */}
      <div className="w-full flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Left Side: Space Canvas + Instructions */}
        <div className="flex-1 flex flex-col gap-6 w-full min-w-0">
          {/* Main Space Canvas Card */}
          <div className="bg-white/10 border border-[#f5f5f5] p-3 sm:p-5 rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] relative w-full overflow-hidden">
            <div ref={canvasRef} className="relative w-full h-[400px] sm:h-[550px] lg:h-[680px] xl:h-[760px] rounded-[15px] overflow-hidden bg-neutral-100">
              {/* Background Space Image */}
              <img
                src={bgImage}
                alt="Space image background"
                className="w-full h-full object-cover select-none"
              />

              {/* Product Overlay Element on Canvas with Adjustment Tool (Figma 605:4867) */}
              {selectedProduct && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <motion.div
                    drag
                    dragConstraints={canvasRef}
                    dragElastic={0.05}
                    dragMomentum={false}
                    className="pointer-events-auto flex flex-col items-center justify-center gap-6 cursor-grab active:cursor-grabbing"
                    style={{
                      scale: 1 + zoomLevel / 100,
                    }}
                  >
                  {/* Adjustment Tool Floating Action Toolbar (Figma 605:4867) */}
                  <div className="flex items-center gap-2.5 z-30 select-none animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {/* Rotate Button */}
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                    >
                      <RotateCw className="w-4 h-4 text-white" />
                      <span className="text-[13px] font-normal tracking-[-0.266px]">Rotate</span>
                    </button>

                    {/* Flip Button */}
                    <button
                      type="button"
                      onClick={handleFlip}
                      className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                    >
                      <FlipHorizontal className="w-4 h-4 text-white" />
                      <span className="text-[13px] font-normal tracking-[-0.266px]">Flip</span>
                    </button>

                    {/* Reset Button */}
                    <button
                      type="button"
                      onClick={handleReset}
                      className="bg-[#0f1422] hover:bg-black text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                    >
                      <RotateCcw className="w-4 h-4 text-white" />
                      <span className="text-[13px] font-normal tracking-[-0.266px]">Reset</span>
                    </button>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="bg-[#c50000] hover:bg-[#a30000] text-white px-3.5 py-1.5 rounded-[10px] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shadow-md"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                      <span className="text-[13px] font-normal tracking-[-0.266px]">Remove</span>
                    </button>
                  </div>

                  {/* Product Bounding Box Container with Corner & Edge Handles */}
                  <div className="relative w-56 sm:w-72 md:w-80 h-36 sm:h-48 md:h-56 border border-[#07b6d3] shadow-xl group cursor-grab active:cursor-grabbing select-none">
                    {/* Inner Product Image */}
                    <div className="w-full h-full overflow-hidden select-none pointer-events-none">
                      <img
                        src={productOverlayImage}
                        alt="Selected Product Overlay"
                        draggable={false}
                        className="w-full h-full object-cover transition-transform duration-300 select-none pointer-events-none"
                        style={{
                          transform: `rotate(${rotateAngle}deg) ${isFlipped ? "scaleX(-1)" : ""}`,
                        }}
                      />
                    </div>

                    {/* 4 Corner Resize Handles (Square white box with cyan #06e5ff border) */}
                    <div className="absolute -top-1 -left-1 size-2 bg-white border border-[#06e5ff] z-20 cursor-nwse-resize" />
                    <div className="absolute -top-1 -right-1 size-2 bg-white border border-[#06e5ff] z-20 cursor-nesw-resize" />
                    <div className="absolute -bottom-1 -left-1 size-2 bg-white border border-[#06e5ff] z-20 cursor-nesw-resize" />
                    <div className="absolute -bottom-1 -right-1 size-2 bg-white border border-[#06e5ff] z-20 cursor-nwse-resize" />

                    {/* 4 Edge Midpoint Handles (Cyan #07b6d3 circle) */}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 size-2 bg-[#07b6d3] rounded-full z-20 cursor-ns-resize" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-2 bg-[#07b6d3] rounded-full z-20 cursor-ns-resize" />
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 size-2 bg-[#07b6d3] rounded-full z-20 cursor-ew-resize" />
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 size-2 bg-[#07b6d3] rounded-full z-20 cursor-ew-resize" />

                    {/* Center Movement Handle Badge */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-6 rounded-full bg-[#07b6d3] flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20">
                      <div className="size-2 bg-white rounded-full" />
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
            </div>
          </div>

          {/* Action Instructions Bar */}
          <div className="bg-[#f5f5f5] rounded-[20px] px-5 py-3 flex flex-wrap justify-center items-center gap-2 sm:gap-3 text-sm sm:text-base md:text-lg text-[#0f1422] font-normal tracking-[-0.38px] text-center select-none">
            <span>Click the Product</span>
            <span className="text-[#c3c3c3]">/</span>
            <span>Drag to Move</span>
            <span className="text-[#c3c3c3]">/</span>
            <span>Corner Handles the Resize</span>
            <span className="text-[#c3c3c3]">/</span>
            <span>Tap Circle Rotate</span>
          </div>

          {/* Footnote text */}
          <p className="text-center text-sm sm:text-base text-black/80 font-normal leading-relaxed max-w-3xl mx-auto">
            Use the product viewer to see the selected glass or aluminum design from different angles. This helps you better understand the product’s structure, form, and overall appearance before creating a photo-based preview.
          </p>
        </div>

        {/* Right Side: Product Details & Customization Sidebar */}
        <div className="w-full lg:w-[422px] shrink-0 flex flex-col gap-6 items-end">
          {/* Status Badge */}
          <div className="bg-white rounded-[20px] px-4 py-2 text-black text-sm font-normal tracking-[-0.266px] shadow-xs border border-neutral-100">
            1 product on Canvas
          </div>

          {/* Price Card */}
          <div className="bg-grad-light rounded-[20px] p-6 sm:p-7 flex flex-col gap-2.5 w-full text-white shadow-md">
            <span className="text-xl sm:text-2xl font-normal text-white/90 tracking-[-0.456px]">
              Price:
            </span>
            <span className="text-3xl sm:text-4xl font-medium tracking-[-0.608px] text-white">
              ₱ 18,000
            </span>
            <span className="text-xs font-normal text-white/80 tracking-[-0.228px]">
              excl. install, final after consultation, etc
            </span>
          </div>

          {/* Workspace Accordions with Motion Animation */}
          <div className="w-full flex flex-col gap-4">
            {/* 1. Adaptive Accordion */}
            <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
              <button
                type="button"
                onClick={() => toggleAccordion("Adaptive")}
                className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
              >
                <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                  Adaptive
                </span>
                <motion.div
                  animate={{ rotate: openAccordions.includes("Adaptive") ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <Image
                    src="/visualization/dropdown-btn.svg"
                    alt="Toggle"
                    width={20}
                    height={20}
                  />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {openAccordions.includes("Adaptive") && (
                  <motion.div
                    key="adaptive-content"
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 flex flex-col gap-4">
                      <div className="flex justify-between items-center text-sm text-[#0f1422]">
                        <span className="text-base tracking-[-0.304px]">Apply Ambient Light Adjustment</span>
                        <button
                          type="button"
                          onClick={() => setAmbientLight(!ambientLight)}
                          className={`w-[44px] h-[24px] rounded-full p-0.5 transition-colors cursor-pointer relative ${ambientLight ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"
                            }`}
                        >
                          <div
                            className={`size-[20px] bg-white rounded-full shadow-xs transform transition-transform ${ambientLight ? "translate-x-[20px]" : "translate-x-0"
                              }`}
                          />
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-sm text-[#0f1422]">
                        <span className="text-base tracking-[-0.304px]">Auto Shadow</span>
                        <button
                          type="button"
                          onClick={() => setAutoShadow(!autoShadow)}
                          className={`w-[44px] h-[24px] rounded-full p-0.5 transition-colors cursor-pointer relative ${autoShadow ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"
                            }`}
                        >
                          <div
                            className={`size-[20px] bg-white rounded-full shadow-xs transform transition-transform ${autoShadow ? "translate-x-[20px]" : "translate-x-0"
                              }`}
                          />
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-sm text-[#0f1422]">
                        <span className="text-base tracking-[-0.304px]">Auto Output Realism</span>
                        <button
                          type="button"
                          onClick={() => setAutoRealism(!autoRealism)}
                          className={`w-[44px] h-[24px] rounded-full p-0.5 transition-colors cursor-pointer relative ${autoRealism ? "bg-[#07b6d3]" : "bg-[#c3c3c3]"
                            }`}
                        >
                          <div
                            className={`size-[20px] bg-white rounded-full shadow-xs transform transition-transform ${autoRealism ? "translate-x-[20px]" : "translate-x-0"
                              }`}
                          />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Placement Accordion */}
            <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
              <button
                type="button"
                onClick={() => toggleAccordion("Placement")}
                className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
              >
                <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                  Placement
                </span>
                <motion.div
                  animate={{ rotate: openAccordions.includes("Placement") ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <Image
                    src="/visualization/dropdown-btn.svg"
                    alt="Toggle"
                    width={20}
                    height={20}
                  />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {openAccordions.includes("Placement") && (
                  <motion.div
                    key="placement-content"
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 flex flex-col gap-5">
                      {/* 3D Yaw */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[#c3c3c3] text-base font-normal">3d Yaw</span>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="-180"
                            max="180"
                            value={yaw}
                            onChange={(e) => setYaw(Number(e.target.value))}
                            className="w-full accent-[#07b6d3] h-2 bg-[#c3c3c3] rounded-lg cursor-pointer"
                          />
                          <span className="text-[#0f1422] text-xs font-normal whitespace-nowrap min-w-12 text-right">
                            {yaw} Deg
                          </span>
                        </div>
                      </div>

                      {/* 3D Pitch */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[#c3c3c3] text-base font-normal">3d Pitch</span>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="-90"
                            max="90"
                            value={pitch}
                            onChange={(e) => setPitch(Number(e.target.value))}
                            className="w-full accent-[#07b6d3] h-2 bg-[#c3c3c3] rounded-lg cursor-pointer"
                          />
                          <span className="text-[#0f1422] text-xs font-normal whitespace-nowrap min-w-12 text-right">
                            {pitch} Deg
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. Design and Customization Option Accordion */}
            <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
              <button
                type="button"
                onClick={() => toggleAccordion("Design and Customization Option")}
                className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
              >
                <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                  Design and Customization Option
                </span>
                <motion.div
                  animate={{ rotate: openAccordions.includes("Design and Customization Option") ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <Image
                    src="/visualization/dropdown-btn.svg"
                    alt="Toggle"
                    width={20}
                    height={20}
                  />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {openAccordions.includes("Design and Customization Option") && (
                  <motion.div
                    key="design-content"
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 flex flex-col gap-6">
                      {/* Aluminum Finish */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[#c3c3c3] text-base font-normal">Aluminum Finish</span>
                        <div className="flex flex-col gap-2.5">
                          {/* Option 1: Analok */}
                          <label
                            onClick={() => setAlumFinish("analok")}
                            className="flex items-center gap-3 cursor-pointer select-none"
                          >
                            <div className="w-3 h-3 rounded-full border border-[#0f1422] flex items-center justify-center p-0.5">
                              {alumFinish === "analok" && (
                                <div className="w-full h-full rounded-full bg-[#0f1422]" />
                              )}
                            </div>
                            {/* Swatch circle */}
                            <div className="size-6 rounded-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 shadow-xs border border-white" />
                            <span className="text-[#0f1422] text-base font-normal">
                              Analok (Champagne / Gold)
                            </span>
                          </label>

                          {/* Option 2: Matte Gray */}
                          <label
                            onClick={() => setAlumFinish("gray")}
                            className="flex items-center gap-3 cursor-pointer select-none"
                          >
                            <div className="w-3 h-3 rounded-full border border-[#0f1422] flex items-center justify-center p-0.5">
                              {alumFinish === "gray" && (
                                <div className="w-full h-full rounded-full bg-[#0f1422]" />
                              )}
                            </div>
                            {/* Swatch circle */}
                            <div className="size-6 rounded-full bg-[#4C4B4B] shadow-xs border border-white" />
                            <span className="text-[#0f1422] text-base font-normal">
                              Matte Gray
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Glass Type */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[#c3c3c3] text-base font-normal">Glass Type</span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setGlassType("tempered")}
                            className={`px-3 py-1.5 rounded-[20px] border border-[#c3c3c3] text-base font-normal transition-colors cursor-pointer ${glassType === "tempered"
                                ? "bg-[#0f1422] text-white"
                                : "bg-transparent text-[#0f1422]"
                              }`}
                          >
                            Tempered Glass
                          </button>
                          <button
                            type="button"
                            onClick={() => setGlassType("clear")}
                            className={`px-3 py-1.5 rounded-[20px] border border-[#c3c3c3] text-base font-normal transition-colors cursor-pointer ${glassType === "clear"
                                ? "bg-[#0f1422] text-white"
                                : "bg-transparent text-[#0f1422]"
                              }`}
                          >
                            Clear Glass
                          </button>
                        </div>
                      </div>

                      {/* Dimension */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[#0f1422] text-base font-medium">Dimension</span>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[#c3c3c3] text-sm">Width (cm)</span>
                            <input
                              type="text"
                              value={widthCm}
                              onChange={(e) => setWidthCm(e.target.value)}
                              className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 text-center text-[#0f1422] text-base shadow-[0px_0px_7px_rgba(0,0,0,0.1)] focus:outline-none"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[#c3c3c3] text-sm">Height (cm)</span>
                            <input
                              type="text"
                              value={heightCm}
                              onChange={(e) => setHeightCm(e.target.value)}
                              className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 text-center text-[#0f1422] text-base shadow-[0px_0px_7px_rgba(0,0,0,0.1)] focus:outline-none"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[#c3c3c3] text-sm">Thickness (mm)</span>
                            <input
                              type="text"
                              value={thicknessMm}
                              onChange={(e) => setThicknessMm(e.target.value)}
                              className="w-full bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 text-center text-[#0f1422] text-base shadow-[0px_0px_7px_rgba(0,0,0,0.1)] focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[#0f1422] text-base font-medium">Quantity</span>
                        <div className="flex flex-col gap-1">
                          <span className="text-[#c3c3c3] text-sm">Qty</span>
                          <div className="bg-white border border-[#c3c3c3] rounded-[10px] px-3 py-1.5 flex items-center justify-between w-28 shadow-[0px_0px_7px_rgba(0,0,0,0.1)]">
                            <button
                              type="button"
                              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                              className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
                            >
                              <Image
                                src="/visualization/minus-solid-full 1.svg"
                                alt="Minus"
                                width={10}
                                height={10}
                              />
                            </button>
                            <span className="text-[#0f1422] text-base font-medium">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => setQuantity((q) => q + 1)}
                              className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
                            >
                              <Image
                                src="/visualization/plus-solid-full 1.svg"
                                alt="Plus"
                                width={10}
                                height={10}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 4. Object Aware Occlusion Accordion */}
            <div className="bg-[#f5f5f5]/30 border border-white rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] overflow-hidden transition-colors">
              <button
                type="button"
                onClick={() => toggleAccordion("Object Aware Occlusion")}
                className="w-full p-6 flex justify-between items-center text-left cursor-pointer"
              >
                <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                  Object Aware Occlusion
                </span>
                <motion.div
                  animate={{ rotate: openAccordions.includes("Object Aware Occlusion") ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <Image
                    src="/visualization/dropdown-btn.svg"
                    alt="Toggle"
                    width={20}
                    height={20}
                  />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {openAccordions.includes("Object Aware Occlusion") && (
                  <motion.div
                    key="occlusion-content"
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 flex flex-col gap-3">
                      {occlusions.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleOcclusion(item.id)}
                          className="bg-white rounded-[20px] p-5 flex justify-between items-center shadow-xs cursor-pointer hover:border-neutral-200 border border-transparent transition-colors"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-[#0f1422] text-[18px] font-medium tracking-[-0.342px]">
                              {item.label}
                            </span>
                            <span className="text-[#c3c3c3] text-xs font-normal">
                              Confidence: {item.confidence}
                            </span>
                            <span className="text-[#0f1422] text-sm font-normal">
                              Put Product Behind
                            </span>
                          </div>
                          <div
                            className={`size-3.5 rounded-[2px] border transition-colors ${item.active
                                ? "bg-[#0f1422] border-[#0f1422]"
                                : "bg-[#c3c3c3] border-transparent"
                              }`}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Apply Changes Primary CTA */}
          <button
            type="button"
            className="w-full bg-green hover:bg-[#06a3bd] text-white text-lg sm:text-[20px] font-normal py-4 rounded-[25px] transition-colors cursor-pointer shadow-sm text-center tracking-[-0.38px]"
          >
            Apply Changes
          </button>
        </div>
      </div>

      {/* ── Bottom Step Navigation Bar ── */}
      <div className="bg-[#f5f5f5] w-full rounded-[20px] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 select-none shadow-sm mt-4">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="w-full sm:w-auto bg-[#0f1422] hover:bg-black text-white font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer text-center"
        >
          Back
        </button>

        {/* Action Buttons Right */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
          <button
            type="button"
            className="w-full sm:w-auto bg-transparent border border-[#0f1422] hover:bg-neutral-100 text-[#0f1422] font-normal text-base sm:text-[20px] tracking-[-0.38px] leading-[1.4] px-6 py-3.5 rounded-[25px] transition-colors cursor-pointer text-center"
          >
            Save Snapshot
          </button>
          <Link href="/comparison" className="w-full sm:w-auto">
            <Button
              variant="lightGradWhiteText"
              value="Continue to Comparison"
              leftIcon={null}
              rightIcon={
                <Image
                  src="/right_arrow.svg"
                  width={25}
                  height={25}
                  alt="Arrow right"
                />
              }
              className="w-full sm:w-auto justify-center"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}


