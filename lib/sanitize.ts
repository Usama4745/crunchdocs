/**
 * A small allow-list HTML sanitizer for the rich-text editor.
 *
 * The editor only ever produces structural formatting tags with **no
 * attributes** (bold, italic, underline, strike, headings, lists, block
 * quotes, paragraphs). That makes sanitizing simple and safe: keep a fixed
 * set of tags, drop every attribute, and remove `<script>` / `<style>` /
 * comments entirely. Anything unexpected fails closed — the tag is removed
 * but its text content is kept.
 *
 * This runs on the server for every save (defense in depth) and on the
 * client whenever untrusted HTML is loaded into or pasted into the editor.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "ul",
  "ol",
  "li",
  "blockquote",
  "div",
  "span",
]);

const VOID_TAGS = new Set(["br"]);

/** Tag name -> canonical tag name, so stored markup stays consistent. */
const TAG_ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
  strike: "s",
  div: "p",
};

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";

  let html = String(input);

  // Drop comments and any <script>/<style> blocks including their content.
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<script\b[\s\S]*?(<\/script\s*>|$)/gi, "");
  html = html.replace(/<style\b[\s\S]*?(<\/style\s*>|$)/gi, "");

  // Rewrite every tag, keeping only allow-listed ones and stripping attributes.
  html = html.replace(/<\/?[a-zA-Z][^>]*?>/g, (tag) => {
    const closing = /^<\s*\//.test(tag);
    const nameMatch = tag.match(/^<\s*\/?\s*([a-zA-Z0-9]+)/);
    if (!nameMatch) return "";

    let name = nameMatch[1].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    name = TAG_ALIASES[name] ?? name;

    if (closing) {
      return VOID_TAGS.has(name) ? "" : `</${name}>`;
    }
    return VOID_TAGS.has(name) ? `<${name} />` : `<${name}>`;
  });

  // Any leftover stray angle brackets that never formed a tag: neutralize `<`.
  html = html.replace(/<(?![a-zA-Z/])/g, "&lt;");

  return html.trim();
}

/** True when the sanitized markup carries no visible text or structure. */
export function isBlankHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  const stripped = sanitizeHtml(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, "")
    .trim();
  return stripped.length === 0;
}
