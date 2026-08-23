"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { activateProduct } from "@/lib/admin/products/publishMutations";
import { fetchDraftStructuralDefinition } from "@/lib/admin/products/validationMutations";
import type { ProductStructuralDefinition } from "@/lib/visualization/types";

export type ReviewAndPublishSectionProps = {
    productId: string;
};

export function ReviewAndPublishSection({ productId }: ReviewAndPublishSectionProps) {
    const router = useRouter();
    const [isActivating, setIsActivating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [draft, setDraft] = useState<ProductStructuralDefinition | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setIsLoading(true);
                const def = await fetchDraftStructuralDefinition(productId);
                setDraft(def);
            } catch (e: any) {
                setErrorMsg(e.message);
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, [productId]);

    const handleActivate = async () => {
        setIsActivating(true);
        setErrorMsg(null);
        try {
            await activateProduct(productId);
            // Redirect to admin product list
            router.push("/admin/products");
            router.refresh();
        } catch (e: any) {
            setErrorMsg(e.message);
            setIsActivating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-neutral-300" />
            </div>
        );
    }

    if (errorMsg && !draft) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-start gap-3">
                <XCircle className="size-5 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
            </div>
        );
    }

    const isParametric = draft?.template?.modelStrategy === "Parametric";
    const hasAssets = (draft?.assets?.length ?? 0) > 0;
    const hasParams = (draft?.parameters?.length ?? 0) > 0;
    const hasComponents = (draft?.components?.length ?? 0) > 0;

    let canActivate = true;
    let missingErrors = [];

    if (isParametric) {
        if (!hasParams) {
            canActivate = false;
            missingErrors.push("Parametric products require at least one parameter.");
        }
        if (!hasComponents) {
            canActivate = false;
            missingErrors.push("Parametric products require at least one component.");
        }
    } else {
        if (!hasAssets) {
            canActivate = false;
            missingErrors.push("Fixed products require a 3D model asset.");
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    Final Review & Publish
                </h2>
                <p className="text-sm text-neutral-500 max-w-2xl">
                    Review the product configuration before making it available in the customer catalog.
                </p>
            </div>

            {errorMsg && (
                <div className="p-4 bg-red-50 text-red-600 rounded-[12px] flex items-start gap-3 text-sm">
                    <XCircle className="size-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Activation Failed</p>
                        <p className="mt-1 opacity-90">{errorMsg}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-neutral-200 rounded-[12px] p-5 bg-white shadow-sm flex flex-col gap-2">
                    <div className="text-sm font-medium text-neutral-500">Strategy</div>
                    <div className="text-lg text-[#0f1422]">{draft?.template?.modelStrategy || "Unknown"}</div>
                </div>
                
                <div className="border border-neutral-200 rounded-[12px] p-5 bg-white shadow-sm flex flex-col gap-2">
                    <div className="text-sm font-medium text-neutral-500">Components</div>
                    <div className="text-lg text-[#0f1422]">{draft?.components?.length ?? 0} configured</div>
                </div>

                <div className="border border-neutral-200 rounded-[12px] p-5 bg-white shadow-sm flex flex-col gap-2">
                    <div className="text-sm font-medium text-neutral-500">Parameters</div>
                    <div className="text-lg text-[#0f1422]">{draft?.parameters?.length ?? 0} defined</div>
                </div>

                <div className="border border-neutral-200 rounded-[12px] p-5 bg-white shadow-sm flex flex-col gap-2">
                    <div className="text-sm font-medium text-neutral-500">Structural Rules</div>
                    <div className="text-lg text-[#0f1422]">{draft?.rules?.length ?? 0} active</div>
                </div>
            </div>

            <div className="border border-neutral-200 rounded-[12px] overflow-hidden">
                <div className="bg-neutral-50 p-4 border-b border-neutral-200">
                    <h3 className="font-medium text-[#0f1422]">Automatic Validation</h3>
                </div>
                <div className="p-4 flex flex-col gap-3">
                    {missingErrors.length === 0 ? (
                        <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                            <CheckCircle2 className="size-5" />
                            <span className="font-medium text-sm">All required fields are present. Ready to publish.</span>
                        </div>
                    ) : (
                        missingErrors.map((err, i) => (
                            <div key={i} className="flex items-center gap-3 text-red-600 bg-red-50 p-3 rounded-lg">
                                <XCircle className="size-5" />
                                <span className="font-medium text-sm">{err}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="flex justify-end mt-4">
                <button
                    onClick={handleActivate}
                    disabled={!canActivate || isActivating}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-[10px] font-medium transition-all text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-900/10"
                >
                    {isActivating ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Activate Product
                </button>
            </div>
        </div>
    );
}
