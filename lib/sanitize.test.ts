import { describe, it, expect } from "vitest";
import { sanitizeHtml, isBlankHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("keeps allow-listed formatting tags", () => {
    const input =
      "<h1>Title</h1><p>Hello <strong>bold</strong> <em>italic</em> <u>under</u></p><ul><li>one</li><li>two</li></ul>";
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("normalizes tag aliases to canonical tags", () => {
    expect(sanitizeHtml("<b>x</b>")).toBe("<strong>x</strong>");
    expect(sanitizeHtml("<i>x</i>")).toBe("<em>x</em>");
    expect(sanitizeHtml("<div>x</div>")).toBe("<p>x</p>");
  });

  it("removes <script> tags and their contents", () => {
    const out = sanitizeHtml('<p>ok</p><script>alert("xss")</script>');
    expect(out).toBe("<p>ok</p>");
    expect(out).not.toContain("alert");
  });

  it("removes inline event handler attributes", () => {
    const out = sanitizeHtml('<p onclick="steal()">hi</p>');
    expect(out).toBe("<p>hi</p>");
    expect(out).not.toContain("onclick");
  });

  it("drops disallowed tags but keeps their text", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).toBe("click");
    expect(out).not.toContain("href");
    expect(out).not.toContain("javascript");
  });

  it("strips <img> and other non-text vectors", () => {
    expect(sanitizeHtml('<img src=x onerror="alert(1)">')).toBe("");
    expect(sanitizeHtml("<iframe src='evil'></iframe>text")).toBe("text");
  });

  it("removes style blocks", () => {
    expect(sanitizeHtml("<style>body{display:none}</style><p>x</p>")).toBe("<p>x</p>");
  });

  it("neutralizes stray angle brackets", () => {
    expect(sanitizeHtml("a < b and c > d")).toBe("a &lt; b and c > d");
  });

  it("handles empty / nullish input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
  });

  it("strips attributes from otherwise-allowed tags", () => {
    expect(sanitizeHtml('<p class="x" style="color:red">t</p>')).toBe("<p>t</p>");
    expect(sanitizeHtml('<span data-x="1">t</span>')).toBe("<span>t</span>");
  });
});

describe("isBlankHtml", () => {
  it("treats empty structure as blank", () => {
    expect(isBlankHtml("<p></p>")).toBe(true);
    expect(isBlankHtml("<p><br /></p>")).toBe(true);
    expect(isBlankHtml("&nbsp; ")).toBe(true);
    expect(isBlankHtml("")).toBe(true);
  });

  it("detects real content", () => {
    expect(isBlankHtml("<p>hi</p>")).toBe(false);
  });
});
