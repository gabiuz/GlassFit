"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminProductItem } from "./productData";

type AddProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: AdminProductItem) => void;
};

type Step = 1 | 2 | 3;

type VariationOption = {
  id: string;
  name: string;
  priceModifier: string;
};

type VariationGroup = {
  id: string;
  title: string;
  options: VariationOption[];
};

type PhotoAsset = {
  id: string;
  name: string;
  url: string;
};

type Model3DAsset = {
  name: string;
  size: string;
};

type AluminumFinishItem = {
  id: string;
  name: string;
  gradientClass?: string;
  bgStyle?: React.CSSProperties;
};

type GlassFinishItem = {
  id: string;
  name: string;
  gradientClass?: string;
  bgStyle?: React.CSSProperties;
};

const generateProductId = (): string => `PD_${Math.floor(100 + Math.random() * 900)}`;
const generateOptionId = (): string => `opt-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

export function AddProductModal({
  isOpen,
  onClose,
  onAddProduct,
}: AddProductModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);

  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [variantSummary, setVariantSummary] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");

  const [variationGroups, setVariationGroups] = useState<VariationGroup[]>([
    {
      id: "group-size",
      title: "Size",
      options: [{ id: "opt-s1", name: "100x120 cm", priceModifier: "300" }],
    },
    {
      id: "group-alum-color",
      title: "Aluminum Color Finish",
      options: [{ id: "opt-a1", name: "New Option", priceModifier: "0" }],
    },
    {
      id: "group-glass-color",
      title: "Glass Color Finish",
      options: [{ id: "opt-g1", name: "New Option", priceModifier: "0" }],
    },
    {
      id: "group-glass-thickness",
      title: "Glass Thickness",
      options: [{ id: "opt-gt1", name: "New Option", priceModifier: "0" }],
    },
  ]);
  const [photoAssets, setPhotoAssets] = useState<PhotoAsset[]>([
    { id: "p1", name: "main_view.png", url: "/product_card_placeholder.png" },
    { id: "p2", name: "side_view.png", url: "/product_card_placeholder.png" },
    { id: "p3", name: "detail_view.png", url: "/product_card_placeholder.png" },
  ]);

  const [aluminumFinishes, setAluminumFinishes] = useState<AluminumFinishItem[]>([
    {
      id: "f1",
      name: "Natural Silver",
      gradientClass: "bg-gradient-to-b from-[#d9d9d9] to-[#808080]",
    },
    {
      id: "f2",
      name: "Champagne Gold",
      gradientClass: "bg-[conic-gradient(from_180deg,#6d4b08_0%,#8c620f_25%,#aa7915_50%,#e8a622_100%)]",
    },
    {
      id: "f3",
      name: "Matte Black",
      gradientClass: "bg-[conic-gradient(from_180deg,#000000_0%,#060606_12.5%,#0d0d0d_25%,#191919_50%,#333333_100%)]",
    },
  ]);

  const [glassFinishes, setGlassFinishes] = useState<GlassFinishItem[]>([
    {
      id: "gf1",
      name: "Clear",
      gradientClass: "bg-[conic-gradient(from_180deg,#c0f0f8_0%,#99f0ff_100%)]",
    },
    {
      id: "gf2",
      name: "Bronze",
      gradientClass: "bg-[conic-gradient(from_180deg,#e3a26e_0%,#bb8051_50%,#945f35_100%)]",
    },
    {
      id: "gf3",
      name: "Smoke",
      gradientClass: "bg-gradient-to-b from-black/15 to-neutral-400/25 bg-[#d9d9d9]",
    },
  ]);

  const [model3D, setModel3D] = useState<Model3DAsset | null>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const newPhotos: PhotoAsset[] = files.map((file, i) => ({
      id: `photo-${Date.now()}-${i}`,
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setPhotoAssets((prev) => [...prev, ...newPhotos]);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotoAssets((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddFinishUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const newFinishes: AluminumFinishItem[] = files.map((file, i) => ({
      id: `finish-${Date.now()}-${i}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      bgStyle: {
        backgroundImage: `url(${URL.createObjectURL(file)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
    }));
    setAluminumFinishes((prev) => [...prev, ...newFinishes]);
  };

  const handleRemoveFinish = (id: string) => {
    setAluminumFinishes((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddGlassFinishUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const newFinishes: GlassFinishItem[] = files.map((file, i) => ({
      id: `glass-finish-${Date.now()}-${i}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      bgStyle: {
        backgroundImage: `url(${URL.createObjectURL(file)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
    }));
    setGlassFinishes((prev) => [...prev, ...newFinishes]);
  };

  const handleRemoveGlassFinish = (id: string) => {
    setGlassFinishes((prev) => prev.filter((f) => f.id !== id));
  };

  const handle3DUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setModel3D({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    });
  };

  const handleAddOption = (groupId: string) => {
    setVariationGroups((prev) =>
      prev.map((group) => {
        if (group.id === groupId) {
          return {
            ...group,
            options: [
              ...group.options,
              {
                id: generateOptionId(),
                name: "New Option",
                priceModifier: "0",
              },
            ],
          };
        }
        return group;
      })
    );
  };

  const handleUpdateOption = (
    groupId: string,
    optionId: string,
    field: "name" | "priceModifier",
    value: string
  ) => {
    setVariationGroups((prev) =>
      prev.map((group) => {
        if (group.id === groupId) {
          return {
            ...group,
            options: group.options.map((opt) =>
              opt.id === optionId ? { ...opt, [field]: value } : opt
            ),
          };
        }
        return group;
      })
    );
  };

  const handleRemoveOption = (groupId: string, optionId: string) => {
    setVariationGroups((prev) =>
      prev.map((group) => {
        if (group.id === groupId) {
          return {
            ...group,
            options: group.options.filter((opt) => opt.id !== optionId),
          };
        }
        return group;
      })
    );
  };

  const handleRemoveGroup = (groupId: string) => {
    setVariationGroups((prev) => prev.filter((group) => group.id !== groupId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep < 3) {
      setCurrentStep((prev) => (prev < 3 ? ((prev + 1) as Step) : 3));
      return;
    }

    const formattedPrice = basePrice.startsWith("₱")
      ? basePrice
      : `₱ ${Number(basePrice || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    const newProduct: AdminProductItem = {
      id: productId.trim() || generateProductId(),
      name: productName.trim() || "New Product",
      type: category.trim() || "General",
      description: description.trim() || "No description provided",
      basePrice: formattedPrice,
      status: "Published",
    };

    onAddProduct(newProduct);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setCurrentStep(1);
    setProductId("");
    setProductName("");
    setCategory("");
    setVariantSummary("");
    setBasePrice("");
    setDescription("");
    setVariationGroups([
      {
        id: "group-size",
        title: "Size",
        options: [{ id: "opt-s1", name: "100x120 cm", priceModifier: "300" }],
      },
      {
        id: "group-alum-color",
        title: "Aluminum Color Finish",
        options: [{ id: "opt-a1", name: "New Option", priceModifier: "0" }],
      },
      {
        id: "group-glass-color",
        title: "Glass Color Finish",
        options: [{ id: "opt-g1", name: "New Option", priceModifier: "0" }],
      },
      {
        id: "group-glass-thickness",
        title: "Glass Thickness",
        options: [{ id: "opt-gt1", name: "New Option", priceModifier: "0" }],
      },
    ]);
    setPhotoAssets([
      { id: "p1", name: "main_view.png", url: "/product_card_placeholder.png" },
      { id: "p2", name: "side_view.png", url: "/product_card_placeholder.png" },
      { id: "p3", name: "detail_view.png", url: "/product_card_placeholder.png" },
    ]);
    setAluminumFinishes([
      {
        id: "f1",
        name: "Natural Silver",
        gradientClass: "bg-gradient-to-b from-[#d9d9d9] to-[#808080]",
      },
      {
        id: "f2",
        name: "Champagne Gold",
        gradientClass: "bg-[conic-gradient(from_180deg,#6d4b08_0%,#8c620f_25%,#aa7915_50%,#e8a622_100%)]",
      },
      {
        id: "f3",
        name: "Matte Black",
        gradientClass: "bg-[conic-gradient(from_180deg,#000000_0%,#060606_12.5%,#0d0d0d_25%,#191919_50%,#333333_100%)]",
      },
    ]);
    setGlassFinishes([
      {
        id: "gf1",
        name: "Clear",
        gradientClass: "bg-[conic-gradient(from_180deg,#c0f0f8_0%,#99f0ff_100%)]",
      },
      {
        id: "gf2",
        name: "Bronze",
        gradientClass: "bg-[conic-gradient(from_180deg,#e3a26e_0%,#bb8051_50%,#945f35_100%)]",
      },
      {
        id: "gf3",
        name: "Smoke",
        gradientClass: "bg-gradient-to-b from-black/15 to-neutral-400/25 bg-[#d9d9d9]",
      },
    ]);
    setModel3D(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={handleClose} />

      <div className="relative z-10 bg-white rounded-[20px] p-4 sm:p-6 lg:p-[30px] w-full max-w-[1084px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-5 sm:gap-6 lg:gap-[30px]">
        <div className="flex items-start sm:items-center justify-between w-full gap-4">
          <div className="flex flex-col gap-1 text-[#0f1422]">
            <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
              Add Product
            </h2>
            <p className="text-xs sm:text-base lg:text-lg font-normal leading-snug text-neutral-600">
              Fill in Product Info, upload Assets, then configure Variations
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="size-8 sm:size-[35px] bg-[#e74242] rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="size-4 sm:size-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 w-full">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={cn(
              "flex-1 sm:flex-none h-9 sm:h-[45px] px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-[25px] flex items-center justify-center gap-1.5 sm:gap-3 cursor-pointer transition-colors min-w-0",
              currentStep === 1
                ? "bg-[#07b6d3] text-white shadow-xs"
                : "bg-[#c3c3c3] text-white hover:bg-stone-400"
            )}
          >
            <div className="bg-white rounded-[10px] px-1.5 py-[1px] text-[#0f1422] text-[11px] sm:text-xs font-semibold text-center min-w-[16px] sm:min-w-[18px] shrink-0">
              1
            </div>
            <span className="text-xs sm:text-base lg:text-lg font-normal leading-tight truncate">
              Product Info
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={cn(
              "flex-1 sm:flex-none h-9 sm:h-[45px] px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-[25px] flex items-center justify-center gap-1.5 sm:gap-3 cursor-pointer transition-colors min-w-0",
              currentStep === 2
                ? "bg-[#07b6d3] text-white shadow-xs"
                : "bg-[#c3c3c3] text-white hover:bg-stone-400"
            )}
          >
            <div className="bg-white rounded-[10px] px-1.5 py-[1px] text-[#0f1422] text-[11px] sm:text-xs font-semibold text-center min-w-[16px] sm:min-w-[18px] shrink-0">
              2
            </div>
            <span className="text-xs sm:text-base lg:text-lg font-normal leading-tight truncate">
              Variation
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className={cn(
              "flex-1 sm:flex-none h-9 sm:h-[45px] px-2 sm:px-5 py-1.5 sm:py-2.5 rounded-[25px] flex items-center justify-center gap-1.5 sm:gap-3 cursor-pointer transition-colors min-w-0",
              currentStep === 3
                ? "bg-[#07b6d3] text-white shadow-xs"
                : "bg-[#c3c3c3] text-white hover:bg-stone-400"
            )}
          >
            <div className="bg-white rounded-[10px] px-1.5 py-[1px] text-[#0f1422] text-[11px] sm:text-xs font-semibold text-center min-w-[16px] sm:min-w-[18px] shrink-0">
              3
            </div>
            <span className="text-xs sm:text-base lg:text-lg font-normal leading-tight truncate">
              Assets
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 sm:gap-[30px]">
          {currentStep === 1 && (
            <div className="flex flex-col gap-[20px]">

              <div className="flex flex-col lg:flex-row gap-[40px] items-start">
                <div className="flex flex-col gap-[5px] w-full lg:w-[314px] shrink-0">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    Product ID <span className="text-[#e74242]">*</span>
                  </label>
                  <input
                    type="text"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="D-001"
                    required
                    className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-[5px] flex-1 w-full">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    Product Name <span className="text-[#e74242]">*</span>
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g Aluminum Window"
                    required
                    className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                  />
                  <p className="text-[12px] font-normal leading-[1.4] text-[#c3c3c3] tracking-[-0.228px]">
                    This is how customers will see your product in the catalog
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-[40px] items-start">
                <div className="flex flex-col gap-[5px] w-full">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    Product Category <span className="text-[#e74242]">*</span>
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Window / Door / Partition"
                    required
                    className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                  />
                  <p className="text-[12px] font-normal leading-[1.4] text-[#c3c3c3] tracking-[-0.228px]">
                    Used for internal tracking and inventory
                  </p>
                </div>

                <div className="flex flex-col gap-[5px] w-full">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    Product Variant <span className="text-[#e74242]">*</span>
                  </label>
                  <input
                    type="text"
                    value={variantSummary}
                    onChange={(e) => setVariantSummary(e.target.value)}
                    placeholder="Single Track / Double Track"
                    required
                    className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-[5px] w-full">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    Base Price <span className="text-[#e74242]">*</span>
                  </label>
                  <input
                    type="text"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="12,500.00"
                    required
                    className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                  />
                  <p className="text-[12px] font-normal leading-[1.4] text-[#c3c3c3] tracking-[-0.228px]">
                    Starting price — variations may differ
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-[5px] w-full">
                <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                  Description <span className="text-[#e74242]">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short product description for your catalog"
                  rows={3}
                  required
                  className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors resize-none"
                />
                <p className="text-[12px] font-normal leading-[1.4] text-[#c3c3c3] tracking-[-0.228px]">
                  Keep it concise — 1-2 sentences works best
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex flex-col gap-[20px] w-full">
              <div className="flex flex-col gap-[10px] items-start w-full">
                <h3 className="text-[#0f1422] text-[16px] font-medium leading-[1.4] tracking-[-0.304px]">
                  Variation Options
                </h3>
                <p className="text-[#c3c3c3] text-[12px] font-normal leading-[1.4] tracking-[-0.228px]">
                  Group variations by type. Customer selects one option per type during configuration.
                </p>
              </div>

              <div className="flex flex-col gap-[20px] w-full">
                {variationGroups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-[#f5f5f5] rounded-[20px] p-[20px] flex flex-col gap-[10px] w-full"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[#0f1422] text-[16px] font-normal leading-[1.4] tracking-[-0.304px]">
                        {group.title} ({group.options.length} Options)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddOption(group.id)}
                          className="bg-[#0f1422] text-white text-[12px] font-normal leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] flex items-center gap-[6px] hover:bg-black transition-colors cursor-pointer shrink-0"
                        >
                          <Plus className="size-3" />
                          <span>Add</span>
                        </button>
                        {variationGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroup(group.id)}
                            className="text-stone-400 hover:text-[#e74242] transition-colors p-1 cursor-pointer"
                            aria-label="Remove variation group"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-[40px] w-full pt-1">
                      <div className="w-[314px] shrink-0 text-[#c3c3c3] text-[12px] font-normal leading-[1.4] tracking-[-0.228px]">
                        Variation Name
                      </div>
                      <div className="text-[#c3c3c3] text-[12px] font-normal leading-[1.4] tracking-[-0.228px]">
                        Additional Price
                      </div>
                    </div>

                    <div className="flex flex-col gap-[10px] w-full">
                      {group.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 md:gap-[40px] w-full bg-white md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border border-neutral-200 md:border-0"
                        >
                          <div className="w-full md:w-[314px] shrink-0">
                            <label className="block md:hidden text-[#c3c3c3] text-[11px] font-normal mb-1">
                              Variation Name
                            </label>
                            <input
                              type="text"
                              value={opt.name}
                              onChange={(e) =>
                                handleUpdateOption(group.id, opt.id, "name", e.target.value)
                              }
                              placeholder="Variation Name"
                              className="w-full bg-white border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-[#0f1422] placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                            />
                          </div>

                          <div className="flex items-center gap-[10px] w-full md:w-auto">
                            <span className="text-[#c3c3c3] text-[12px] font-normal leading-[1.4] tracking-[-0.228px] shrink-0">
                              + ₱
                            </span>
                            <div className="flex-1 md:flex-none md:w-[314px] shrink-0">
                              <input
                                type="text"
                                value={opt.priceModifier}
                                onChange={(e) =>
                                  handleUpdateOption(group.id, opt.id, "priceModifier", e.target.value)
                                }
                                placeholder="0"
                                className="w-full bg-white border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-[#0f1422] placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                              />
                            </div>
                            {group.options.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(group.id, opt.id)}
                                className="text-stone-400 hover:text-[#e74242] transition-colors p-1.5 cursor-pointer ml-auto md:ml-2 shrink-0"
                                aria-label="Remove option"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex flex-col gap-[30px] w-full">
              <div className="flex flex-col gap-[15px] w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col gap-1 items-start">
                    <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                      2D Product Photos <span className="text-[#e74242]">*</span>
                    </label>
                    <p className="text-[#c3c3c3] text-[14px] font-normal leading-[1.4] tracking-[-0.266px]">
                      JPG or PNG · 5MB max each
                    </p>
                  </div>

                  <label className="bg-[#0f1422] text-white text-[12px] font-normal leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] flex items-center gap-[6px] hover:bg-black transition-colors cursor-pointer shrink-0">
                    <Plus className="size-3" />
                    <span>Add Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-[30px] overflow-x-auto pb-2 w-full">
                  {photoAssets.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="flex flex-col gap-[5px] items-center shrink-0"
                    >
                      <div className="relative rounded-[20px] size-[205px] bg-[#f6f6f6] border border-neutral-200/80 overflow-hidden flex items-center justify-center group">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="object-cover size-full"
                        />

                        <div className="absolute top-[15px] left-[15px] bg-[#07b6d3] text-white text-[14px] font-normal leading-[1.4] tracking-[-0.266px] px-[8px] py-[2px] rounded-[3px] shadow-xs">
                          #{index + 1}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="absolute top-[15px] right-[15px] size-[20px] bg-black/50 hover:bg-[#e74242] text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                          aria-label="Remove photo"
                        >
                          <X className="size-3" />
                        </button>
                      </div>

                      <p className="text-[#0f1422] text-[18px] font-normal leading-[1.5] tracking-[-0.342px] text-center max-w-[205px] truncate">
                        {photo.name}
                      </p>
                    </div>
                  ))}

                  <label className="bg-[#c3c3c3] hover:bg-stone-400 transition-colors rounded-[20px] size-[205px] flex items-center justify-center cursor-pointer shrink-0 text-white self-start">
                    <Plus className="size-[53px]" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-[10px] items-start w-full pt-2">
                <div className="flex flex-col gap-1 items-start w-full">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    3D Model <span className="text-[#e74242]">*</span>
                  </label>
                  <p className="text-[#c3c3c3] text-[12px] font-normal leading-[1.4] tracking-[-0.228px]">
                    GLB or GLTF format · 25MB max · Used for visualization workspace
                  </p>
                </div>

                {model3D ? (
                  <div className="bg-[#f5f5f5] p-6 rounded-[20px] flex items-center justify-between w-full border border-neutral-200">
                    <div className="flex items-center gap-4">
                      <Image
                        src="/upload.svg"
                        alt="3D model asset"
                        width={48}
                        height={48}
                        className="size-[48px] object-contain shrink-0"
                      />
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[#0f1422] text-base font-medium">
                          {model3D.name}
                        </p>
                        <p className="text-[#c3c3c3] text-xs">
                          {model3D.size}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModel3D(null)}
                      className="text-[#e74242] text-sm font-medium hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="bg-[#f5f5f5]/30 border-4 border-dashed border-[#07b6d3] rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] p-[40px] sm:p-[60px] flex flex-col gap-[24px] items-center justify-center w-full cursor-pointer hover:bg-[#f5f5f5]/60 transition-colors text-center">
                    <Image
                      src="/upload.svg"
                      alt="Upload 3D model icon"
                      width={82}
                      height={82}
                      className="size-[82px] object-contain shrink-0"
                    />

                    <div className="flex flex-col gap-1 items-center">
                      <p className="text-[#0f1422] text-[28px] sm:text-[32px] font-medium leading-[1.2] tracking-[-0.608px] text-center">
                        Drop your 3D model here
                      </p>
                      <p className="text-[#0f1422] text-[18px] sm:text-[20px] font-normal leading-[1.4] tracking-[-0.38px] text-center">
                        or click to browse your files
                      </p>
                    </div>

                    <div className="bg-[#0f1422] text-white text-[18px] sm:text-[20px] font-normal leading-[1.4] tracking-[-0.38px] px-[20px] py-[15px] rounded-[25px] hover:bg-black transition-colors shadow-xs">
                      Browse Files
                    </div>

                    <p className="text-[#c3c3c3] text-[16px] sm:text-[20px] font-normal leading-[1.4] tracking-[-0.38px] text-center">
                      Accepted file types: .glb, .gltf -- up to 25 mb.
                    </p>

                    <input
                      type="file"
                      accept=".glb,.gltf,.obj"
                      className="hidden"
                      onChange={handle3DUpload}
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-[15px] w-full pt-2">
                <div className="flex flex-col gap-1 items-start">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    Aluminum Finish <span className="text-[#e74242]">*</span>
                  </label>
                  <p className="text-[#c3c3c3] text-[14px] font-normal leading-[1.4] tracking-[-0.266px]">
                    PNG textures for each finish · Linked to variants in next step
                  </p>
                </div>

                <div className="flex items-center gap-[30px] overflow-x-auto pb-2 w-full">
                  {aluminumFinishes.map((finish, index) => (
                    <div
                      key={finish.id}
                      className="flex flex-col gap-[5px] items-center shrink-0"
                    >
                      <div
                        className={cn(
                          "relative rounded-[20px] size-[205px] overflow-hidden flex items-center justify-center border border-neutral-200/80 shadow-xs",
                          finish.gradientClass || "bg-[#e5e5e5]"
                        )}
                        style={finish.bgStyle}
                      >
                        <div className="absolute top-[15px] left-[15px] bg-[#07b6d3] text-white text-[14px] font-normal leading-[1.4] tracking-[-0.266px] px-[8px] py-[2px] rounded-[3px] shadow-xs">
                          #{index + 1}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFinish(finish.id)}
                          className="absolute top-[15px] right-[15px] size-[20px] bg-black/50 hover:bg-[#e74242] text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                          aria-label="Remove finish"
                        >
                          <X className="size-3" />
                        </button>
                      </div>

                      <p className="text-[#0f1422] text-[18px] font-normal leading-[1.5] tracking-[-0.342px] text-center max-w-[205px] truncate">
                        {finish.name}
                      </p>
                    </div>
                  ))}

                  <label className="bg-[#c3c3c3] hover:bg-stone-400 transition-colors rounded-[20px] size-[205px] flex items-center justify-center cursor-pointer shrink-0 text-white self-start">
                    <Plus className="size-[53px]" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddFinishUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-[15px] w-full pt-2">
                <div className="flex flex-col gap-1 items-start">
                  <label className="text-[20px] font-normal leading-[1.4] text-[#0f1422] tracking-[-0.38px]">
                    Glass Finish <span className="text-[#e74242]">*</span>
                  </label>
                  <p className="text-[#c3c3c3] text-[14px] font-normal leading-[1.4] tracking-[-0.266px]">
                    PNG textures for each finish · Linked to variants in next step
                  </p>
                </div>

                <div className="flex items-center gap-[30px] overflow-x-auto pb-2 w-full">
                  {glassFinishes.map((finish, index) => (
                    <div
                      key={finish.id}
                      className="flex flex-col gap-[5px] items-center shrink-0"
                    >
                      <div
                        className={cn(
                          "relative rounded-[20px] size-[205px] overflow-hidden flex items-center justify-center border border-neutral-200/80 shadow-xs",
                          finish.gradientClass || "bg-[#e5e5e5]"
                        )}
                        style={finish.bgStyle}
                      >
                        <div className="absolute top-[15px] left-[15px] bg-[#07b6d3] text-white text-[14px] font-normal leading-[1.4] tracking-[-0.266px] px-[8px] py-[2px] rounded-[3px] shadow-xs">
                          #{index + 1}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveGlassFinish(finish.id)}
                          className="absolute top-[15px] right-[15px] size-[20px] bg-black/50 hover:bg-[#e74242] text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                          aria-label="Remove glass finish"
                        >
                          <X className="size-3" />
                        </button>
                      </div>

                      <p className="text-[#0f1422] text-[18px] font-normal leading-[1.5] tracking-[-0.342px] text-center max-w-[205px] truncate">
                        {finish.name}
                      </p>
                    </div>
                  ))}

                  <label className="bg-[#c3c3c3] hover:bg-stone-400 transition-colors rounded-[20px] size-[205px] flex items-center justify-center cursor-pointer shrink-0 text-white self-start">
                    <Plus className="size-[53px]" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddGlassFinishUpload}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between w-full pt-4">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as Step) : 1));
                }}
                className="bg-[#c3c3c3] text-white text-[14px] font-normal leading-[1.4] tracking-[-0.266px] px-[15px] py-[5px] rounded-[10px] hover:bg-stone-400 transition-colors cursor-pointer flex items-center justify-center gap-[10px]"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentStep((prev) => (prev < 3 ? ((prev + 1) as Step) : 3));
                }}
                className="bg-[#05b64b] text-white text-[14px] font-normal leading-[1.4] tracking-[-0.266px] px-[15px] py-[5px] rounded-[10px] hover:bg-emerald-600 transition-colors cursor-pointer flex items-center justify-center gap-[10px]"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                className="bg-[#05b64b] text-white text-[14px] font-normal leading-[1.4] tracking-[-0.266px] px-[15px] py-[5px] rounded-[10px] hover:bg-emerald-600 transition-colors cursor-pointer flex items-center justify-center gap-[10px]"
              >
                Save Product
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
