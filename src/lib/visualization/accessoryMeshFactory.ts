/**
 * GlassFit Procedural & Swappable Hardware Accessory Mesh Factory (IMP-MS75)
 *
 * Provides real-time canonical 3D hardware accessory models for the admin validation
 * sandbox and customer workspace accessory swapping subsystem.
 *
 * Upstream Specifications: docs/implementation/ms75.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F14, SDD-C4, DSD-UI10, QAD-TC90
 */

import * as THREE from "three";
import type { AccessoryCategory } from "@/lib/admin/products/types";

export interface AccessoryCatalogOption {
  id: string;
  name: string;
  category: AccessoryCategory;
  description: string;
  priceDelta: number;
}

export const CANONICAL_ACCESSORIES_CATALOG: AccessoryCatalogOption[] = [
  {
    id: "canonical_lever_handle",
    name: "Standard Ergonomic Lever Handle",
    category: "handle",
    description: "Architectural satin aluminum lever handle with spring-assisted latch mechanism.",
    priceDelta: 0,
  },
  {
    id: "canonical_privacy_knob",
    name: "Classic Privacy Ball Knob",
    category: "handle",
    description: "Round stainless steel ball knob with interior thumb-turn lock for privacy doors.",
    priceDelta: 450,
  },
  {
    id: "canonical_pull_bar",
    name: "Stainless Architectural Pull Bar (400mm)",
    category: "handle",
    description: "Long tubular cylindrical stainless steel pull bar with dual standoff mounts.",
    priceDelta: 950,
  },
  {
    id: "canonical_smart_lock",
    name: "Keyless Digital Smart Lock",
    category: "lock",
    description: "Electronic keypad smart lock with illuminated touch matrix and emergency keyway.",
    priceDelta: 4800,
  },
  {
    id: "canonical_cylinder_lock",
    name: "Euro-Profile Double Cylinder Deadbolt",
    category: "lock",
    description: "Heavy-duty brass cylinder deadbolt with hardened steel anti-drill pins.",
    priceDelta: 850,
  },
  {
    id: "canonical_tandem_roller",
    name: "Heavy-Duty Dual Tandem Roller",
    category: "roller",
    description: "Stainless steel ball-bearing tandem roller for smooth high-load patio sliding doors.",
    priceDelta: 650,
  },
  {
    id: "canonical_single_roller",
    name: "Single Precision Guide Roller",
    category: "roller",
    description: "Nylon wheel guide roller with height-adjustable zinc bracket.",
    priceDelta: 0,
  },
];

/**
 * Creates metallic hardware PBR materials tailored for hardware accessories.
 */
function createHardwareMaterials(finish: "satin" | "black" | "brass" = "satin") {
  let mainColor = 0xd8d8d8;
  let metalness = 0.85;
  let roughness = 0.25;

  if (finish === "black") {
    mainColor = 0x1f232b;
    metalness = 0.7;
    roughness = 0.35;
  } else if (finish === "brass") {
    mainColor = 0xd4af37;
    metalness = 0.9;
    roughness = 0.2;
  }

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: mainColor,
    metalness,
    roughness,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x111622,
    metalness: 0.95,
    roughness: 0.15,
  });

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x07b6d3,
  });

  return { baseMaterial, accentMaterial, glowMaterial };
}

/**
 * Builds a modern ergonomic lever handle with an escutcheon backplate.
 */
export function buildLeverHandleGroup(finish: "satin" | "black" | "brass" = "satin"): THREE.Group {
  const group = new THREE.Group();
  group.name = "Accessory_LeverHandle";
  const { baseMaterial, accentMaterial } = createHardwareMaterials(finish);

  // 1. Escutcheon backplate (rectangular plate mounted on door face)
  const plateGeom = new THREE.BoxGeometry(0.045, 0.22, 0.008);
  const plate = new THREE.Mesh(plateGeom, baseMaterial);
  plate.position.set(0, 0, 0.004);
  group.add(plate);

  // 2. Pivot boss collar
  const collarGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.022, 24);
  const collar = new THREE.Mesh(collarGeom, accentMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.04, 0.019);
  group.add(collar);

  // 3. Lever stem and horizontal handle arm
  const handleStemGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.045, 16);
  const handleStem = new THREE.Mesh(handleStemGeom, baseMaterial);
  handleStem.rotation.x = Math.PI / 2;
  handleStem.position.set(0, 0.04, 0.038);
  group.add(handleStem);

  const leverBarGeom = new THREE.BoxGeometry(0.125, 0.02, 0.012);
  const leverBar = new THREE.Mesh(leverBarGeom, baseMaterial);
  leverBar.position.set(0.055, 0.04, 0.06);
  group.add(leverBar);

  // 4. Keyhole / cylinder cutout indicator
  const keyholeGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.01, 16);
  const keyhole = new THREE.Mesh(keyholeGeom, accentMaterial);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, -0.045, 0.009);
  group.add(keyhole);

  return group;
}

/**
 * Builds a keyless digital smart lock with a numeric keypad touchplate and lever.
 */
export function buildSmartLockGroup(finish: "black" | "satin" = "black"): THREE.Group {
  const group = new THREE.Group();
  group.name = "Accessory_SmartLock";
  const { baseMaterial, accentMaterial, glowMaterial } = createHardwareMaterials(finish);

  // 1. Tall slim smart lock escutcheon body
  const bodyGeom = new THREE.BoxGeometry(0.065, 0.34, 0.022);
  const body = new THREE.Mesh(bodyGeom, accentMaterial);
  body.position.set(0, 0, 0.011);
  group.add(body);

  // 2. Front touch display screen
  const screenGeom = new THREE.PlaneGeometry(0.052, 0.13);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d14,
    metalness: 0.9,
    roughness: 0.1,
  });
  const screen = new THREE.Mesh(screenGeom, screenMat);
  screen.position.set(0, 0.08, 0.0225);
  group.add(screen);

  // 3. Status LED indicator dot
  const ledGeom = new THREE.CircleGeometry(0.0035, 16);
  const led = new THREE.Mesh(ledGeom, glowMaterial);
  led.position.set(0, 0.13, 0.0228);
  group.add(led);

  // 4. Numeric keypad grid dots
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col <= 1; col++) {
      if (row === 3 && Math.abs(col) === 1) continue;
      const dotGeom = new THREE.CircleGeometry(0.0025, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x88bbdd });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.set(col * 0.014, 0.095 - row * 0.022, 0.0228);
      group.add(dot);
    }
  }

  // 5. Spring-assisted lever handle
  const collarGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.025, 24);
  const collar = new THREE.Mesh(collarGeom, baseMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, -0.06, 0.028);
  group.add(collar);

  const leverArmGeom = new THREE.BoxGeometry(0.13, 0.024, 0.014);
  const leverArm = new THREE.Mesh(leverArmGeom, baseMaterial);
  leverArm.position.set(0.055, -0.06, 0.046);
  group.add(leverArm);

  return group;
}

/**
 * Builds a round privacy door knob.
 */
export function buildPrivacyKnobGroup(finish: "satin" | "brass" = "satin"): THREE.Group {
  const group = new THREE.Group();
  group.name = "Accessory_PrivacyKnob";
  const { baseMaterial, accentMaterial } = createHardwareMaterials(finish);

  // 1. Rosette backplate (circular ring)
  const rosetteGeom = new THREE.CylinderGeometry(0.032, 0.034, 0.008, 32);
  const rosette = new THREE.Mesh(rosetteGeom, baseMaterial);
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(0, 0, 0.004);
  group.add(rosette);

  // 2. Knob neck stem
  const stemGeom = new THREE.CylinderGeometry(0.014, 0.016, 0.03, 24);
  const stem = new THREE.Mesh(stemGeom, baseMaterial);
  stem.rotation.x = Math.PI / 2;
  stem.position.set(0, 0, 0.02);
  group.add(stem);

  // 3. Spherical doorknob
  const ballGeom = new THREE.SphereGeometry(0.027, 32, 24);
  const ball = new THREE.Mesh(ballGeom, baseMaterial);
  ball.position.set(0, 0, 0.046);
  group.add(ball);

  // 4. Center thumb turn button
  const pinGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.01, 16);
  const pin = new THREE.Mesh(pinGeom, accentMaterial);
  pin.rotation.x = Math.PI / 2;
  pin.position.set(0, 0, 0.07);
  group.add(pin);

  return group;
}

/**
 * Builds an architectural cylindrical pull bar.
 */
export function buildPullBarGroup(finish: "satin" | "black" = "satin"): THREE.Group {
  const group = new THREE.Group();
  group.name = "Accessory_PullBar";
  const { baseMaterial } = createHardwareMaterials(finish);

  const lengthM = 0.4; // 400mm pull bar
  const diameterM = 0.025; // 25mm diameter
  const standoffHeightM = 0.045; // 45mm clearance

  // Main vertical tubular bar
  const barGeom = new THREE.CylinderGeometry(diameterM / 2, diameterM / 2, lengthM, 24);
  const bar = new THREE.Mesh(barGeom, baseMaterial);
  bar.position.set(0, 0, standoffHeightM);
  group.add(bar);

  // Upper standoff bracket
  const upperStandoffGeom = new THREE.CylinderGeometry(0.012, 0.012, standoffHeightM, 16);
  const upperStandoff = new THREE.Mesh(upperStandoffGeom, baseMaterial);
  upperStandoff.rotation.x = Math.PI / 2;
  upperStandoff.position.set(0, lengthM * 0.35, standoffHeightM / 2);
  group.add(upperStandoff);

  // Lower standoff bracket
  const lowerStandoff = upperStandoff.clone();
  lowerStandoff.position.set(0, -lengthM * 0.35, standoffHeightM / 2);
  group.add(lowerStandoff);

  return group;
}

/**
 * Builds a heavy-duty bottom roller assembly.
 */
export function buildTandemRollerGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Accessory_TandemRoller";
  const { baseMaterial, accentMaterial } = createHardwareMaterials("satin");

  // Carriage housing
  const carriageGeom = new THREE.BoxGeometry(0.12, 0.03, 0.02);
  const carriage = new THREE.Mesh(carriageGeom, baseMaterial);
  carriage.position.set(0, 0.015, 0);
  group.add(carriage);

  // Dual roller wheels
  const wheelGeom = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 24);
  const wheel1 = new THREE.Mesh(wheelGeom, accentMaterial);
  wheel1.rotation.z = Math.PI / 2;
  wheel1.position.set(-0.035, 0.005, 0);
  group.add(wheel1);

  const wheel2 = wheel1.clone();
  wheel2.position.set(0.035, 0.005, 0);
  group.add(wheel2);

  return group;
}

/**
 * Resolves a high-fidelity 3D mesh for an accessory by identifier or category.
 */
export function createAccessoryMeshById(accessoryId: string): THREE.Group {
  switch (accessoryId) {
    case "canonical_smart_lock":
      return buildSmartLockGroup("black");
    case "canonical_privacy_knob":
      return buildPrivacyKnobGroup("satin");
    case "canonical_pull_bar":
      return buildPullBarGroup("satin");
    case "canonical_tandem_roller":
    case "canonical_single_roller":
      return buildTandemRollerGroup();
    case "canonical_lever_handle":
    default:
      return buildLeverHandleGroup("satin");
  }
}
