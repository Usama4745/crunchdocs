declare module "html-to-docx" {
  interface DocxOptions {
    title?: string;
    margins?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    footer?: boolean;
    pageNumber?: boolean;
    [key: string]: unknown;
  }

  /** Convert an HTML string to a .docx file (Buffer in Node, Blob in browser). */
  function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: DocxOptions,
    footerHTMLString?: string | null,
  ): Promise<Buffer | ArrayBuffer | Blob>;

  export default HTMLtoDOCX;
}
