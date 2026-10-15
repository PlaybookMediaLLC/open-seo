import interFont from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";

/** Preloads the landing pages' font, so the headline paints once instead of
 *  shifting when the font swaps in. Same file landing.css uses. */
export const landingFontPreload = {
  rel: "preload",
  href: interFont,
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous",
};
