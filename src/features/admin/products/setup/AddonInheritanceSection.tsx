"use client";

import { useState, useEffect, useCallback } from "react";
import { Info, Layers, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAvailableAddonProducts,
  getCompatibleAddonsForProduct,
  saveProductAddonInheritance,
} from "@/lib/admin/products/addonMutations";
import type { AvailableAddonProduct } from "@/lib/admin/products/types";

export interface AddonInheritanceSectionProps {
  productId: string;
  isAddon?: boolean;
}

export function AddonInheritanceSection({ productId, isAddon = false }: AddonInheritanceSectionProps) {
  const [screens, setScreens] = useState<AvailableAddonProduct[]>([]);
  const [grills, setGrills] = useState<AvailableAddonProduct[]>([]);
  const [hasScreen, setHasScreen] = useState(false);
  const [screenProductId, setScreenProductId] = useState<string>("");
  const [hasGrill, setHasGrill] = useState(false);
  const [grillProductId, setGrillProductId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

      const screenBinding = bindings.find((b) => b.addonType === "screen");
      if (screenBinding) {
        setHasScreen(true);
        setScreenProductId(screenBinding.addonProductId);
      } else if (availableScreens.length > 0) {
        setScreenProductId(availableScreens[0].productId);
      }

      const grillBinding = bindings.find((b) => b.addonType === "grill");
      if (grillBinding) {
        setHasGrill(true);
        setGrillProductId(grillBinding.addonProductId);
      } else if (availableGrills.length > 0) {
        setGrillProductId(availableGrills[0].productId);
      }
    } catch (err: unknown) {
      console.error("Failed to load add-on configuration:", err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to load add-on attachments.");
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!productId || productId === "draft") {
      setErrorMsg("A saved product draft is required before configuring add-on attachments.");
      return;
    }

    if (hasScreen && !screenProductId) {
      setErrorMsg("Please select an insect screen template or uncheck the option.");
      return;
    }

    if (hasGrill && !grillProductId) {
      setErrorMsg("Please select a security grille template or uncheck the option.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSaveStatus("idle");

      await saveProductAddonInheritance(productId, {
        hasScreen,
        screenAddonProductId: hasScreen ? screenProductId : null,
        hasGrill,
        grillAddonProductId: hasGrill ? grillProductId : null,
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

  const selectedScreen = screens.find((s) => s.productId === screenProductId);
  const selectedGrill = grills.find((g) => g.productId === grillProductId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-[#0f1422] flex items-center gap-2">
          <Layers className="size-5 text-[#07b6d3]" />
          Compatible Add-on Attachments
        </h3>
        <p className="text-sm text-neutral-600">
          Enable modular add-ons that customers can toggle during 3D visualization and quotation.
          Customers can choose either the screen or grill, but not both simultaneously.
        </p>
      </div>

      {/* Mutual Exclusion Explanatory Notice */}
      <div className="flex items-start gap-3 bg-[#e9f9fb] border border-[#a2e7f2] p-4 rounded-[10px] text-sm text-[#097283]">
        <Info className="size-5 text-[#07b6d3] shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">Interactive Mutual Exclusion Notice:</span>
          <span>
            In the customer visualization workspace, customers will see a toggle similar to the sill option.
            Enabling the screen will automatically disable the grill, and vice versa.
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
                  setHasScreen(e.target.checked);
                  if (e.target.checked && !screenProductId && screens.length > 0) {
                    setScreenProductId(screens[0].productId);
                  }
                }}
                className="size-4 rounded text-[#07b6d3] focus:ring-[#07b6d3]"
              />
              <span className="font-semibold text-sm text-[#0f1422]">
                Enable Insect Screen Attachment
              </span>
            </label>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-medium border border-teal-200">
              Screen
            </span>
          </div>

          {hasScreen && (
            <div className="flex flex-col gap-3 pt-3 border-t border-teal-200/60 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-700">
                  Select Screen Product Template
                </label>
                {screens.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-200">
                    No active screen add-on templates found. Create and publish an insect screen accessory first.
                  </p>
                ) : (
                  <select
                    value={screenProductId}
                    onChange={(e) => setScreenProductId(e.target.value)}
                    className="w-full border border-neutral-300 rounded-[8px] px-3 py-2 text-sm text-black bg-white focus:outline-none focus:border-[#07b6d3]"
                  >
                    {screens.map((s) => (
                      <option key={s.productId} value={s.productId}>
                        {s.productName} (₱{s.basePrice.toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedScreen && (
                <div className="flex flex-col gap-1 text-xs text-neutral-600 bg-white p-3 rounded-[8px] border border-neutral-200">
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-800">Add-on Item:</span>
                    <span>{selectedScreen.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-800">Base Surcharge:</span>
                    <span>₱{selectedScreen.basePrice.toFixed(2)}</span>
                  </div>
                  {selectedScreen.description && (
                    <div className="mt-1 pt-1 border-t border-neutral-100 text-neutral-500">
                      {selectedScreen.description}
                    </div>
                  )}
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
                  setHasGrill(e.target.checked);
                  if (e.target.checked && !grillProductId && grills.length > 0) {
                    setGrillProductId(grills[0].productId);
                  }
                }}
                className="size-4 rounded text-[#07b6d3] focus:ring-[#07b6d3]"
              />
              <span className="font-semibold text-sm text-[#0f1422]">
                Enable Security Grille Attachment
              </span>
            </label>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium border border-amber-200">
              Grille
            </span>
          </div>

          {hasGrill && (
            <div className="flex flex-col gap-3 pt-3 border-t border-amber-200/60 text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-700">
                  Select Grille Product Template
                </label>
                {grills.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-md border border-amber-200">
                    No active security grille templates found. Create and publish a grille accessory first.
                  </p>
                ) : (
                  <select
                    value={grillProductId}
                    onChange={(e) => setGrillProductId(e.target.value)}
                    className="w-full border border-neutral-300 rounded-[8px] px-3 py-2 text-sm text-black bg-white focus:outline-none focus:border-[#07b6d3]"
                  >
                    {grills.map((g) => (
                      <option key={g.productId} value={g.productId}>
                        {g.productName} (₱{g.basePrice.toFixed(2)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedGrill && (
                <div className="flex flex-col gap-1 text-xs text-neutral-600 bg-white p-3 rounded-[8px] border border-neutral-200">
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-800">Add-on Item:</span>
                    <span>{selectedGrill.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-800">Base Surcharge:</span>
                    <span>₱{selectedGrill.basePrice.toFixed(2)}</span>
                  </div>
                  {selectedGrill.description && (
                    <div className="mt-1 pt-1 border-t border-neutral-100 text-neutral-500">
                      {selectedGrill.description}
                    </div>
                  )}
                </div>
              )}
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
