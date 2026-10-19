/** A Stripe amount in minor units, with the currency's own decimals (JPY has none). */
export function formatMinor(minor: number, currency: string, locale?: string) {
  const format = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  return format.format(
    minor / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2),
  );
}
