import { describe, it, expect } from "vitest";
import { exportFilename, buildExportHtml, htmlToDocxBuffer } from "./export";

describe("exportFilename", () => {
  it("slugifies a title into a safe filename stem", () => {
    expect(exportFilename("My Project Notes")).toBe("My-Project-Notes");
    expect(exportFilename("Q3 / Report: draft!")).toBe("Q3-Report-draft");
    expect(exportFilename("  spaced  out  ")).toBe("spaced-out");
  });

  it("falls back to 'document' for empty/unusable titles", () => {
    expect(exportFilename("")).toBe("document");
    expect(exportFilename("***")).toBe("document");
  });

  it("caps length", () => {
    expect(exportFilename("a".repeat(300)).length).toBeLessThanOrEqual(100);
  });
});

describe("buildExportHtml", () => {
  it("prefixes the sanitized body with the title as an <h1>", () => {
    expect(buildExportHtml("Hello", "<p>world</p>")).toBe(
      "<h1>Hello</h1><p>world</p>",
    );
  });

  it("escapes the title and sanitizes the body", () => {
    const out = buildExportHtml("<script>", '<p onclick="x">hi</p><script>bad()</script>');
    expect(out).toBe("<h1>&lt;script&gt;</h1><p>hi</p>");
  });

  it("uses a fallback title and empty paragraph when inputs are blank", () => {
    expect(buildExportHtml("", "")).toBe("<h1>Untitled document</h1><p></p>");
  });
});

describe("htmlToDocxBuffer", () => {
  it("produces a valid .docx (zip) buffer for the full formatting set", async () => {
    const html =
      "<h1>Title</h1><h2>Sub</h2>" +
      "<p>plain <strong>bold <em>both</em></strong> <u>under</u> <s>strike</s></p>" +
      "<p></p>" + // empty paragraph must not break generation
      "<blockquote>quoted &amp; escaped &lt;tag&gt;</blockquote>" +
      "<ul><li>one</li><li>two</li></ul>" +
      "<ol><li>first</li><li>second</li></ol>" +
      "<p>line one<br />line two</p>";
    const buf = await htmlToDocxBuffer("My Report", html);
    expect(buf.length).toBeGreaterThan(1000);
    // .docx is a zip archive -> starts with the "PK" local file header.
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    // ...and ends with the zip End-Of-Central-Directory signature (PK\x05\x06).
    const tail = buf.subarray(-22);
    expect(tail.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  }, 20_000);

  it("handles an empty document without throwing", async () => {
    const buf = await htmlToDocxBuffer("", "");
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  }, 20_000);
});
