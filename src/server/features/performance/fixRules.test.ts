import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isListedScript, priorityProp } from "./fixRules";
import { IMAGE_HEADER_BYTES, imageSize } from "./imageSize";

// RFC-0014 5.5: real files, each made at a known size.
const file = (name: string) =>
  new Uint8Array(
    readFileSync(`src/server/features/performance/fixtures/${name}`),
  ).subarray(0, IMAGE_HEADER_BYTES);

/** A JPEG metadata segment of `length` bytes. */
const segment = (length: number) => [
  0xff,
  0xe1,
  length >> 8,
  length & 0xff,
  ...Array.from({ length: length - 2 }, () => 0),
];

describe("imageSize", () => {
  it.each([
    ["hero.png", 37, 23],
    ["hero.jpg", 37, 23],
    ["hero.webp", 37, 23],
    ["hero.avif", 64, 48],
  ])("reads %s", (name, width, height) => {
    expect(imageSize(file(name))).toEqual({ width, height });
  });

  it("gives null when the size lies past the first 64 KB", () => {
    // A JPEG whose two metadata segments push the frame header past 64 KB.
    const bytes = new Uint8Array([
      0xff,
      0xd8,
      ...segment(40_000),
      ...segment(40_000),
      0xff,
      0xc0,
      0,
      17,
      8,
      0,
      23,
      0,
      37,
    ]);
    expect(imageSize(bytes)).toEqual({ width: 37, height: 23 });
    expect(imageSize(bytes.subarray(0, IMAGE_HEADER_BYTES))).toBeNull();
  });

  it("gives null for a file that is not an image", () => {
    expect(imageSize(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});

describe("priorityProp", () => {
  it.each([
    ["^13.5.0", "priority"],
    ["14.2.3", "priority"],
    ["~15.4.0", "priority"],
    ["^16.0.1", "preload"],
    ["12.3.4", null],
    ["latest", null],
    [undefined, null],
  ])("uses the prop of Next.js %s", (version, prop) => {
    expect(priorityProp(version)).toBe(prop);
  });
});

it("changes the strategy only for scripts on the reviewed list", () => {
  expect(
    isListedScript("https://www.googletagmanager.com/gtag/js?id=G-1"),
  ).toBe(true);
  expect(isListedScript("https://cdn.example.com/app.js")).toBe(false);
  expect(isListedScript("/scripts/local.js")).toBe(false);
});
