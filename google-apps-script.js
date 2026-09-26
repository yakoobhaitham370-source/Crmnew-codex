/**
 * ============================================================================
 * 🏥 PharmPulse Enterprise - Lightweight Fast Google Apps Script (Code.gs)
 * الإصدار: 4.0.0 Ultra-Fast Edition
 * ============================================================================
 * 
 * 📖 تعليمات التركيب والتفعيل:
 * 1. افتح جدول بيانات Google Sheet (sheets.new).
 * 2. اضغط: الامتدادات (Extensions) > Apps Script.
 * 3. استبدل محتوى Code.gs بهذا الكود كاملاً واحفظ (💾 Ctrl+S).
 * 4. في أعلى اليمين: نشر (Deploy) > نشر جديد (New deployment) > تطبيق ويب (Web app).
 *    - تنفيذ كـ (Execute as): أنا (Me)
 *    - من لديه حق الوصول (Who has access): أي شخص (Anyone)  <-- ⚠️ ضروري جداً
 * 5. اضغط Deploy وامنح الصلاحيات (Authorize Access).
 * 6. انسخ رابط تطبيق الويب (/exec) والصقه في خانة الربط في إعدادات التطبيق.
 * ============================================================================
 */

const SHEET_PATIENTS = "Patients_DB";
const SHEET_FOLLOWUPS = "Clinical_FollowUps";
const SHEET_SETTINGS = "Settings_Config";
const DRIVE_FOLDER_NAME = "PharmPulse_Prescriptions_Labs";

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * تهيئة الأوراق والأعمدة تلقائياً
 */
function ensureDatabaseSchema(ss) {
  // 1. جدول المرضى
  let pSheet = ss.getSheetByName(SHEET_PATIENTS);
  if (!pSheet) {
    pSheet = ss.insertSheet(SHEET_PATIENTS);
    const headers = [
      "ID", "Name", "Phone", "Age", "Gender", "Family_Tag", "Diagnosis",
      "Medications_Summary", "Prescription_Photos_URLs", "Loyalty_Points",
      "Allergies", "Notes", "Vitals_JSON", "Medications_JSON", "Scans_JSON",
      "Is_Archived", "Last_Updated"
    ];
    pSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    pSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#f8fafc");
    pSheet.setFrozenRows(1);
    pSheet.setColumnWidth(2, 180); // Name
    pSheet.setColumnWidth(8, 240); // Meds
    pSheet.setColumnWidth(9, 280); // Prescription Photos
  }

  // 2. جدول المتابعات السريرية
  let fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
  if (!fSheet) {
    fSheet = ss.insertSheet(SHEET_FOLLOWUPS);
    const headers = ["ID", "Patient_ID", "Patient_Name", "Phone", "Type", "Drug", "Due_Date", "Status", "Notes", "Created_At"];
    fSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    fSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#f8fafc");
    fSheet.setFrozenRows(1);
  }

  // 3. جدول الإعدادات
  let sSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sSheet) {
    sSheet = ss.insertSheet(SHEET_SETTINGS);
    const headers = ["Key", "Value", "Updated_At"];
    sSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#1e293b").setFontColor("#f8fafc");
    sSheet.setFrozenRows(1);
  }
}

/**
 * تحويل كائن المريض لصف في الشيت
 */
function patientToRow(p, nowStr) {
  // ملخص الأدوية المقروء بالعين
  const medsSummary = (p.medications || []).map(function(m) {
    return (m.name || "") + (m.dose ? " " + m.dose : "") + (m.frequency ? " (" + m.frequency + ")" : "");
  }).filter(Boolean).join(", ");

  // استخراج روابط صور الروشتات والتحاليل في Google Drive
  const photoUrls = (p.scans || []).map(function(s) {
    return s.driveUrl || s.previewUrl || (s.fileId ? "https://lh3.googleusercontent.com/d/" + s.fileId : "");
  }).filter(Boolean).join("\n");

  // تنظيف الـ Scans من الـ base64 لتجنب تجاوز حد 50 ألف حرف للخلية
  const cleanScans = (p.scans || []).map(function(s) {
    return {
      id: s.id || "",
      date: s.date || "",
      title: s.title || "",
      driveUrl: s.driveUrl || "",
      previewUrl: s.previewUrl || s.driveUrl || "",
      fileId: s.fileId || "",
      fileSize: s.fileSize || ""
    };
  });

  return [
    p.id || "",
    p.name || "",
    p.phone || "",
    p.age !== undefined && p.age !== null ? p.age : "",
    p.gender || "",
    p.familyTag || "",
    p.diagnosis || "",
    medsSummary,
    photoUrls,
    p.loyaltyPoints || 0,
    p.allergies || "",
    p.notes || "",
    JSON.stringify(p.vitals || []),
    JSON.stringify(p.medications || []),
    JSON.stringify(cleanScans),
    p.isArchived ? "TRUE" : "FALSE",
    p.lastUpdated || nowStr
  ];
}

/**
 * تحويل صف من الشيت إلى كائن مريض
 */
function rowToPatient(row) {
  let vitals = [], meds = [], scans = [];
  try { vitals = row[12] ? JSON.parse(row[12]) : []; } catch (e) {}
  try { meds = row[13] ? JSON.parse(row[13]) : []; } catch (e) {}
  try { scans = row[14] ? JSON.parse(row[14]) : []; } catch (e) {}

  return {
    id: String(row[0] || ""),
    name: String(row[1] || ""),
    phone: String(row[2] || ""),
    age: row[3] !== "" ? Number(row[3]) : undefined,
    gender: String(row[4] || ""),
    familyTag: String(row[5] || ""),
    diagnosis: String(row[6] || ""),
    loyaltyPoints: row[9] !== "" ? Number(row[9]) : 0,
    allergies: String(row[10] || ""),
    notes: String(row[11] || ""),
    vitals: vitals,
    medications: meds,
    scans: scans,
    isArchived: String(row[15]).toUpperCase() === "TRUE",
    lastUpdated: String(row[16] || "")
  };
}

/**
 * حفظ ملف صورة في Google Drive
 */
function saveBase64ImageToDrive(patientId, fileName, base64Data) {
  if (!base64Data) return { fileId: "", fileUrl: "", previewUrl: "", thumbnailUrl: "" };
  let folder;
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);

  const clean = base64Data.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  const decoded = Utilities.base64Decode(clean);
  const safeName = (patientId || "Patient") + "_" + Date.now() + "_" + (fileName || "rx.jpg");
  const blob = Utilities.newBlob(decoded, "image/jpeg", safeName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  return {
    fileId: fileId,
    fileUrl: file.getUrl(),
    previewUrl: "https://lh3.googleusercontent.com/d/" + fileId,
    thumbnailUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w2000"
  };
}

/**
 * معالجة طلبات GET (Fetch & Ping)
 */
function doGet(e) {
  const ss = getSpreadsheet();
  ensureDatabaseSchema(ss);
  const params = e ? e.parameter : {};
  const action = (params.action || "FETCH_ALL").toUpperCase();
  const callback = params.callback;

  let result = { status: "SUCCESS" };

  if (action === "PING") {
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    result.counts = {
      patients: pSheet ? Math.max(0, pSheet.getLastRow() - 1) : 0,
      followUps: fSheet ? Math.max(0, fSheet.getLastRow() - 1) : 0
    };
    result.spreadsheetName = ss.getName();
    result.version = "4.0.0-Fast";
  } else {
    // FETCH_ALL
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    const sSheet = ss.getSheetByName(SHEET_SETTINGS);

    const patients = [];
    if (pSheet && pSheet.getLastRow() > 1) {
      const pRows = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, 17).getValues();
      for (let i = 0; i < pRows.length; i++) {
        if (pRows[i][0]) patients.push(rowToPatient(pRows[i]));
      }
    }

    const followUps = [];
    if (fSheet && fSheet.getLastRow() > 1) {
      const fRows = fSheet.getRange(2, 1, fSheet.getLastRow() - 1, 10).getValues();
      for (let i = 0; i < fRows.length; i++) {
        if (fRows[i][0]) {
          followUps.push({
            id: String(fRows[i][0]),
            patientId: String(fRows[i][1] || ""),
            patientName: String(fRows[i][2] || ""),
            phone: String(fRows[i][3] || ""),
            type: String(fRows[i][4] || ""),
            drug: String(fRows[i][5] || ""),
            dueDate: String(fRows[i][6] || ""),
            resolved: String(fRows[i][7]).toUpperCase() === "RESOLVED" || String(fRows[i][7]).toUpperCase() === "TRUE",
            notes: String(fRows[i][8] || ""),
            createdAt: String(fRows[i][9] || "")
          });
        }
      }
    }

    const settings = {};
    if (sSheet && sSheet.getLastRow() > 1) {
      const sRows = sSheet.getRange(2, 1, sSheet.getLastRow() - 1, 2).getValues();
      for (let i = 0; i < sRows.length; i++) {
        if (sRows[i][0]) settings[sRows[i][0]] = sRows[i][1];
      }
    }

    result.patients = patients;
    result.followUps = followUps;
    result.settings = settings;
  }

  const output = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + output + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

/**
 * معالجة طلبات POST (Save, Upload & Sync)
 */
function doPost(e) {
  const ss = getSpreadsheet();
  ensureDatabaseSchema(ss);
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    body = e.parameter || {};
  }

  const action = (body.action || "SYNC_UPSTREAM").toUpperCase();
  const now = new Date().toISOString();

  if (action === "UPLOAD_SCAN") {
    const uploadRes = saveBase64ImageToDrive(body.patientId, body.title, body.base64Data);
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", ...uploadRes })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "SAVE_PATIENT") {
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const p = body.patient;
    if (p && p.id && pSheet) {
      const data = pSheet.getDataRange().getValues();
      let foundRow = -1;
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][0]) === String(p.id)) {
          foundRow = r + 1;
          break;
        }
      }
      const rowVals = patientToRow(p, now);
      if (foundRow > 0) {
        pSheet.getRange(foundRow, 1, 1, rowVals.length).setValues([rowVals]);
      } else {
        pSheet.appendRow(rowVals);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "DELETE_PATIENT") {
    const pid = String(body.patientId || "");
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (pid === "ALL") {
      if (pSheet && pSheet.getLastRow() > 1) pSheet.deleteRows(2, pSheet.getLastRow() - 1);
      if (fSheet && fSheet.getLastRow() > 1) fSheet.deleteRows(2, fSheet.getLastRow() - 1);
    } else if (pSheet) {
      const data = pSheet.getDataRange().getValues();
      for (let r = data.length - 1; r >= 1; r--) {
        if (String(data[r][0]) === pid) pSheet.deleteRow(r + 1);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "CLEAR_DATABASE") {
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (pSheet && pSheet.getLastRow() > 1) pSheet.deleteRows(2, pSheet.getLastRow() - 1);
    if (fSheet && fSheet.getLastRow() > 1) fSheet.deleteRows(2, fSheet.getLastRow() - 1);
    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
  }

  // SYNC_UPSTREAM (Batch Sync)
  if (body.patients && Array.isArray(body.patients)) {
    const pSheet = ss.getSheetByName(SHEET_PATIENTS);
    if (pSheet) {
      if (pSheet.getLastRow() > 1) pSheet.deleteRows(2, pSheet.getLastRow() - 1);
      if (body.patients.length > 0) {
        const rows = body.patients.map(function(p) { return patientToRow(p, now); });
        pSheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
    }
  }

  if (body.followUps && Array.isArray(body.followUps)) {
    const fSheet = ss.getSheetByName(SHEET_FOLLOWUPS);
    if (fSheet) {
      if (fSheet.getLastRow() > 1) fSheet.deleteRows(2, fSheet.getLastRow() - 1);
      if (body.followUps.length > 0) {
        const fRows = body.followUps.map(function(f) {
          return [
            f.id || "",
            f.patientId || "",
            f.patientName || "",
            f.phone || "",
            f.type || "",
            f.drug || "",
            f.dueDate || "",
            f.resolved ? "RESOLVED" : "PENDING",
            f.notes || "",
            f.createdAt || now
          ];
        });
        fSheet.getRange(2, 1, fRows.length, fRows[0].length).setValues(fRows);
      }
    }
  }

  if (body.settings && typeof body.settings === "object") {
    const sSheet = ss.getSheetByName(SHEET_SETTINGS);
    if (sSheet) {
      const keys = Object.keys(body.settings);
      keys.forEach(function(k) {
        const val = typeof body.settings[k] === "object" ? JSON.stringify(body.settings[k]) : String(body.settings[k]);
        sSheet.appendRow([k, val, now]);
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" })).setMimeType(ContentService.MimeType.JSON);
}
