#!/usr/bin/env python3
"""Fallback PDF extractor for environments without poppler.
Usage: pdf_extract.py <file.pdf> <out-txt> <img-prefix>
Writes layout-ish text to <out-txt>, renders page PNGs for image extraction,
prints JSON summary {"pages": N, "lines": M, "images": K}.
Requires: pymupdf.
"""
import sys
import json

def main():
    src, out_txt, img_pre = sys.argv[1], sys.argv[2], sys.argv[3]
    import fitz
    doc = fitz.open(src)
    chunks = []
    nimg = 0
    for i, page in enumerate(doc, 1):
        text = page.get_text("text") or ""
        chunks.append("--- PAGE %d ---\n%s" % (i, text.strip()))
        try:
            for xref, *_ in page.get_images(full=True):
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n - pix.alpha > 3:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    if pix.width < 80 or pix.height < 80:
                        continue
                    nimg += 1
                    pix.save("%s-img%d.png" % (img_pre, nimg))
                except Exception:
                    continue
        except Exception:
            pass
    with open(out_txt, "w", encoding="utf-8") as f:
        f.write("\n\n".join(chunks) + "\n")
    print(json.dumps({"pages": len(doc),
                      "lines": sum(c.count("\n") for c in chunks) + len(chunks),
                      "images": nimg}))

main()
