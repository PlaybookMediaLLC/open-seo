// RFC-0017 5.4 step 3: personal data leaves ticket text before any other
// step. ponytail: patterns, not a named-entity model; names are removed only
// when they match the ticket's requester fields.
const SECRET_URL =
  /https?:\/\/\S*?[?&#](?:access_token|token|key|secret|sig|signature|code|password|auth)=\S*/gi;
const EMAIL =
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
// A run of digits, spaces and phone punctuation with 9 or more digits, so
// dates and version numbers stay.
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function redact(text: string, names: string[]) {
  let out = text
    .replace(SECRET_URL, "[url]")
    .replace(EMAIL, "[email]")
    .replace(PHONE, (match) =>
      (match.match(/\d/g)?.length ?? 0) >= 9 ? "[phone]" : match,
    );
  for (const name of names)
    if (name.trim().length >= 2)
      out = out.replace(
        new RegExp(
          `(?<![\\p{L}\\p{N}_-])@?${escape(name.trim())}(?![\\p{L}\\p{N}_-])`,
          "giu",
        ),
        "[name]",
      );
  return out;
}
