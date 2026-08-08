# Internal Registration Form Scanner

A simple, mobile-friendly, two-page fixed-template form scanner. It runs OCR and image processing in the browser, lets a person correct the result, and sends only confirmed text to Google Sheets.

## What is included

- Phone camera or JPG/PNG upload for exactly two form pages.
- Page-edge detection, perspective correction, rotation correction, and normalization to 1440 × 2048.
- Bundled OpenCV running inside a Web Worker, keeping the upload page responsive.
- Fixed field crops derived from the supplied blank templates.
- Browser OCR through Tesseract.js (`chi_sim+eng`).
- Circle/tick detection by comparing each known circle with the blank template.
- Signature-presence detection without attempting to read the signature.
- Editable verification for students, guardian, consent, parent response, and office use.
- Fee calculation warning that does not block correction or submission.
- Google Apps Script endpoint that writes one student per row.
- Debug mode with page overlays, extracted crops, OCR results, confidence, and ink ratios.
- No Laravel, Python server, database, accounts, Docker, or paid hosting.

Handwritten Chinese and cursive English remain difficult for Tesseract. This application deliberately treats human verification as mandatory. It does not promise perfect handwriting recognition.

## Project structure

```text
registration-form-scanner/
├── index.html
├── verify.html
├── success.html
├── config/
│   ├── app-config.js
│   ├── page1-template.js
│   └── page2-template.js
├── css/style.css
├── js/
│   ├── app.js
│   ├── extractor.js
│   ├── imageProcessor.js
│   ├── opencv-worker.js
│   ├── vendor/
│   │   ├── opencv-4.12.0.js
│   │   ├── LICENSE-opencv.txt
│   │   └── README.md
│   ├── markDetector.js
│   ├── ocr.js
│   ├── sheets.js
│   ├── storage.js
│   ├── success.js
│   ├── validation.js
│   └── verify.js
├── assets/templates/
│   ├── page1-reference.png
│   └── page2-reference.png
├── apps-script/Code.gs
├── docs/template-map.md
├── docs/testing.md
└── tests/validation.test.mjs
```

## 1. Test locally

The browser blocks JavaScript modules when HTML files are opened directly. Start a small local file server from this folder.

With Python installed:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

For the calibration overlay:

```text
http://localhost:8000/?debug=true
```

OpenCV is included in this project and runs in a background worker, so it is not downloaded from the OpenCV documentation site. The first scan still downloads Tesseract's OCR language data and can take longer than later scans. An internet connection is required for that OCR download.

## 2. Prepare Google Sheets

1. Create a new Google Sheet.
2. Copy its ID from the URL. In `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`, the text between `/d/` and `/edit` is the ID.
3. You may keep the first sheet tab or create a tab named `Registrations`. The script creates that tab if it does not exist.
4. In the Sheet, choose **Extensions → Apps Script**.
5. Delete the example code and paste everything from `apps-script/Code.gs`.
6. At the top of `Code.gs`, replace:

```javascript
spreadsheetId: 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE',
sheetName: 'Registrations',
```

7. Click **Save**.

The script creates the header row automatically on the first successful submission. One family with three children produces three rows; guardian, consent, response, and payment information is repeated for each child.

## 3. Deploy Google Apps Script

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear icon and choose **Web app**.
3. Description: `Registration Form Scanner`.
4. **Execute as:** Me.
5. **Who has access:** Anyone. If your Workspace administrator prevents this, use the widest internal option allowed by your organization and ensure every scanner user is signed in.
6. Click **Deploy** and authorize the script.
7. Copy the Web App URL ending in `/exec`. Do not use the `/dev` test URL.
8. Open `config/app-config.js` and replace:

```javascript
appsScriptUrl: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
```

with the copied `/exec` URL.

9. Re-upload the changed file to GitHub and test one submission with made-up data.

When `Code.gs` changes later, choose **Deploy → Manage deployments → Edit**, select **New version**, and deploy again. The existing `/exec` URL normally remains the same.

## 4. Put the project on GitHub

Create an empty GitHub repository, for example `registration-form-scanner`. In PowerShell, open this project folder and run:

```powershell
git init
git add .
git commit -m "Create registration form scanner"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/registration-form-scanner.git
git push -u origin main
```

Do not add completed registration photos. The repository should contain only the two blank reference templates.

## 5. Enable free GitHub Pages hosting

1. Open the repository on GitHub.
2. Choose **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**.
5. Click **Save**.
6. Wait for deployment to finish. GitHub shows a URL similar to:

```text
https://YOUR_USERNAME.github.io/registration-form-scanner/
```

Open the URL on a phone and test camera upload, verification, and a made-up Google Sheets submission.

## Configuration you must provide

Only three values need manual configuration:

| Value | File | Where to put it |
| --- | --- | --- |
| Google Sheet ID | `apps-script/Code.gs` | `CONFIG.spreadsheetId` |
| Google Sheet tab name | `apps-script/Code.gs` | `CONFIG.sheetName` |
| Apps Script Web App `/exec` URL | `config/app-config.js` | `APP_CONFIG.appsScriptUrl` |

## Coordinates and crop calibration

The exact mapping is documented in `docs/template-map.md`. Coordinates are centralized in:

- `config/page1-template.js`
- `config/page2-template.js`

Do not change OCR source code to adjust a crop. Change only the relevant rectangle in those files, then scan the completed test form again with `?debug=true`.

Debug colors:

- Green: OCR field.
- Red: selectable circle.
- Purple: signature-presence region.

The normalized page and every crop are shown below the verification form. This is the correct place to decide whether a rectangle needs small adjustment.

## Privacy

- Original photos are never sent to GitHub or Google Sheets.
- Image processing and OCR happen in the browser.
- Normalized photos are temporary in browser IndexedDB and are cleared after a successful submission.
- Only verified text is submitted.
- Do not use real completed forms in the Git repository, bug reports, or screenshots.
- Apps Script prevents values beginning with spreadsheet-formula characters from executing as formulas.

## Run checks

Node.js is optional and is used only for development checks—not as a backend:

```powershell
npm test
npm run check
```

The deployed application remains plain HTML, CSS, and Vanilla JavaScript.

## Troubleshooting

### “We could not clearly detect the form”

Retake the photo with the complete sheet and all four corners visible. Use a contrasting background and avoid a shadow touching a page edge.

### Progress stays at “Loading bundled OpenCV”

Make sure `js/vendor/opencv-4.12.0.js` and `js/opencv-worker.js` were uploaded with the rest of the project. Do not open `index.html` directly from the file system; use an HTTP server or GitHub Pages. If an older version is cached, hard-refresh the page.

### Page order error

Make sure the student table is uploaded as Page 1 and the parent consent page as Page 2.

### A crop is wrong

Open the scan with `?debug=true`, inspect the normalized-page overlay, and compare the crop against `docs/template-map.md`. Adjust only the matching template configuration rectangle.

If the form itself appears diagonal or stretched underneath otherwise straight coordinate boxes, the problem is page normalization rather than field mapping. Retake the photo with all four page corners visible and make sure the latest `js/opencv-worker.js` is deployed.

### Chinese OCR is weak

Tesseract is not specialized handwriting AI. Keep manual correction. If most names are Traditional Chinese, change `ocrLanguages` in `config/app-config.js` from `chi_sim+eng` to `chi_tra+eng`; this downloads different language data on the next scan.

### Google Sheets is not configured

Complete the Apps Script steps and paste the final `/exec` URL into `config/app-config.js`.

### Submission fails

Open the Apps Script `/exec` URL in a browser. It should return JSON showing the service is running. Confirm that the latest Apps Script version is deployed, its access setting permits the scanner user, and the Sheet ID is correct.

## Important maintenance rule

The form layout is fixed. If the church redesigns either physical page, take new clean blank scans, replace the reference PNG files, and recalibrate every affected coordinate before using the scanner again.
