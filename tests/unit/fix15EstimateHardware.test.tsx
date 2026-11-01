/** fix-15 / QAD-TC91.7: estimate hardware disclosure matches the selected preview. */
import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PriceCard, type ProductDetailsData } from "../../src/features/quotation/components/PriceCard";

const details: ProductDetailsData = {
  category: "Window & Door",
  variant: "2-Panel Standard",
  material: "Aluminum",
  aluminumFinish: "White Aluminum",
  glassFinish: "None",
  glassType: "None",
  thickness: "3mm",
  profileGrade: "Series 798",
  dimension: "W 121cm X H 240cm",
  baseUnitPrice: 9036,
  accessoryPriceDelta: 300,
  swappedAccessories: [{
    slotComponentId: "door-handle",
    accessoryId: "registered-pull-bar",
    accessoryName: "Pull Bar",
    category: "handle",
    price: 300,
    priceDelta: 300,
    finish: "Matte Black",
    horizontalPosition: "left",
    verticalPosition: "up",
  }],
};

test("estimate identifies paid hardware, handing, finish, and price split", () => {
  const markup = renderToStaticMarkup(<PriceCard productName="Screen Door" unitPrice={9336} details={details} initiallyExpanded />);
  assert.match(markup, /Pull Bar/);
  assert.match(markup, /Left Side/);
  assert.match(markup, /Matte Black/);
  assert.match(markup, /Hardware:.*300/);
  assert.match(markup, /Base:.*9,036/);
});

test("default hardware has no upgrade disclosure", () => {
  const markup = renderToStaticMarkup(<PriceCard productName="Screen Door" unitPrice={9036} details={{
    ...details,
    accessoryPriceDelta: 0,
    swappedAccessories: [{ ...details.swappedAccessories![0], accessoryId: "default", accessoryName: "Standard Hardware", price: 0, priceDelta: 0 }],
  }} initiallyExpanded />);
  assert.doesNotMatch(markup, /Hardware:.*300/);
  assert.doesNotMatch(markup, /Standard Hardware/);
});
