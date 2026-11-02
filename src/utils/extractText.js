import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractLines(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const lines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // group text pieces that sit on the same vertical position into one line
    const rows = {};
    content.items.forEach((item) => {
      const y = Math.round(item.transform[5] / 3) * 3;
      (rows[y] ||= []).push({ x: item.transform[4], str: item.str });
    });

    Object.keys(rows)
      .sort((a, b) => b - a) // top to bottom
      .forEach((y) => {
        const line = rows[y]
          .sort((a, b) => a.x - b.x) // left to right
          .map((i) => i.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (line) lines.push(line);
      });
  }
  return lines;
}