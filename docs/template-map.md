# Fixed Template Coordinate Map

Coordinates use the format **x, y, width, height** in pixels. The origin `(0, 0)` is the top-left corner of the normalized page.

## Normalization

| Page | Supplied image | Detected page boundary | Normalized target |
| --- | --- | --- | --- |
| Page 1 | 1440 × 2048 | `0, 0, 1440, 2048` | 1440 × 2048 |
| Page 2 | 1437 × 2048 | `0, 0, 1437, 2048` | 1440 × 2048 |

The supplied blank images already contain the complete rectified page. A photographed page is first detected as the largest four-corner document, perspective-corrected, and warped to 1440 × 2048. Fixed regions are applied only after this step.

## Page 1 — student table anchors

- Vertical table boundaries: `29, 254, 694, 861, 935, 1033, 1268, 1384`
- Student row boundaries: `325, 435, 545, 656, 767, 877, 988`
- The six rows reuse the same horizontal regions. Their top anchors are `325, 435, 545, 656, 767, 877`.

For a row whose top anchor is `T`:

| User-fillable region | Coordinates |
| --- | --- |
| Chinese name | `36, T+4, 211, 102` |
| English name | `260, T+4, 427, 102` |
| Date of birth | `700, T+5, 153, 100` |
| Age | `867, T+5, 62, 100` |
| Male circle | `949, T+10, 43, 43` |
| Female circle | `949, T+51, 43, 43` |
| Christianity circle | `1038, T+10, 43, 43` |
| Taoism circle | `1165, T+10, 43, 43` |
| Buddhism circle | `1038, T+51, 43, 43` |
| Other religion circle | `1165, T+51, 43, 43` |
| First-time Yes circle | `1292, T+10, 43, 43` |
| First-time No circle | `1292, T+51, 43, 43` |

## Page 1 — guardian/contact fields

| Field | Coordinates |
| --- | --- |
| Chinese name | `194, 1167, 300, 60` |
| English name | `675, 1167, 692, 60` |
| Mobile | `194, 1233, 478, 60` |
| Home telephone | `836, 1233, 531, 60` |
| Email | `194, 1300, 1173, 59` |
| Address line 1 | `194, 1366, 1173, 60` |
| Address line 2 | `55, 1432, 1312, 60` |
| Address line 3 | `55, 1499, 1312, 59` |
| Address line 4 | `55, 1565, 1312, 60` |
| Remarks line 1 | `735, 1632, 632, 59` |
| Remarks line 2 | `55, 1698, 1312, 59` |
| Remarks line 3 | `55, 1764, 1312, 60` |
| Remarks line 4 | `55, 1831, 1312, 58` |
| Invited by | `194, 1896, 1173, 59` |

## Page 2 — consent and parent response

| Field or circle | Coordinates |
| --- | --- |
| Parent/guardian name | `264, 493, 367, 57` |
| IC number | `825, 493, 430, 57` |
| Signature-presence area | `473, 753, 405, 63` |
| Consent date | `995, 753, 256, 63` |
| Receive activity information | `184, 1148, 50, 50` |
| Learn Christian faith | `184, 1240, 50, 50` |
| Accept church visitation | `184, 1332, 50, 50` |

## Page 2 — office use

| Field | Coordinates |
| --- | --- |
| Fee per person | `486, 1582, 65, 73` |
| Number of people | `599, 1582, 53, 73` |
| Total registration fee | `981, 1582, 307, 73` |
| Amount paid | `475, 1820, 188, 102` |
| Payment date | `758, 1820, 160, 102` |
| Receiver | `1042, 1820, 248, 102` |

## Calibration mode

Open `verify.html?debug=true`, or begin the scan from `index.html?debug=true`. The verification page displays:

- the normalized page with every field, circle, and signature rectangle;
- every extracted crop;
- its OCR/detection result;
- confidence and extra-ink ratio.

Edit coordinates only in `config/page1-template.js` and `config/page2-template.js`. After changing a region, process the completed sample again; saved results from an earlier scan do not recalculate automatically.
