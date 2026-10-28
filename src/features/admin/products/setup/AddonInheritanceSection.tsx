"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Info, Layers, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAvailableAddonProducts,
  getCompatibleAddonsForProduct,
  saveProductAddonInheritance,
} from "@/lib/admin/products/addonMutations";
import type { AvailableAddonProduct, AddonAllowedSides, AddonMountingSide } from "@/lib/admin/products/types";

export interface AddonInheritanceSectionProps {
  productId: string;
  isAddon?: boolean;
  productType?: string;
  hostComponents?: Array<Record<string, unknown>>;
}

export function AddonInheritanceSection({
  productId,
  isAddon = false,
  productType = "Window",
  hostComponents = [],
}: AddonInheritanceSectionProps) {
  const [screens, setScreens] = useState<AvailableAddonProduct[]>([]);
  const [grills, setGrills] = useState<AvailableAddonProduct[]>([]);
  const [hasScreen, setHasScreen] = useState(false);
  const [selectedScreenProductIds, setSelectedScreenProductIds] = useState<string[]>([]);
  const [hasGrill, setHasGrill] = useState(false);
  const [selectedGrillProductIds, setSelectedGrillProductIds] = useState<string[]>([]);

  // Mounting side and hatch operator targeting state (IMP-MS80)
  const isOutwardProjecting = productType === "Awning Window" || productType === "Casement Window";
  const [screenAllowedSides, setScreenAllowedSides] = useState<AddonAllowedSides>(
    isOutwardProjecting ? "back" : "both"
  );
  const [screenDefaultSide, setScreenDefaultSide] = useState<AddonMountingSide>("back");
  const [screenHatchTargets, setScreenHatchTargets] = useState<string[]>([]);

  const [grillAllowedSides, setGrillAllowedSides] = useState<AddonAllowedSides>("both");
  const [grillDefaultSide, setGrillDefaultSide] = useState<AddonMountingSide>("front");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const candidateOperatorComponents = useMemo(() => {
    return (hostComponents || []).filter((comp) => {
      const key = String(comp.component_key || comp.componentKey || "").toLowerCase();
      const name = String(comp.component_name || comp.componentName || "").toLowerCase();
      const cat = String(comp.presentation_category || comp.presentationCategory || comp.component_type || "").toLowerCase();
      return (
        key.includes("operator") ||
        key.includes("crank") ||
        key.includes("latch") ||
        key.includes("handle") ||
        key.includes("rotator") ||
        name.includes("operator") ||
        name.includes("crank") ||
        name.includes("latch") ||
        name.includes("handle") ||
        name.includes("rotator") ||
        cat.includes("hardware")
      );
    });
  }, [hostComponents]);

  const loadData = useCallback(async () => {
    if (!productId || productId === "draft") {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);

      const [availableScreens, availableGrills, bindings] = await Promise.all([
        getAvailableAddonProducts("screen"),
        getAvailableAddonProducts("grill"),
        getCompatibleAddonsForProduct(productId),
      ]);

      setScreens(availableScreens);
      setGrills(availableGrills);

      const screenBindings = bindings.filter((b) => b.addonType === "screen");
      if (screenBindings.length > 0) {
        setHasScreen(true);
        setSelectedScreenProductIds(screenBindings.map((b) => b.addonProductId));
        setScreenAllowedSides(screenBindings[0].allowedSides ?? (isOutwardProjecting ? "back" : "both"));
        setScreenDefaultSide(screenBindings[0].defaultSide ?? "back");
        setScreenHatchTargets(screenBindings[0].hatchTargetComponentKeys ?? []);
      } else {
        setHasScreen(false);
        setSelectedScreenProductIds(availableScreens.length > 0 ? [availableScreens[0].productId] : []);
        setScreenAllowedSides(isOutwardProjecting ? "back" : "both");
        setScreenDefaultSide("back");
        setScreenHatchTargets([]);
      }

      const grillBindings = bindings.filter((b) => b.addonType === "grill");
      if (grillBindings.length > 0) {
        setHasGrill(true);
        setSelectedGrillProductIds(grillBindings.map((b) => b.addonProductId));
        setGrillAllowedSides(grillBindings[0].allowedSides ?? "both");
        setGrillDefaultSide(grillBindings[0].defaultSide ?? "front");
      } else {
        setHasGrill(false);
        setSelectedGrillProductIds(availableGrills.length > 0 ? [availableGrills[0].productId] : []);
        setGrillAllowedSides("both");
        setGrillDefaultSide("front");
      }
    } catch (err: unknown) {
      console.error("Failed to load add-on configuration:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to load add-on attachments.");
    } finally {
      setIsLoading(false);
    }
  }, [productId, isOutwardProjecting]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const toggleScreenSelection = (id: string) => {
    setSelectedScreenProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleAllScreens = () => {
    if (selectedScreenProductIds.length === screens.length) {
      setSelectedScreenProductIds([]);
    } else {
      setSelectedScreenProductIds(screens.map((s) => s.productId));
    }
  };

  const toggleGrillSelection = (id: string) => {
    setSelectedGrillProductIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const toggleAllGrills = () => {
    if (selectedGrillProductIds.length === grills.length) {
      setSelectedGrillProductIds([]);
    } else {
      setSelectedGrillProductIds(grills.map((g) => g.productId));
    }
  };

  const handleSave = async () => {
    if (!productId || productId === "draft") {
      setErrorMsg("A saved product draft is required before configuring add-on attachments.");
      return;
    }

    if (hasScreen && selectedScreenProductIds.length === 0) {
      setErrorMsg("Please select at least one insect screen template or uncheck the screen option.");
      return;
    }

    if (hasGrill && selectedGrillProductIds.length === 0) {
      setErrorMsg("Please select at least one security grille template or uncheck the grille option.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSaveStatus("idle");

      await saveProductAddonInheritance(productId, {
        hasScreen,
        screenAddonProductId: selectedScreenProductIds[0] ?? null,
        screenAddonProductIds: hasScreen ? selectedScreenProductIds : [],
        screenAllowedSides,
        screenDefaultSide,
        screenHatchTargetComponentKeys: screenHatchTargets,
        hasGrill,
        grillAddonProductId: selectedGrillProductIds[0] ?? null,
        grillAddonProductIds: hasGrill ? selectedGrillProductIds : [],
        grillAllowedSides,
        grillDefaultSide,
      });

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: unknown) {
      console.error("Failed to save add-on configuration:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to save add-on attachments.");
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isAddon) {
    return (
      <div className="bg-neutral-50 rounded-[12px] border border-neutral-200 p-6 flex items-start gap-3">
        <Info className="size-5 text-neutral-500 shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1 text-sm text-neutral-600">
          <p className="font-medium text-neutral-800">Add-on Accessory Notice</p>
          <p>
            This product is configured as an add-on accessory. Add-on items cannot attach other add-ons.
            Compatible add-on attachments are configured on parent host products such as windows and doors.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-neutral-500 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading compatible add-ons...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-[#0f1422] flex items-center gap-2">
          <Layers className="size-5 text-[#07b6d3]" />
          Compatible Add-on Attachments
        </h3>
        <p className="text-sm text-neutral-600">
          Enable modular add-ons that customers can toggle during 3D visualization and quotation.
          If multiple screen mesh or grille options are selected, customers can choose which style they want in the workspace.
        </p>
      </div>

      {/* Mutual Exclusion Explanatory Notice */}
      <div className="flex items-start gap-3 bg-[#e9f9fb] border border-[#a2e7f2] p-4 rounded-[10px] text-sm text-[#097283]">
        <Info className="size-5 text-[#07b6d3] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">Interactive Mutual Exclusion Notice:</span>
          <span>
            In the customer visualization workspace, customers will see a toggle similar to the sill option.
            Enabling the screen will automatically disable the grill, and vice versa. Selecting multiple add-on options allows customers to choose from multiple screen or grille variations.
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 p-3 rounded-[8px] text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Screen Add-on Card */}
        <div
          className={cn(
            "flex flex-col gap-4 p-5 rounded-[12px] border transition-all",
            hasScreen ? "border-teal-300 bg-teal-50/30" : "border-neutral-200 bg-white"
          )}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasScreen}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasScreen(checked);
                  if (checked && selectedScreenProductIds.length === 0 && screens.length > 0) {
                    setSelectedScreenProductIds([screens[0].productId]);
                  }
                }}
                className="size-4 rounded text-[#07b6d3] focus:ring-[#07b6d3]"
              />
              <span className="font-semibold text-sm text-[#0f1422]">
                Enable Insect Screen Attachment
              </span>
            </label>
            <div className="flex items-center gap-2">
              {hasScreen && selectedScreenProductIds.length > 0 && (
                <span className="text-[11px] text-teal-700 bg-teal-100/70 font-semibold px-2 py-0.5 rounded-md">
                  {selectedScreenProductIds.length} of {screens.length} selected
                </span>
              )}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium border border-teal-200">
                Screen
              </span>
            </div>
          </div>

          {hasScreen && (
            <div className="flex flex-col gap-3 pt-3 border-t border-teal-200/60 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700">
                  Select Compatible Screen / Mesh Templates
                </span>
                {screens.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllScreens}
                    className="text-xs text-[#07b6d3] hover:underline font-medium cursor-pointer"
                  >
                    {selectedScreenProductIds.length === screens.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {screens.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-200">
                  No active screen add-on templates found. Create and publish an insect screen accessory first.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {screens.map((screen) => {
                    const isSelected = selectedScreenProductIds.includes(screen.productId);
                    return (
                      <div
                        key={screen.productId}
                        onClick={() => toggleScreenSelection(screen.productId)}
                        className={cn(
                          "flex items-start justify-between p-3 rounded-[10px] border cursor-pointer transition-all select-none",
                          isSelected
                            ? "bg-white border-teal-400 shadow-xs ring-1 ring-teal-300/50"
                            : "bg-white/80 border-neutral-200 hover:border-neutral-300 opacity-75 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleScreenSelection(screen.productId)}
                            onClick={(e) => e.stopPropagation()}
                            className="size-4 mt-0.5 rounded text-[#07b6d3] focus:ring-[#07b6d3] cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-neutral-900">
                              {screen.productName}
                            </span>
                            {screen.description && (
                              <span className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                                {screen.description}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-neutral-700 shrink-0 ml-2">
                          ₱{screen.basePrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedScreenProductIds.length === 0 && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded-md">
                  Please select at least one screen template or disable screen attachment.
                </p>
              )}

              {/* Physical Collision Guardrail Warning (IMP-MS80) */}
              {isOutwardProjecting && screenAllowedSides !== "back" && (
                <div className="flex items-start gap-2.5 p-3 rounded-[10px] bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-amber-950">Physical Collision Warning</span>
                    <span>
                      Awning and casement sashes project outward when opened. Exterior screens will be struck by the opening sash. Interior (Back) mounting is recommended.
                    </span>
                  </div>
                </div>
              )}

              {/* Allowed Mounting Sides (IMP-MS80) */}
              <div className="flex flex-col gap-2 pt-3 border-t border-teal-200/60">
                <span className="text-xs font-semibold text-neutral-800">Allowed Mounting Sides</span>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-[8px] border text-xs cursor-pointer transition-all",
                      screenAllowedSides === "front"
                        ? "border-teal-500 bg-teal-50/50 font-medium text-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="screenAllowedSides"
                      value="front"
                      checked={screenAllowedSides === "front"}
                      onChange={() => setScreenAllowedSides("front")}
                      className="size-3.5 text-[#07b6d3] focus:ring-[#07b6d3]"
                    />
                    <span>Front (Exterior) Only</span>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-[8px] border text-xs cursor-pointer transition-all",
                      screenAllowedSides === "back"
                        ? "border-teal-500 bg-teal-50/50 font-medium text-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="screenAllowedSides"
                      value="back"
                      checked={screenAllowedSides === "back"}
                      onChange={() => setScreenAllowedSides("back")}
                      className="size-3.5 text-[#07b6d3] focus:ring-[#07b6d3]"
                    />
                    <span>Back (Interior) Only</span>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-[8px] border text-xs cursor-pointer transition-all",
                      screenAllowedSides === "both"
                        ? "border-teal-500 bg-teal-50/50 font-medium text-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="screenAllowedSides"
                      value="both"
                      checked={screenAllowedSides === "both"}
                      onChange={() => setScreenAllowedSides("both")}
                      className="size-3.5 text-[#07b6d3] focus:ring-[#07b6d3]"
                    />
                    <span>Both Sides</span>
                  </label>
                </div>

                {screenAllowedSides === "both" && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-[11px] font-medium text-neutral-700">Default Side:</span>
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="screenDefaultSide"
                          value="front"
                          checked={screenDefaultSide === "front"}
                          onChange={() => setScreenDefaultSide("front")}
                          className="size-3 text-[#07b6d3] focus:ring-[#07b6d3]"
                        />
                        <span>Front (Exterior)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="screenDefaultSide"
                          value="back"
                          checked={screenDefaultSide === "back"}
                          onChange={() => setScreenDefaultSide("back")}
                          className="size-3 text-[#07b6d3] focus:ring-[#07b6d3]"
                        />
                        <span>Back (Interior)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Operator-Targeted Screen Hatch Alignment (IMP-MS80) */}
              {candidateOperatorComponents.length > 0 && (
                <div className="flex flex-col gap-2 pt-3 border-t border-teal-200/60">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-neutral-800 flex items-center gap-1.5">
                        <Crosshair className="size-3.5 text-[#07b6d3]" />
                        Operator Hatch Alignment Targets
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        Bind screen access hatches directly to host window operating mechanisms
                      </span>
                    </div>
                    <span className="text-[11px] text-teal-800 bg-teal-100 font-semibold px-2 py-0.5 rounded-md">
                      {screenHatchTargets.length === 0
                        ? "1 default hatch"
                        : `${screenHatchTargets.length} target ${screenHatchTargets.length === 1 ? "operator" : "operators"} (${screenHatchTargets.length} ${screenHatchTargets.length === 1 ? "hatch" : "hatches"})`}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {candidateOperatorComponents.map((comp) => {
                      const compKey = String(comp.component_key || comp.componentKey || "");
                      const compName = String(comp.component_name || comp.componentName || compKey);
                      const isChecked = screenHatchTargets.includes(compKey);
                      return (
                        <label
                          key={compKey}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-[8px] border text-xs cursor-pointer transition-all",
                            isChecked
                              ? "bg-white border-teal-400 ring-1 ring-teal-300/40 text-neutral-900"
                              : "bg-white/60 border-neutral-200 text-neutral-700 hover:border-neutral-300"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setScreenHatchTargets((prev) =>
                                  prev.includes(compKey)
                                    ? prev.filter((k) => k !== compKey)
                                    : [...prev, compKey]
                                );
                              }}
                              className="size-3.5 rounded text-[#07b6d3] focus:ring-[#07b6d3]"
                            />
                            <span className="font-medium">{compName}</span>
                          </div>
                          <span className="text-[11px] text-neutral-400 font-mono">{compKey}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grill Add-on Card */}
        <div
          className={cn(
            "flex flex-col gap-4 p-5 rounded-[12px] border transition-all",
            hasGrill ? "border-amber-300 bg-amber-50/30" : "border-neutral-200 bg-white"
          )}
        >
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasGrill}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasGrill(checked);
                  if (checked && selectedGrillProductIds.length === 0 && grills.length > 0) {
                    setSelectedGrillProductIds([grills[0].productId]);
                  }
                }}
                className="size-4 rounded text-[#07b6d3] focus:ring-[#07b6d3]"
              />
              <span className="font-semibold text-sm text-[#0f1422]">
                Enable Security Grille Attachment
              </span>
            </label>
            <div className="flex items-center gap-2">
              {hasGrill && selectedGrillProductIds.length > 0 && (
                <span className="text-[11px] text-amber-800 bg-amber-100/70 font-semibold px-2 py-0.5 rounded-md">
                  {selectedGrillProductIds.length} of {grills.length} selected
                </span>
              )}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium border border-amber-200">
                Grille
              </span>
            </div>
          </div>

          {hasGrill && (
            <div className="flex flex-col gap-3 pt-3 border-t border-amber-200/60 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700">
                  Select Compatible Security Grille Templates
                </span>
                {grills.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllGrills}
                    className="text-xs text-[#07b6d3] hover:underline font-medium cursor-pointer"
                  >
                    {selectedGrillProductIds.length === grills.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {grills.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-200">
                  No active security grille templates found. Create and publish a grille accessory first.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {grills.map((grill) => {
                    const isSelected = selectedGrillProductIds.includes(grill.productId);
                    return (
                      <div
                        key={grill.productId}
                        onClick={() => toggleGrillSelection(grill.productId)}
                        className={cn(
                          "flex items-start justify-between p-3 rounded-[10px] border cursor-pointer transition-all select-none",
                          isSelected
                            ? "bg-white border-amber-400 shadow-xs ring-1 ring-amber-300/50"
                            : "bg-white/80 border-neutral-200 hover:border-neutral-300 opacity-75 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleGrillSelection(grill.productId)}
                            onClick={(e) => e.stopPropagation()}
                            className="size-4 mt-0.5 rounded text-[#07b6d3] focus:ring-[#07b6d3] cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-neutral-900">
                              {grill.productName}
                            </span>
                            {grill.description && (
                              <span className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                                {grill.description}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-neutral-700 shrink-0 ml-2">
                          ₱{grill.basePrice.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedGrillProductIds.length === 0 && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded-md">
                  Please select at least one security grille template or disable grille attachment.
                </p>
              )}

              {/* Allowed Mounting Sides for Security Grille (IMP-MS80) */}
              <div className="flex flex-col gap-2 pt-3 border-t border-amber-200/60">
                <span className="text-xs font-semibold text-neutral-800">Allowed Mounting Sides</span>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-[8px] border text-xs cursor-pointer transition-all",
                      grillAllowedSides === "front"
                        ? "border-amber-500 bg-amber-50/50 font-medium text-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="grillAllowedSides"
                      value="front"
                      checked={grillAllowedSides === "front"}
                      onChange={() => setGrillAllowedSides("front")}
                      className="size-3.5 text-[#07b6d3] focus:ring-[#07b6d3]"
                    />
                    <span>Front (Exterior) Only</span>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-[8px] border text-xs cursor-pointer transition-all",
                      grillAllowedSides === "back"
                        ? "border-amber-500 bg-amber-50/50 font-medium text-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="grillAllowedSides"
                      value="back"
                      checked={grillAllowedSides === "back"}
                      onChange={() => setGrillAllowedSides("back")}
                      className="size-3.5 text-[#07b6d3] focus:ring-[#07b6d3]"
                    />
                    <span>Back (Interior) Only</span>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-[8px] border text-xs cursor-pointer transition-all",
                      grillAllowedSides === "both"
                        ? "border-amber-500 bg-amber-50/50 font-medium text-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="grillAllowedSides"
                      value="both"
                      checked={grillAllowedSides === "both"}
                      onChange={() => setGrillAllowedSides("both")}
                      className="size-3.5 text-[#07b6d3] focus:ring-[#07b6d3]"
                    />
                    <span>Both Sides</span>
                  </label>
                </div>

                {grillAllowedSides === "both" && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-[11px] font-medium text-neutral-700">Default Side:</span>
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="grillDefaultSide"
                          value="front"
                          checked={grillDefaultSide === "front"}
                          onChange={() => setGrillDefaultSide("front")}
                          className="size-3 text-[#07b6d3] focus:ring-[#07b6d3]"
                        />
                        <span>Front (Exterior)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="grillDefaultSide"
                          value="back"
                          checked={grillDefaultSide === "back"}
                          onChange={() => setGrillDefaultSide("back")}
                          className="size-3 text-[#07b6d3] focus:ring-[#07b6d3]"
                        />
                        <span>Back (Interior)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <div className="flex items-center gap-2">
          {saveStatus === "saved" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="size-4" /> Add-on attachments saved successfully.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#0f1422] text-white px-5 py-2 rounded-[10px] hover:bg-black transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving Attachments...
            </>
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Save Compatible Add-ons
            </>
          )}
        </button>
      </div>
    </div>
  );
}
