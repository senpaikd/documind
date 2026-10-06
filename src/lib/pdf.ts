import type { PDFDocumentProxy } from "pdfjs-dist";

let workerConfigured = false;

export async function extractPdfPages(file: File) {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  let document: PDFDocumentProxy | undefined;
  try {
    document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: Array<{ page: number; text: string }> = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push({ page: pageNumber, text });
    }
    return pages;
  } finally {
    document?.cleanup();
  }
}
