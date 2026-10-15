/**
 * Serves the landing page's walkthrough video and its poster with the right
 * Content-Type and byte-range support.
 *
 * The files live in src/public/product/, but the deployed static assets come
 * back as application/octet-stream and ignore Range headers. Safari will not
 * play a video without 206 range responses, so the hero loads them from
 * /media/<name>, which re-serves the allow-listed files from /product/.
 */
const MEDIA: Record<string, string> = {
  "app-demo.mp4": "video/mp4",
  "app-demo.webm": "video/webm",
  "app-demo.webp": "image/webp",
};

export async function serveLandingMedia(name: string, request: Request) {
  const type = MEDIA[name];
  if (!type) return new Response("Not found", { status: 404 });

  // Same origin and an allow-listed path, so this cannot reach anything else.
  const source = await fetch(new URL(`/product/${name}`, request.url));
  if (!source.ok) return new Response("Not found", { status: 404 });
  const bytes = await source.arrayBuffer();
  const size = bytes.byteLength;

  const headers = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };
  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${size}` },
    });
  }
  if (!range) return new Response(bytes, { headers });

  const [start, end] = range;
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}` },
  });
}

/** One `bytes=` range. Anything else, such as multi-range, gets the whole file. */
function parseRange(
  header: string | null,
  size: number,
): [number, number] | "unsatisfiable" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match) return null;
  const [, from = "", to = ""] = match;
  if (!from && !to) return "unsatisfiable";
  // `bytes=-500` asks for the last 500 bytes.
  const start = from ? Number(from) : Math.max(0, size - Number(to));
  const end = from && to ? Math.min(Number(to), size - 1) : size - 1;
  return start > end || start >= size ? "unsatisfiable" : [start, end];
}
