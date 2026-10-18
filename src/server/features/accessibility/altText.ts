import { Parser } from "htmlparser2";

// RFC-0013 5.4: the image behind an alt text fix, and what alt text never
// contains, from a person or a model.

/** The src of the first image in a stored snippet. */
export function snippetSrc(snippet: string) {
  let src: string | null = null;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (!src && name === "img" && attributes.src) src = attributes.src;
    },
  });
  parser.write(snippet);
  parser.end();
  return src as string | null;
}

/** The reasons a text is not acceptable alt text. */
export function altTextProblems(text: string) {
  const problems: string[] = [];
  if (/^(image|picture|photo|graphic|icon) of\b/i.test(text))
    problems.push(
      'Leave out "image of": a screen reader already says that it is an image.',
    );
  if ((text.match(/,/g) ?? []).length >= 3)
    problems.push("Write a short description, not a list of keywords.");
  return problems;
}
