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
let htmlLockCount = 0;
let savedPosition = { x: 0, y: 0 };
let savedHtml: Pick<LockedStyle, "overflow" | "overscrollBehavior"> | null = null;
let savedBody: LockedStyle | null = null;

export function acquireHtmlLock() {
  htmlLockCount += 1;
  if (htmlLockCount !== 1) return;
  const html = document.documentElement;
  savedHtml = {
    overflow: html.style.overflow,
    overscrollBehavior: html.style.overscrollBehavior,
  };
  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
}

export function releaseHtmlLock() {
  if (htmlLockCount === 0) return;
  htmlLockCount -= 1;
  if (htmlLockCount !== 0 || !savedHtml) return;
  const html = document.documentElement;
  Object.assign(html.style, savedHtml);
  savedHtml = null;
}

export function acquireDocumentLock() {
  ownerCount += 1;
  if (ownerCount !== 1) return;
  acquireHtmlLock();
  const html = document.documentElement;
  const body = document.body;
  savedPosition = { x: window.scrollX, y: window.scrollY };
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
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  body.style.position = "fixed";
  body.style.top = `-${savedPosition.y}px`;
  body.style.left = `-${savedPosition.x}px`;
  body.style.right = "0";
  body.style.width = "100%";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
}

export function releaseDocumentLock() {
  if (ownerCount === 0) return;
  ownerCount -= 1;
  if (ownerCount !== 0 || !savedBody) return;
  const body = document.body;
  Object.assign(body.style, savedBody);
  const { x, y } = savedPosition;
  savedBody = null;
  releaseHtmlLock();
  window.scrollTo(x, y);
}

export function useHtmlScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquireHtmlLock();
    return releaseHtmlLock;
  }, [active]);
}

export function useDocumentScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquireDocumentLock();
    return releaseDocumentLock;
  }, [active]);
}
