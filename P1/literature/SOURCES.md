# วรรณคดีลำนำ ป.๑

Source: teacher-provided `วรรณคดีลำนำ.pdf`, 88 PDF pages. This reader covers PDF pages 8–84 (77 pages): all eight chapters, their reading extensions, and the final riddle page. Publication front matter and credits are excluded.

| ภาษาพาที | วรรณคดีลำนำ | Workbook evidence | Literature PDF pages |
|---|---|---|---|
| 4 ตามหา | 1 เจ้าเนื้ออ่อน เอย | Vol 1 PDF 82–84, printed 63–65 | 8–17 |
| 5 ไปโรงเรียน | 2 มา เล่น กัน ไหม | Vol 1 PDF 93–95, printed 74–76 | 18–27 |
| 6 โรงเรียนลูกช้าง | 3 ของ เธอ ของ ฉัน | Vol 1 PDF 106–107, printed 87–88 | 28–35 |
| 7 เพื่อนรัก เพื่อนเล่น | 4 ฝน ตก แดด ออก | Vol 2 PDF 5 contents, exercise 7 | 36–45 |
| 8 พูดเพราะ | 5 เรา รัก เมืองไทย | Vol 2 PDF 5 contents, exercise 8 | 46–55 |
| 9 เกือบไป | 6 ตั้งไข่ ล้ม ต้ม ไข่ กิน | Vol 2 PDF 5 contents, exercise 9 | 56–65 |
| 10 เพื่อนรู้ใจ | 7 แมว เหมียว | Vol 2 PDF 5 contents, exercise 10 | 66–73 |
| 11 ช้างน้อยน่ารัก | 8 กระต่าย กับ เต่า | Vol 2 PDF 5 contents, exercise 11 | 74–84 |

No pair is invented for ภาษาพาที 1–3 or 12. The workbooks use the poem names ตั้ง เอ๋ย ตั้งไข่ and แมว เอ๋ย แมว เหมียว for chapters 6 and 7.

## Rendering and audio

`tools/build_literature.py` extracts illustrations without text redaction affecting images/vector artwork, wraps the original embedded CFF subsets in OpenType containers, and retains every native glyph's original position. Display text is live SVG text, not a flat scanned page. The PDF's legacy character encoding is used only with those original glyph fonts; accessible labels, speech and the large-text view use separately decoded Unicode Thai. Font-loading failure automatically opens the Unicode large-text view.

Words separated by actual source whitespace are independent read controls. Adjacent letters within a word stay together. The speech queue highlights exactly its current word and cancels on page/view changes; it does not depend on browser speech boundary events. Header/footer repetition and decorative stars/hearts are not read. Thai voices depend on the device. Source artwork that contains illustrated lettering is preserved.

`text-audit.txt` is the decoded source transcript for review, including source headers/page numbers. `book.json` records PDF page provenance for every displayed page. Original PDF is not redistributed in this folder.

## Verification

Eight chapter source contact sheets reviewed against the decoded transcript. Glyph encoding corrections include ฟัง, แบ่งปัน, เป็น, ปี, ฝึก, เอื้อเฟื้อ and กตัญญู. Original font geometry was compared with reconstructed pages. Automated checks cover every source page/asset/font, all eight pair links, connected-word highlighting and cancellation of obsolete speech queues. The existing ภาษาพาที data and audio files are unchanged.
