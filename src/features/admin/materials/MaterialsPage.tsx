import { getRawMaterials } from "@/lib/admin/materials/materialActions";
import { MaterialsContent } from "./MaterialsContent";

export async function MaterialsPage() {
  const materials = await getRawMaterials();
  return <MaterialsContent initialMaterials={materials} />;
}
