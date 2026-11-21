/**
 * MyFNG CRM → "DAILY Telecrm Won Records" sheet.
 *
 *  - Booking confirmed → one new line in "Today send lead" (columns A–M).
 *  - In Service (action "in_service") → that line (matched by phone, column B) moves to the
 *    "Today" tab (A–M copied) and is removed from "Today send lead". Not found → nothing changes.
 *
 * Keep this as its OWN standalone project (script.google.com → New project).
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
var IN_SERVICE_TAB = 'Today';
var COLS = 13; // A → M

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!secret || body.secret !== secret) return json_({ ok: false, error: 'unauthorized' });

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = findTab_(ss, TAB_NAME);
    if (!sheet) return json_({ ok: false, error: 'tab not found: ' + TAB_NAME + ' | tabs: ' + tabNames_(ss) });

    if (body.action === 'in_service') return moveToInService_(ss, sheet, body.booking || {});

    var b = body.booking || {};
    if (!b.name || !b.phone) return json_({ ok: false, error: 'name and phone required' });

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

/** In Service: copy A–M of the latest matching line into "Today", then delete it from "Today send lead". */
function moveToInService_(ss, sheet, b) {
  var want = last10_(b.phone);
  if (!want) return json_({ ok: false, error: 'phone required' });

  var target = findTab_(ss, IN_SERVICE_TAB);
  if (!target) return json_({ ok: false, error: 'tab not found: ' + IN_SERVICE_TAB + ' | tabs: ' + tabNames_(ss) });

  var last = sheet.getLastRow();
  if (last < 1) return json_({ ok: true, moved: false, reason: 'not found' });

  // Latest line first (bottom up), match on column B.
  var phones = sheet.getRange(1, 2, last, 1).getValues();
  for (var r = last; r >= 1; r--) {
    if (last10_(phones[r - 1][0]) !== want) continue;
    var values = sheet.getRange(r, 1, 1, COLS).getValues()[0];
    target.appendRow(values);
    sheet.deleteRow(r);
    return json_({ ok: true, moved: true, from_row: r, to_row: target.getLastRow() });
  }
  return json_({ ok: true, moved: false, reason: 'not found' });
}

function last10_(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
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

function tabNames_(ss) {
  return ss.getSheets().map(function (s) { return '[' + s.getName() + ']'; }).join(', ');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
