# Testing Checklist

Use copies of completed forms that contain made-up test information. Never commit real completed forms.

## Before each test

1. Run the site through `http://localhost`, not by double-clicking `index.html`.
2. Open `index.html?debug=true` for coordinate and crop inspection.
3. Photograph the entire page from directly above with all four corners visible.
4. Compare every verification value with the paper form before submission.

## Required cases

- [ ] One student filled; five empty rows are ignored.
- [ ] Multiple students filled.
- [ ] All six students filled.
- [ ] Empty student rows produce no Google Sheet rows.
- [ ] Male and Female circles.
- [ ] Every religion circle.
- [ ] First-time Yes and No circles.
- [ ] Each Page 2 parent-response circle separately and in combinations.
- [ ] Signature present, absent, and unclear.
- [ ] Valid phone number keeps its leading zero.
- [ ] Valid and invalid email warning.
- [ ] Dates using `/` and `-`.
- [ ] Correct and incorrect fee calculations.
- [ ] Slight page rotation and mild perspective distortion.
- [ ] Wrong Page 1/Page 2 order.
- [ ] Invalid or unreadable image.
- [ ] Missing Page 1 or Page 2.
- [ ] Apps Script URL missing, wrong, and correct.

## Acceptance rule

OCR does not need to be perfect. The scan passes when crops match their intended writing areas, circles are usually classified correctly, uncertain results say **Needs Review**, every value can be corrected, and no data reaches Google Sheets before **Confirm & Submit**.
