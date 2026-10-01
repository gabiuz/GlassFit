"use client";

import { useEffect } from "react";

type LockedStyle = {
  overflow: string;
  overscrollBehavior: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
};

let ownerCount = 0;
let savedPosition = { x: 0, y: 0 };
let savedHtml: Pick<LockedStyle, "overflow" | "overscrollBehavior"> | null = null;
let savedBody: LockedStyle | null = null;

function acquireDocumentLock() {
  ownerCount += 1;
  if (ownerCount !== 1) return;
  const html = document.documentElement;
  const body = document.body;
  savedPosition = { x: window.scrollX, y: window.scrollY };
  savedHtml = {
    overflow: html.style.overflow,
    overscrollBehavior: html.style.overscrollBehavior,
  };
  savedBody = {
    overflow: body.style.overflow,
    overscrollBehavior: body.style.overscrollBehavior,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
  };
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  body.style.position = "fixed";
  body.style.top = `-${savedPosition.y}px`;
  body.style.left = `-${savedPosition.x}px`;
  body.style.right = "0";
  body.style.width = "100%";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
}

function releaseDocumentLock() {
  if (ownerCount === 0) return;
  ownerCount -= 1;
  if (ownerCount !== 0 || !savedHtml || !savedBody) return;
  const html = document.documentElement;
  const body = document.body;
  Object.assign(html.style, savedHtml);
  Object.assign(body.style, savedBody);
  const { x, y } = savedPosition;
  savedHtml = null;
  savedBody = null;
  window.scrollTo(x, y);
}

export function useDocumentScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquireDocumentLock();
    return releaseDocumentLock;
  }, [active]);
}
