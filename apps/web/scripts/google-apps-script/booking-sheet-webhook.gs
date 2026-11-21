/**
 * MyFNG CRM → "DAILY Telecrm Won Records" sheet, tab "Today send lead".
 * When a lead is marked "Booking confirmed" in the MyFNG CRM, the server POSTs it here and
 * this script adds one line — same columns as the TeleCRM script already writing to this sheet.
 *
 * Keep this as its OWN standalone project (script.google.com → New project).
 * Do NOT paste it into the TeleCRM script: one project can only have one doPost.
 *
 * Setup (once):
 *  1. script.google.com → New project → paste this file → Save.
 *  2. Project Settings (gear) → Script Properties → Add: WEBHOOK_SECRET = <same value as the
 *     server's BOOKING_SHEET_WEBHOOK_SECRET>.
 *  3. Deploy → New deployment → type "Web app" → Execute as: Me → Who has access: Anyone → Deploy
 *     (allow access to Google Sheets when asked). Copy the Web app URL into the server's
 *     BOOKING_SHEET_WEBHOOK_URL.
 *  After editing later: Deploy → Manage deployments → Edit → Version: New version.
 */

var SPREADSHEET_ID = '1v7i7wOU3MRsA8mQJ1WnITNkzrJLQKapvnNvbDXrYPrg';
var TAB_NAME = 'Today send lead';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!secret || body.secret !== secret) return json_({ ok: false, error: 'unauthorized' });

    var b = body.booking || {};
    if (!b.name || !b.phone) return json_({ ok: false, error: 'name and phone required' });

    var sheet = findTab_(SpreadsheetApp.openById(SPREADSHEET_ID), TAB_NAME);
    if (!sheet) {
      var names = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets().map(function (s) { return '[' + s.getName() + ']'; });
      return json_({ ok: false, error: 'tab not found: ' + TAB_NAME + ' | tabs: ' + names.join(', ') });
    }

    // Same column order as the TeleCRM script (A → M).
    var row = [
      b.name,                 // A  Name
      b.phone,                // B  Phone (91…)
      b.address || '',        // C  Address
      b.carNo || '',          // D  Car number
      b.regDate || '',        // E  Registration date
      b.make || '',           // F  Make
      b.carModel || '',       // G  Model
      b.package || '',        // H  Package
      b.workshop || '',       // I  Workshop
      b.agent || '',          // J  Employee (telecaller)
      b.visitType || '',      // K  Visit / Pickup
      b.remark || '',         // L  Remark
      b.sentAt || '',         // M  Added (date & time, IST)
    ];
    sheet.appendRow(row);
    return json_({ ok: true, row: sheet.getLastRow() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Match the tab name ignoring case and extra spaces ("Today send lead " === "today send lead").
function findTab_(ss, name) {
  var want = String(name).replace(/\s+/g, ' ').trim().toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().replace(/\s+/g, ' ').trim().toLowerCase() === want) return sheets[i];
  }
  return null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
