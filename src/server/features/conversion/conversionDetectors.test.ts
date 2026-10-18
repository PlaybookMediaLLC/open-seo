import { expect, it } from "vitest";
import {
  detectConversionProblems,
  type ConversionInput,
  type ConversionPage,
} from "./conversionDetectors";

// RFC-0012 5.3: each rule fires at its threshold and not one step past it.
const page = (
  landingPage: string,
  overrides: Partial<ConversionPage> = {},
): ConversionPage => ({
  hostName: "example.com",
  landingPage,
  sessions: 1000,
  conversions: 40,
  engagedSessions: 600,
  mobile: { sessions: 0, conversions: 0 },
  desktop: { sessions: 0, conversions: 0 },
  forms: null,
  ...overrides,
});
const detect = (
  pages: ConversionPage[],
  input: Partial<ConversionInput> = {},
) =>
  detectConversionProblems({
    pages,
    roles: new Map(),
    eventName: "sign_up",
    valueMinor: null,
    currency: "USD",
    channel: "organic_search",
    formsMeasured: true,
    ...input,
  });
const found = (...args: Parameters<typeof detect>) =>
  detect(...args).map((item) => `${item.type} ${new URL(item.url).pathname}`);

it("flags low conversion at half the role median with a gap of 5", () => {
  const peers = [page("/a"), page("/b")];
  expect(found([...peers, page("/c", { conversions: 20 })])).toEqual([
    "cro_low_conversion /c",
  ]);
  expect(found([...peers, page("/c", { conversions: 21 })])).toEqual([]);
  // 4 below the median at 300 sessions is under the gap of 5.
  const small = (path: string, conversions: number) =>
    page(path, { sessions: 300, engagedSessions: 180, conversions });
  expect(found([small("/a", 8), small("/b", 8), small("/c", 4)])).toEqual([]);
  // A money page is compared with money pages only.
  expect(
    found([...peers, page("/c", { conversions: 20 })], {
      roles: new Map([["https://example.com/c", "money"]]),
    }),
  ).toEqual([]);
});

it("states the extra conversions and their value, and says it is not a forecast", () => {
  const [item] = detect(
    [page("/a"), page("/b"), page("/c", { conversions: 20 })],
    {
      valueMinor: 5000,
    },
  );
  expect(item.explanation).toContain(
    "about 20 more conversions in 28 days (about $1,000.00). This is not a forecast.",
  );
  expect(item.commercialScore).toBe(1);
});

it("flags a form drop-off at 50 starts and a 30% submit rate", () => {
  const form = (starts: number, submits: number) =>
    page("/contact", { forms: { starts, submits } });
  expect(found([form(50, 15)])).toEqual(["cro_form_drop_off /contact"]);
  expect(found([form(49, 14)])).toEqual([]);
  expect(found([form(50, 16)])).toEqual([]);
  expect(found([form(50, 15)], { formsMeasured: false })).toEqual([]);
});

it("flags a mobile gap at 200 mobile sessions and half the desktop rate", () => {
  const devices = (sessions: number, conversions: number) =>
    page("/pricing", {
      mobile: { sessions, conversions },
      desktop: { sessions: 100, conversions: 4 },
    });
  const [item] = detect([devices(200, 4)]);
  expect(item.type).toBe("cro_device_gap");
  expect(item.ga4.map((row) => row.device)).toEqual([
    "all",
    "mobile",
    "desktop",
  ]);
  expect(found([devices(199, 3)])).toEqual([]);
  expect(found([devices(200, 5)])).toEqual([]);
});

it("flags low engagement at 40% while the site median is 55% or more", () => {
  const engaged = (path: string, engagedSessions: number) =>
    page(path, { engagedSessions });
  expect(
    found([engaged("/a", 550), engaged("/b", 550), engaged("/c", 400)]),
  ).toEqual(["cro_low_engagement /c"]);
  expect(
    found([engaged("/a", 550), engaged("/b", 550), engaged("/c", 401)]),
  ).toEqual([]);
  expect(
    found([engaged("/a", 549), engaged("/b", 549), engaged("/c", 400)]),
  ).toEqual([]);
});
