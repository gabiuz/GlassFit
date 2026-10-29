import * as THREE from "three";

type PartIntersection = { object: THREE.Object3D; distance: number };

function isRenderedMesh(object: THREE.Object3D): object is THREE.Mesh {
    if (!(object instanceof THREE.Mesh)) return false;
    for (let current: THREE.Object3D | null = object; current; current = current.parent) {
        if (!current.visible) return false;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    return materials.some(material => material.visible && material.opacity > 0 && material.colorWrite);
}

export function getVisiblePartHits(intersections: PartIntersection[]): { id: string; distance: number }[] {
    const hits: { id: string; distance: number }[] = [];
    const seen = new Set<string>();
    for (const hit of intersections) {
        if (!isRenderedMesh(hit.object)) continue;
        let current: THREE.Object3D | null = hit.object;
        while (current && !current.userData.fileId) current = current.parent;
        const id = current?.userData.fileId;
        if (typeof id !== "string" || seen.has(id)) continue;
        seen.add(id);
        hits.push({ id, distance: hit.distance });
    }
    return hits.sort((a, b) => a.distance - b.distance);
}

export function getFrontPartIds(intersections: PartIntersection[]): string[] {
    const hits = getVisiblePartHits(intersections);
    if (hits.length === 0) return [];
    // Coplanar surfaces may represent genuinely overlapping parts. Deeper
    // intersections are behind the visible face and must not enter the choice.
    const tolerance = Math.max(0.0001, hits[0].distance * 0.001);
    return hits.filter(hit => hit.distance - hits[0].distance <= tolerance).map(hit => hit.id);
}
