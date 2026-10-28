import { z } from "zod";

// RFC-0007 6.7: the logo and color an organization's shared reports show.
// Pure and shared: the settings form checks a file before upload, and the
// server checks it again on save and on every read.

/** 48 KB of image: small enough to inline in the share page. */
const REPORT_LOGO_MAX_BYTES = 48 * 1024;

export const brandColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a color like #1c4ed8.")
  .transform((value) => value.toLowerCase());

const LOGO_PREFIX = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

// The bytes must be the format the URL names; an SVG or HTML payload cannot
// pass as a PNG.
const SIGNATURES = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
} as const;

function isLogoDataUrl(value: string): boolean {
  const match = LOGO_PREFIX.exec(value);
  const kind = match?.[1];
  const payload = match?.[2];
  if ((kind !== "png" && kind !== "jpeg") || !payload) return false;
  let bytes: string;
  try {
    bytes = atob(payload);
  } catch {
    return false;
  }
  return (
    bytes.length <= REPORT_LOGO_MAX_BYTES &&
    SIGNATURES[kind].every((byte, index) => bytes.charCodeAt(index) === byte)
  );
}

export const logoDataUrlSchema = z
  .string()
  .max(Math.ceil(REPORT_LOGO_MAX_BYTES / 3) * 4 + 32)
  .refine(isLogoDataUrl, "Use a PNG or JPEG of at most 48 KB.");

export const saveReportBrandingInputSchema = z
  .object({
    brandColor: brandColorSchema.nullable(),
    logoDataUrl: logoDataUrlSchema.nullable(),
  })
  .refine(
    (value) => value.brandColor !== null || value.logoDataUrl !== null,
    "Add a color or a logo, or remove the branding.",
  );
export type SaveReportBrandingInput = z.infer<
  typeof saveReportBrandingInputSchema
>;

/** Black or white, whichever reads better on the brand color (WCAG luminance). */
export function textColorOn(brandColor: string): "#000000" | "#ffffff" {
  const channel = (offset: number) => {
    const value =
      Number.parseInt(brandColor.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
