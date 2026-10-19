// RFC-0016 5.7: first-touch revenue scores by landing path. A leaf module, so
// opportunity scoring imports it without the database.
export type RevenueScores = Map<
  string,
  { score: number; revenueMinor: number; p90Minor: number; currency: string }
>;

/** "/pricing/" and "https://site/pricing" both become "/pricing". */
export const revenuePathKey = (value: string) =>
  (URL.parse(value, "https://relay.invalid")?.pathname ?? value).replace(
    /\/+$/,
    "",
  ) || "/";
