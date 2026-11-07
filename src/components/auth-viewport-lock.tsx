"use client";

import { useLayoutEffect } from "react";

/** Keeps sign-in / sign-up pages locked to one viewport with no document scrollbar. */
export function AuthViewportLock() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlGutter: html.style.scrollbarGutter,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.scrollbarGutter = "auto";

    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      html.style.scrollbarGutter = previous.htmlGutter;
    };
  }, []);

  return null;
}
