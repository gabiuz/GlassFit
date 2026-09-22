import { captureTransparentCanvasBlob } from "./captureSnapshot";
import { normalizeAluminumFinish, type AluminumFinishKey } from "./colorVariations";
import {
  deriveGlassTypeFromAppearance,
  normalizeGlassColor,
  normalizeGlassThickness,
} from "./configurationPropagation";
import { ProductModelRenderer } from "./modelRenderer";
import { denormalizeCorners, drawPerspectiveWarpedImage } from "./perspectiveTransform";
import type { VariationRenderRecipe } from "./types";

export class VariationLayerRenderer {
  private readonly renderer: ProductModelRenderer;
  private loaded = false;

  constructor(private readonly recipe: VariationRenderRecipe) {
    const pixelRatio = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
    this.renderer = new ProductModelRenderer(
      Math.max(1, Math.round(recipe.sourceOverlayWidth * pixelRatio)),
      Math.max(1, Math.round(recipe.sourceOverlayHeight * pixelRatio)),
    );
  }

  async render(finish: AluminumFinishKey) {
    const configuration = this.recipe.configuration;
    const presentation = {
      aluminumFinish: normalizeAluminumFinish(finish),
      glassAppearance: configuration.glassAppearance,
      glassColor: normalizeGlassColor(configuration.glassColor),
      glassThicknessMm: normalizeGlassThickness(configuration.glassThicknessMm),
      includeSill: configuration.includeSill,
    };
    if (!this.loaded) {
      await this.renderer.loadModel(
        this.recipe.structuralDefinition,
        {
          ...configuration.visualParameterValues,
          width: configuration.widthCm * 10,
          height: configuration.heightCm * 10,
          pane_count: configuration.panelCount,
          includeSill: configuration.includeSill,
          include_sill: configuration.includeSill,
          glass_type: configuration.glassType
            ?? deriveGlassTypeFromAppearance(configuration.glassAppearance),
        },
        presentation,
      );
      this.loaded = true;
    } else {
      this.renderer.updatePresentation(presentation);
    }
    const rendered = this.renderer.render(
      configuration.yaw,
      configuration.pitch,
      Boolean(configuration.perspectiveFitCorners),
    );
    if (!rendered) throw new Error("The requested finish could not be rendered.");

    const pixelRatio = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(this.recipe.sourceCanvasWidth * pixelRatio));
    output.height = Math.max(1, Math.round(this.recipe.sourceCanvasHeight * pixelRatio));
    const context = output.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
    context.scale(pixelRatio, pixelRatio);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (configuration.perspectiveFitCorners) {
      const corners = denormalizeCorners(
        configuration.perspectiveFitCorners,
        this.recipe.sourceCanvasWidth,
        this.recipe.sourceCanvasHeight,
      );
      const source = document.createElement("canvas");
      source.width = rendered.width;
      source.height = rendered.height;
      const sourceContext = source.getContext("2d");
      if (!sourceContext) throw new Error("Canvas rendering is unavailable in this browser.");
      if (configuration.isFlipped) {
        sourceContext.translate(source.width, 0);
        sourceContext.scale(-1, 1);
      }
      sourceContext.drawImage(rendered, 0, 0);
      drawPerspectiveWarpedImage(context, source, corners);
    } else {
      const centerX = this.recipe.sourceCanvasWidth / 2 + (configuration.positionX ?? 0);
      const centerY = this.recipe.sourceCanvasHeight / 2 + (configuration.positionY ?? 0);
      context.save();
      context.translate(centerX, centerY);
      context.rotate((configuration.rotateAngle * Math.PI) / 180);
      if (configuration.isFlipped) context.scale(-1, 1);
      context.drawImage(
        rendered,
        -this.recipe.sourceOverlayWidth / 2,
        -this.recipe.sourceOverlayHeight / 2,
        this.recipe.sourceOverlayWidth,
        this.recipe.sourceOverlayHeight,
      );
      context.restore();
    }
    return captureTransparentCanvasBlob(output);
  }

  dispose() {
    this.renderer.dispose();
  }
}
