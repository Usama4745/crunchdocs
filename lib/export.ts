import type { IParagraphOptions } from "docx";
import { sanitizeHtml } from "./sanitize";

/**
 * Turn a document title into a safe download filename stem (no extension).
 * Pure — unit tested.
 */
export function exportFilename(title: string): string {
  const stem = (title || "document")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return stem || "document";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Full standalone HTML for an export: the document title as an <h1> followed by
 * the sanitized body. Shared by the .docx route and the print/PDF view.
 */
export function buildExportHtml(title: string, contentHtml: string): string {
  const body = sanitizeHtml(contentHtml) || "<p></p>";
  return `<h1>${escapeHtml(title || "Untitled document")}</h1>${body}`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

interface InlineFmt {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
}

/**
 * Render the document to a .docx buffer.
 *
 * Because the stored HTML is a small, attribute-free allow-list (see
 * `lib/sanitize.ts`), we walk it with `node-html-parser` and emit OOXML with
 * the `docx` library rather than trusting a generic HTML->DOCX converter. That
 * guarantees well-formed output Word will always open.
 */
export async function htmlToDocxBuffer(
  title: string,
  contentHtml: string,
): Promise<Buffer> {
  const [
    { Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType },
    { parse, NodeType },
  ] = await Promise.all([import("docx"), import("node-html-parser")]);

  type AnyNode = {
    nodeType: number;
    rawText: string;
    tagName?: string;
    childNodes: AnyNode[];
  };

  const inlineRuns = (node: AnyNode, fmt: InlineFmt): InstanceType<typeof TextRun>[] => {
    const runs: InstanceType<typeof TextRun>[] = [];
    for (const child of node.childNodes) {
      if (child.nodeType === NodeType.TEXT_NODE) {
        const text = decodeEntities(child.rawText);
        if (text) {
          runs.push(
            new TextRun({
              text,
              bold: fmt.bold,
              italics: fmt.italics,
              underline: fmt.underline ? {} : undefined,
              strike: fmt.strike,
            }),
          );
        }
        continue;
      }
      if (child.nodeType !== NodeType.ELEMENT_NODE || !child.tagName) continue;

      const tag = child.tagName.toUpperCase();
      if (tag === "BR") {
        runs.push(new TextRun({ break: 1 }));
        continue;
      }
      const next: InlineFmt = { ...fmt };
      if (tag === "STRONG" || tag === "B") next.bold = true;
      else if (tag === "EM" || tag === "I") next.italics = true;
      else if (tag === "U") next.underline = true;
      else if (tag === "S" || tag === "STRIKE") next.strike = true;
      runs.push(...inlineRuns(child, next));
    }
    return runs;
  };

  const paragraphs: InstanceType<typeof Paragraph>[] = [];
  const pushBlock = (el: AnyNode, opts: Partial<IParagraphOptions>) => {
    const runs = inlineRuns(el, {});
    paragraphs.push(
      new Paragraph({ children: runs.length ? runs : [new TextRun("")], ...opts }),
    );
  };

  const root = parse(buildExportHtml(title, contentHtml)) as unknown as AnyNode;

  for (const el of root.childNodes) {
    if (el.nodeType === NodeType.TEXT_NODE) {
      const text = decodeEntities(el.rawText).trim();
      if (text) paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
      continue;
    }
    if (el.nodeType !== NodeType.ELEMENT_NODE || !el.tagName) continue;

    switch (el.tagName.toUpperCase()) {
      case "H1":
        pushBlock(el, { heading: HeadingLevel.HEADING_1 });
        break;
      case "H2":
        pushBlock(el, { heading: HeadingLevel.HEADING_2 });
        break;
      case "H3":
        pushBlock(el, { heading: HeadingLevel.HEADING_3 });
        break;
      case "BLOCKQUOTE":
        pushBlock(el, { indent: { left: 720 } });
        break;
      case "UL":
      case "OL": {
        const ordered = el.tagName.toUpperCase() === "OL";
        for (const li of el.childNodes) {
          if (
            li.nodeType !== NodeType.ELEMENT_NODE ||
            li.tagName?.toUpperCase() !== "LI"
          ) {
            continue;
          }
          const runs = inlineRuns(li, {});
          paragraphs.push(
            new Paragraph({
              children: runs.length ? runs : [new TextRun("")],
              ...(ordered
                ? { numbering: { reference: "ol-list", level: 0 } }
                : { bullet: { level: 0 } }),
            }),
          );
        }
        break;
      }
      default:
        pushBlock(el, {});
    }
  }

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun("")] }));
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "ol-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children: paragraphs }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
