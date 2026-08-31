import { describe, it, expect } from "vitest";
import {
  markdownToHtml,
  plainTextToHtml,
  importFileToHtml,
  convertUploadToHtml,
  isDocx,
  titleFromFileName,
  SUPPORTED_IMPORT_EXTENSIONS,
} from "./import";

describe("markdownToHtml", () => {
  it("converts headings, emphasis and paragraphs", () => {
    const html = markdownToHtml("# Hello\n\nSome **bold** and *italic* text");
    expect(html).toBe(
      "<h1>Hello</h1><p>Some <strong>bold</strong> and <em>italic</em> text</p>",
    );
  });

  it("converts unordered and ordered lists", () => {
    expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(markdownToHtml("1. first\n2. second")).toBe(
      "<ol><li>first</li><li>second</li></ol>",
    );
  });

  it("converts block quotes and h2/h3", () => {
    expect(markdownToHtml("## Sub\n### Deep\n> quoted")).toBe(
      "<h2>Sub</h2><h3>Deep</h3><blockquote>quoted</blockquote>",
    );
  });

  it("escapes HTML in the source so imports cannot inject markup", () => {
    const html = markdownToHtml("<script>alert(1)</script>\n\nplain");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never returns an empty string", () => {
    expect(markdownToHtml("")).toBe("<p></p>");
  });
});

describe("plainTextToHtml", () => {
  it("splits blank-line separated blocks into paragraphs", () => {
    expect(plainTextToHtml("first para\n\nsecond para")).toBe(
      "<p>first para</p><p>second para</p>",
    );
  });

  it("keeps single newlines as line breaks", () => {
    expect(plainTextToHtml("line one\nline two")).toBe(
      "<p>line one<br />line two</p>",
    );
  });

  it("escapes angle brackets", () => {
    expect(plainTextToHtml("a <b> c")).toBe("<p>a &lt;b&gt; c</p>");
  });
});

describe("importFileToHtml", () => {
  it("uses markdown conversion for .md files", () => {
    expect(importFileToHtml("notes.md", "# Title")).toBe("<h1>Title</h1>");
  });

  it("uses plain-text conversion for .txt files", () => {
    expect(importFileToHtml("notes.txt", "# Not a heading")).toBe(
      "<p># Not a heading</p>",
    );
  });
});

describe("titleFromFileName", () => {
  it("derives a readable title", () => {
    expect(titleFromFileName("my-project_notes.md")).toBe("my project notes");
    expect(titleFromFileName("draft.txt")).toBe("draft");
    expect(titleFromFileName("Quarterly Report.docx")).toBe("Quarterly Report");
  });
});

describe("upload routing", () => {
  it("advertises the supported extensions including .docx", () => {
    expect(SUPPORTED_IMPORT_EXTENSIONS).toContain(".txt");
    expect(SUPPORTED_IMPORT_EXTENSIONS).toContain(".md");
    expect(SUPPORTED_IMPORT_EXTENSIONS).toContain(".docx");
  });

  it("recognizes .docx by name, case-insensitively", () => {
    expect(isDocx("report.docx")).toBe(true);
    expect(isDocx("REPORT.DOCX")).toBe(true);
    expect(isDocx("notes.md")).toBe(false);
    expect(isDocx("archive.docx.txt")).toBe(false);
  });

  it("routes a text File through the markdown/plain-text converter", async () => {
    const md = new File(["# Title\n\n- a\n- b"], "notes.md", { type: "text/markdown" });
    expect(await convertUploadToHtml(md)).toBe("<h1>Title</h1><ul><li>a</li><li>b</li></ul>");

    const txt = new File(["hello world"], "notes.txt", { type: "text/plain" });
    expect(await convertUploadToHtml(txt)).toBe("<p>hello world</p>");
  });
});
