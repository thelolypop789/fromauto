/**
 * Google Apps Script สำหรับ FormAuto
 * ทำหน้าที่สร้าง Google Form อัตโนมัติ พร้อมตั้งค่าเป็นแบบทดสอบ (Quiz) มีเฉลย
 * รองรับส่วนหัวแบบ Dropdown (เช่น เมนูเลือกห้องเรียน)
 * และสร้าง Google Sheet ซิงค์คำตอบ/คะแนนอัตโนมัติ พร้อมแท็บแดชบอร์ดสรุปภาพรวมคะแนน
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ถ้าเป็นการขอข้อมูลสรุปคะแนนของแบบทดสอบ
    if (data && data.action === "get_summary") {
      return handleGetSummary(data.sheetUrl || data.sheetId);
    }

    // ถ้าเป็นการบันทึก/แก้ไขคะแนนนักเรียนโดยตรงจากระบบ FormAuto
    if (data && data.action === "update_score") {
      return handleUpdateScore(data);
    }

    var form = FormApp.create(data.title || "แบบทดสอบออนไลน์");

    // 1. ตั้งค่าให้เป็นแบบทดสอบ (Quiz) และตั้งค่าไม่เก็บอีเมลเด็ดขาด
    form.setIsQuiz(true);
    form.setCollectEmail(false); // ปิดการบังคับเก็บอีเมล เพื่อให้นักเรียนทำได้ทันทีโดยไม่ต้องกรอกเมล
    form.setLimitOneResponsePerUser(false); // ปิดการจำกัดสิทธิ์ 1 คนต่อ 1 ครั้ง (เพื่อไม่ให้บังคับล็อกอินกูเกิล)
    try {
      form.setRequireLogin(false); // ปิดการบังคับล็อกอินเมลองค์กร (ถ้าโดเมนอนุญาต)
    } catch (loginErr) {
      Logger.log("RequireLogin setting note: " + loginErr.message);
    }
    form.setShowLinkToRespondAgain(false);
    form.setAllowResponseEdits(false);
    form.setPublishingSummary(true); // อนุญาตให้ดูสรุปผลหลังส่ง
    form.setConfirmationMessage("บันทึกคำตอบเรียบร้อยแล้ว ✅ คุณสามารถกดปุ่ม \"ดูคะแนน\" เพื่อดูคะแนนและข้อที่ถูกต้องได้ทันที");

    if (data.description) {
      form.setDescription(data.description);
    }

    // 2. สร้างคำถามส่วนหัว (รองรับทั้งแบบพิมพ์ข้อความ และแบบเมนู Dropdown เลือกห้อง/ชั้น)
    if (data.headers && Array.isArray(data.headers)) {
      data.headers.forEach(function(h) {
        if (h.type === "dropdown" && h.choices && h.choices.length > 0) {
          var item = form.addListItem();
          item.setTitle(h.label);
          item.setChoiceValues(h.choices);
          item.setRequired(h.required !== false);
        } else {
          var item = form.addTextItem();
          item.setTitle(h.label);
          item.setRequired(h.required !== false);
        }
      });
    }

    // 3. สร้างข้อสอบ (รองรับ ปรนัย Multiple Choice, เติมคำ Short Answer, อัตนัย Paragraph พร้อมคะแนนรายข้อ)
    var hasManualGrading = false;
    var manualQuestions = [];
    var totalMaxPoints = 0;

    if (data.questions && Array.isArray(data.questions)) {
      data.questions.forEach(function(q) {
        var pts = (typeof q.points === "number" && q.points >= 0) ? q.points : 1;
        totalMaxPoints += pts;

        if (q.type === "short_answer" || q.type === "text") {
          hasManualGrading = true;
          manualQuestions.push({
            text: q.text || "ข้อสอบเติมคำ",
            type: "short_answer",
            answerText: q.answerText || "",
            points: pts
          });
          var item = form.addTextItem();
          item.setTitle(q.text);
          item.setPoints(pts);
          item.setRequired(true);
          if (q.answerText) {
            item.setHelpText("แนวคำตอบ/เฉลย: " + q.answerText);
          }
        } else if (q.type === "paragraph" || q.type === "essay") {
          hasManualGrading = true;
          manualQuestions.push({
            text: q.text || "ข้อสอบอัตนัย",
            type: "paragraph",
            answerText: q.answerText || "",
            points: pts
          });
          var item = form.addParagraphTextItem();
          item.setTitle(q.text);
          item.setPoints(pts);
          item.setRequired(true);
          if (q.answerText) {
            item.setHelpText("เกณฑ์การให้คะแนน/แนวคำตอบ: " + q.answerText);
          }
        } else {
          // ค่าเริ่มต้น: ปรนัย (Multiple Choice)
          var item = form.addMultipleChoiceItem();
          item.setTitle(q.text);
          item.setPoints(pts);
          item.setRequired(true);

          var choices = [];
          if (q.choices && Array.isArray(q.choices)) {
            q.choices.forEach(function(choiceText, idx) {
              var isCorrect = (idx === q.answer);
              choices.push(item.createChoice(choiceText, isCorrect));
            });
          }
          item.setChoices(choices);
        }
      });
    }

    if (totalMaxPoints === 0) {
      totalMaxPoints = (data.questions && data.questions.length) ? data.questions.length : 10;
    }

    var formId = form.getId();
    var editUrl = form.getEditUrl();
    var publishedUrl = form.getPublishedUrl();

    // 4. สร้าง Google Sheet พร้อมแท็บ "📊 สรุปภาพรวมคะแนน" และซิงค์ผลการสอบแบบ Real-time
    var sheetUrl = "";
    try {
      var sheetTitle = "ผลการสอบ - " + (data.title || "แบบทดสอบออนไลน์");
      var ss = SpreadsheetApp.create(sheetTitle);
      var summarySheet = ss.getSheets()[0]; // เก็บแท็บแรกไว้สร้างแดชบอร์ดสรุปคะแนน
      summarySheet.setName("📊 สรุปภาพรวมคะแนน");
      summarySheet.setTabColor("#0F9D58");

      // เชื่อมต่อ Form เข้ากับ Google Sheet
      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
      SpreadsheetApp.flush();

      // หาแท็บคะแนนดิบที่ Google Forms เพิ่งสร้างขึ้น แล้วเปลี่ยนชื่อให้เป็นระเบียบ
      var allSheets = ss.getSheets();
      var responseSheet = null;
      for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
        if (allSheets[sIdx].getSheetId() !== summarySheet.getSheetId()) {
          responseSheet = allSheets[sIdx];
          break;
        }
      }

      if (!responseSheet) {
        Utilities.sleep(1000);
        SpreadsheetApp.flush();
        allSheets = ss.getSheets();
        for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
          if (allSheets[sIdx].getSheetId() !== summarySheet.getSheetId()) {
            responseSheet = allSheets[sIdx];
            break;
          }
        }
      }

      if (responseSheet) {
        responseSheet.setName("ผลการสอบรายบุคคล");
        responseSheet.setTabColor("#4285F4");
      }

      // ออกแบบแท็บ "📊 สรุปภาพรวมคะแนน"
      var passScore = Math.ceil(totalMaxPoints * 0.5);

      // แบนเนอร์หัวข้อตารางสรุป
      summarySheet.getRange("A1:G1").merge()
        .setValue("📊 สรุปภาพรวมผลการสอบ: " + (data.title || "แบบทดสอบออนไลน์"))
        .setBackground("#1E3A8A")
        .setFontColor("#FFFFFF")
        .setFontSize(14)
        .setFontWeight("bold")
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
      summarySheet.setRowHeight(1, 40);

      summarySheet.getRange("A2:G2").merge()
        .setValue("ระบบสรุปคะแนนอัตโนมัติแบบ Real-time • FormAuto")
        .setBackground("#EFF6FF")
        .setFontColor("#2563EB")
        .setFontSize(10)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
      summarySheet.setRowHeight(2, 24);

      // Helper column Z สำหรับสกัดคะแนนตัวเลขจากข้อความดิบ เช่น "8 / 10" -> 8
      summarySheet.getRange("Z1").setValue("คะแนนตัวเลข (ระบบ)");
      summarySheet.getRange("Z2").setFormula("=ARRAYFORMULA(IF('ผลการสอบรายบุคคล'!B2:B=\"\", \"\", IFERROR(VALUE(LEFT('ผลการสอบรายบุคคล'!B2:B, FIND(\"/\", 'ผลการสอบรายบุคคล'!B2:B) - 1)), 0)))");
      summarySheet.getRange("Z3").setValue(hasManualGrading ? "HAS_MANUAL_GRADING" : "AUTO_GRADED");
      summarySheet.getRange("Z4").setValue(JSON.stringify(manualQuestions));
      summarySheet.getRange("Z5").setValue(totalMaxPoints);
      summarySheet.hideColumns(26);

      // การ์ดสถิติภาพรวม
      summarySheet.getRange("B4:C4").merge()
        .setValue("📌 สถิติผลการสอบทั้งระดับชั้น")
        .setBackground("#2563EB")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold")
        .setFontSize(11)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
      summarySheet.setRowHeight(4, 30);

      var statLabels = [
        ["👥 จำนวนนักเรียนที่ส่งข้อสอบ", "=COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\") & \" คน\""],
        ["🎯 คะแนนเต็ม", totalMaxPoints + " คะแนน"],
        ["📈 คะแนนเฉลี่ย (Mean)", "=IF(COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\")=0, \"-\", ROUND(AVERAGE(Z2:Z), 2) & \" คะแนน\")"],
        ["🏆 คะแนนสูงสุด (Max)", "=IF(COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\")=0, \"-\", MAX(Z2:Z) & \" คะแนน\")"],
        ["📉 คะแนนต่ำสุด (Min)", "=IF(COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\")=0, \"-\", MIN(Z2:Z) & \" คะแนน\")"],
        ["✅ สอบผ่าน (เกณฑ์ ≥ " + passScore + " คะแนน)", "=IF(COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\")=0, \"-\", COUNTIF(Z2:Z, \">=\" & " + passScore + ") & \" คน\")"],
        ["❌ ไม่ผ่านเกณฑ์ (< " + passScore + " คะแนน)", "=IF(COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\")=0, \"-\", (COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\") - COUNTIF(Z2:Z, \">=\" & " + passScore + ")) & \" คน\")"],
        ["📊 อัตราการผ่านเกณฑ์", "=IF(COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\")=0, \"-\", ROUND((COUNTIF(Z2:Z, \">=\" & " + passScore + ") / COUNTIF('ผลการสอบรายบุคคล'!B2:B, \"*/*\")) * 100, 1) & \"%\")"]
      ];

      for (var r = 0; r < statLabels.length; r++) {
        var rowNum = 5 + r;
        var cellLabel = summarySheet.getRange(rowNum, 2);
        var cellVal = summarySheet.getRange(rowNum, 3);
        
        cellLabel.setValue(statLabels[r][0])
          .setBackground(r % 2 === 0 ? "#F8FAFC" : "#FFFFFF")
          .setFontWeight("bold")
          .setFontSize(10)
          .setVerticalAlignment("middle");

        if (statLabels[r][1].toString().charAt(0) === '=') {
          cellVal.setFormula(statLabels[r][1]);
        } else {
          cellVal.setValue(statLabels[r][1]);
        }

        cellVal.setBackground(r % 2 === 0 ? "#F8FAFC" : "#FFFFFF")
          .setFontColor("#1E3A8A")
          .setFontWeight("bold")
          .setFontSize(10)
          .setHorizontalAlignment("center")
          .setVerticalAlignment("middle");
        summarySheet.setRowHeight(rowNum, 26);
      }

      // เส้นขอบตารางสถิติ
      summarySheet.getRange(4, 2, statLabels.length + 1, 2).setBorder(true, true, true, true, true, true, "#CBD5E1", SpreadsheetApp.BorderStyle.SOLID);

      // สรุปผลแยกตามห้องเรียน (ถ้ามี Dropdown เลือกห้องเรียน)
      var roomChoices = [];
      if (data.headers && Array.isArray(data.headers)) {
        data.headers.forEach(function(h) {
          if (h.type === "dropdown" && h.choices && h.choices.length > 0) {
            roomChoices = h.choices;
          }
        });
      }

      if (roomChoices.length > 0) {
        summarySheet.getRange("E4:G4").merge()
          .setValue("🏫 สรุปผลแยกตามห้องเรียน")
          .setBackground("#0F9D58")
          .setFontColor("#FFFFFF")
          .setFontWeight("bold")
          .setFontSize(11)
          .setHorizontalAlignment("center")
          .setVerticalAlignment("middle");

        summarySheet.getRange("E5").setValue("ห้องเรียน").setBackground("#E6F4EA").setFontWeight("bold").setHorizontalAlignment("center");
        summarySheet.getRange("F5").setValue("ส่งแล้ว (คน)").setBackground("#E6F4EA").setFontWeight("bold").setHorizontalAlignment("center");
        summarySheet.getRange("G5").setValue("สถานะ").setBackground("#E6F4EA").setFontWeight("bold").setHorizontalAlignment("center");

        for (var rm = 0; rm < roomChoices.length; rm++) {
          var rmRowNum = 6 + rm;
          var rmName = roomChoices[rm];
          summarySheet.getRange(rmRowNum, 5).setValue(rmName).setBackground(rm % 2 === 0 ? "#F8FAFC" : "#FFFFFF").setHorizontalAlignment("center").setFontWeight("bold");
          summarySheet.getRange(rmRowNum, 6).setFormula("=COUNTIF('ผลการสอบรายบุคคล'!A:Z, \"" + rmName + "\") & \" คน\"").setBackground(rm % 2 === 0 ? "#F8FAFC" : "#FFFFFF").setHorizontalAlignment("center");
          summarySheet.getRange(rmRowNum, 7).setFormula("=IF(COUNTIF('ผลการสอบรายบุคคล'!A:Z, \"" + rmName + "\")>0, \"✅ มีผู้ส่งแล้ว\", \"⏳ รอนักเรียน\")").setBackground(rm % 2 === 0 ? "#F8FAFC" : "#FFFFFF").setHorizontalAlignment("center");
          summarySheet.setRowHeight(rmRowNum, 26);
        }
        summarySheet.getRange(4, 5, roomChoices.length + 2, 3).setBorder(true, true, true, true, true, true, "#CBD5E1", SpreadsheetApp.BorderStyle.SOLID);
      }

      // กำหนดความกว้างคอลัมน์
      summarySheet.setColumnWidth(1, 20);
      summarySheet.setColumnWidth(2, 250);
      summarySheet.setColumnWidth(3, 150);
      summarySheet.setColumnWidth(4, 25);
      summarySheet.setColumnWidth(5, 120);
      summarySheet.setColumnWidth(6, 120);
      summarySheet.setColumnWidth(7, 160);

      // ให้แท็บแดชบอร์ดสรุปคะแนนแสดงเป็นหน้าแรก
      ss.setActiveSheet(summarySheet);
      ss.moveActiveSheet(1);

      sheetUrl = ss.getUrl();

      // โอนสิทธิ์ / แชร์ชีตผลลัพธ์เข้า Google Drive ของคุณครู
      if (data.teacherEmail) {
        try {
          var sheetFile = DriveApp.getFileById(ss.getId());
          sheetFile.addEditor(data.teacherEmail);
          try {
            sheetFile.setOwner(data.teacherEmail);
          } catch (e) {
            Logger.log("Sheet owner transfer note: " + e.message);
          }
        } catch (e) {
          Logger.log("Sheet share error: " + e.message);
        }
      }
    } catch (sheetErr) {
      Logger.log("Sheet creation error: " + sheetErr.toString());
    }

    // 5. โอนสิทธิ์ / แชร์ฟอร์มเข้า Google Drive ของคุณครูโดยอัตโนมัติ
    try {
      var formFile = DriveApp.getFileById(formId);
      try {
        formFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log("Form setSharing note: " + shareErr.message);
      }

      if (data.teacherEmail) {
        formFile.addEditor(data.teacherEmail);
        try {
          formFile.setOwner(data.teacherEmail);
        } catch (ownerErr) {
          Logger.log("Form owner transfer note: " + ownerErr.message);
        }
      }
    } catch (driveErr) {
      Logger.log("Form share error: " + driveErr.message);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      editUrl: editUrl,
      viewUrl: publishedUrl,
      sheetUrl: sheetUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ค้นหา summarySheet (แดชบอร์ดสรุป) และ responseSheet (แท็บผลการสอบจริง) อย่างแม่นยำ
 * รองรับกรณี Google Sheets มีหลายแท็บ, มีแท็บการตอบกลับเก่าที่ว่างเปล่า, หรือชื่อแท็บสรุปมีคำว่า "ผลการสอบ"
 */
function findSheets(ss) {
  var sheets = ss.getSheets();
  var summarySheet = null;
  var responseSheet = null;

  // 1. ระบุ summarySheet ก่อน โดยดูจากคำว่า "สรุป", "summary", "dashboard"
  // และต้องไม่เป็นชื่อการตอบกลับแบบฟอร์ม
  for (var s = 0; s < sheets.length; s++) {
    var sName = sheets[s].getName().toLowerCase().trim();
    if (sName.indexOf("สรุป") !== -1 || sName.indexOf("summary") !== -1 || sName.indexOf("dashboard") !== -1) {
      if (sName.indexOf("การตอบกลับ") === -1 && sName.indexOf("form responses") === -1 && sName.indexOf("responses") === -1) {
        summarySheet = sheets[s];
        break;
      }
    }
  }

  // 2. ให้คะแนน (Scoring System) สำหรับทุกชีตที่ไม่ใช่ summarySheet เพื่อหาชีตผลการสอบจริง (responseSheet)
  var bestSheet = null;
  var bestScore = -1;

  for (var s = 0; s < sheets.length; s++) {
    var curSheet = sheets[s];
    if (summarySheet && curSheet.getSheetId() === summarySheet.getSheetId()) continue;

    var sName = curSheet.getName().toLowerCase().trim();
    var lastRow = curSheet.getLastRow();
    var lastCol = curSheet.getLastColumn();
    var score = 0;

    // ตรวจสอบชื่อชีต
    if (sName.indexOf("การตอบกลับ") !== -1 || sName.indexOf("การตอบแบบฟอร์ม") !== -1 || sName.indexOf("ตอบกลับ") !== -1 ||
        sName.indexOf("form response") !== -1 || sName.indexOf("responses") !== -1 || sName.indexOf("response") !== -1 ||
        sName.indexOf("คำตอบ") !== -1 || sName.indexOf("รายชื่อ") !== -1) {
      score += 50;
    }

    // ตรวจสอบจำนวนแถว (ชีตที่มีนักเรียนส่งคำตอบจริง ต้องมี lastRow > 1)
    if (lastRow > 1) {
      score += 30;
      // ให้คะแนนเพิ่มตามจำนวนนักเรียน (สูงสุด +100 คะแนน) เพื่อให้ชีตที่มีนักเรียนจริงชนะชีตทดสอบที่มี 1-2 แถว
      score += Math.min(lastRow, 100);
    }

    // ตรวจสอบหัวคอลัมน์แถวที่ 1
    if (lastCol >= 2 && lastRow >= 1) {
      try {
        var headerValues = curSheet.getRange(1, 1, 1, Math.min(lastCol, 10)).getValues()[0];
        var headerStr = headerValues.join(" ").toLowerCase();

        if (headerStr.indexOf("ประทับเวลา") !== -1 || headerStr.indexOf("timestamp") !== -1 || headerStr.indexOf("time") !== -1) {
          score += 40;
        }
        if (headerStr.indexOf("คะแนน") !== -1 || headerStr.indexOf("score") !== -1 || headerStr.indexOf("points") !== -1) {
          score += 40;
        }
        if (headerStr.indexOf("ชื่อ") !== -1 || headerStr.indexOf("name") !== -1) {
          score += 20;
        }
        if (headerStr.indexOf("ชั้น") !== -1 || headerStr.indexOf("ห้อง") !== -1 || headerStr.indexOf("เลขที่") !== -1) {
          score += 20;
        }
      } catch (hErr) {}
    }

    if (score > bestScore) {
      bestScore = score;
      bestSheet = curSheet;
    }
  }

  responseSheet = bestSheet;

  // Fallback กรณีคะแนนยังไม่พบ หรือมีชีตเดียว
  if (!responseSheet) {
    for (var s = 0; s < sheets.length; s++) {
      if (summarySheet && sheets[s].getSheetId() === summarySheet.getSheetId()) continue;
      responseSheet = sheets[s];
      break;
    }
  }

  if (!responseSheet) responseSheet = sheets[0];
  if (summarySheet && summarySheet.getSheetId() === responseSheet.getSheetId()) {
    summarySheet = null;
  }

  return { summarySheet: summarySheet, responseSheet: responseSheet };
}

/**
 * ฟังก์ชันกลางสำหรับดึงข้อมูลสรุปผลคะแนนและรายชื่อนักเรียน
 */
function handleGetSummary(sheetUrlOrId) {
  try {
    var sheetId = sheetUrlOrId;
    if (sheetId && typeof sheetId === "string" && sheetId.indexOf("http") !== -1) {
      var match = sheetId.match(/[-\w]{25,}/);
      if (match) sheetId = match[0];
    }

    if (!sheetId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing sheetId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.openById(sheetId);
    var found = findSheets(ss);
    var summarySheet = found.summarySheet;
    var responseSheet = found.responseSheet;

    var allSheetsInfo = ss.getSheets().map(function(s) {
      return {
        name: s.getName(),
        rows: s.getLastRow(),
        cols: s.getLastColumn()
      };
    });

    // 1. อ่านข้อมูลคำตอบนักเรียนทั้งหมดจากแท็บคะแนนดิบ
    var students = [];
    var columnHeaders = [];
    var scoreColIndex = -1;
    var scoreColHeader = "";

    if (responseSheet) {
      var lastRow = responseSheet.getLastRow();
      var lastCol = responseSheet.getLastColumn();
      if (lastRow >= 1 && lastCol >= 1) {
        var rawHeaders = responseSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var seenHeaders = {};
        for (var h = 0; h < rawHeaders.length; h++) {
          var hName = rawHeaders[h].toString().trim();
          if (!hName) hName = "คอลัมน์ " + (h + 1);
          if (seenHeaders[hName]) {
            seenHeaders[hName]++;
            hName = hName + " (" + seenHeaders[hName] + ")";
          } else {
            seenHeaders[hName] = 1;
          }
          columnHeaders.push(hName);

          var hClean = hName.toLowerCase();
          if (scoreColIndex === -1 && (hClean === "คะแนน" || hClean === "score" || hClean === "total score" || hClean === "คะแนนรวม" || hClean === "points" || hClean === "คะแนนที่ได้" || (hClean.indexOf("คะแนน") === 0 && hClean.length <= 25))) {
            scoreColIndex = h;
            scoreColHeader = hName;
          }
        }

        if (lastRow > 1) {
          var dataRows = responseSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
          for (var i = 0; i < dataRows.length; i++) {
            var item = {};
            item["_rowIndex"] = i + 2; // ตำแหน่งแถวจริงใน Google Sheet สำหรับอัปเดตคะแนน
            var hasAnyContent = false;
            var hasStudentData = false;

            for (var c = 0; c < columnHeaders.length; c++) {
              var val = dataRows[i][c];
              if (val instanceof Date) {
                val = Utilities.formatDate(val, Session.getScriptTimeZone() || "Asia/Bangkok", "yyyy-MM-dd HH:mm:ss");
              }
              var strVal = (val !== null && val !== undefined) ? val.toString().trim() : "";
              item[columnHeaders[c]] = (val !== null && val !== undefined) ? val : "";
              if (strVal !== "") {
                hasAnyContent = true;
                var colKeyClean = columnHeaders[c].toLowerCase();
                if (colKeyClean.indexOf("ชื่อ") !== -1 || colKeyClean.indexOf("name") !== -1 ||
                    colKeyClean.indexOf("คะแนน") !== -1 || colKeyClean.indexOf("score") !== -1 ||
                    colKeyClean.indexOf("ประทับเวลา") !== -1 || colKeyClean.indexOf("timestamp") !== -1 ||
                    colKeyClean.indexOf("เลขที่") !== -1 || colKeyClean.indexOf("ชั้น") !== -1 ||
                    colKeyClean.indexOf("ห้อง") !== -1) {
                  hasStudentData = true;
                }
              }
            }

            // กรองแถวว่างทิ้ง (ต้องมีข้อมูลนักเรียนจริงอย่างน้อย 1 รายการ)
            if (hasAnyContent && hasStudentData) {
              students.push(item);
            }
          }
        }
      }
    }

    // 2. คำนวณสถิติจากคะแนนนักเรียนจริงโดยตรง (ไม่พึ่งพาสูตรในชีต เพื่อความแม่นยำ 100%)
    var studentScores = [];
    var totalMaxPoints = 0;
    var maxEarnedScore = 0;
    var roomCounts = {};

    // ก) ตรวจสอบจากหัวคอลัมน์คะแนน เช่น "คะแนน / 30", "คะแนน (เต็ม 40)"
    if (scoreColHeader) {
      var headerMatch = scoreColHeader.match(/(?:\/|เต็ม|out of|\()\s*(\d+(?:\.\d+)?)/i);
      if (headerMatch && parseFloat(headerMatch[1]) > 0) {
        totalMaxPoints = parseFloat(headerMatch[1]);
      }
    }

    for (var i = 0; i < students.length; i++) {
      var scoreVal = null;
      for (var key in students[i]) {
        var kClean = key.toLowerCase().trim();
        if (kClean === "คะแนน" || kClean === "score" || kClean === "total score" || kClean === "คะแนนรวม" || kClean === "points" || kClean === "คะแนนที่ได้" || (kClean.indexOf("คะแนน") === 0 && kClean.length <= 25)) {
          scoreVal = students[i][key];
          break;
        }
      }

      if (scoreVal !== null && scoreVal !== undefined && scoreVal !== "") {
        var parts = scoreVal.toString().split("/");
        var num = parseFloat(parts[0]);
        if (!isNaN(num)) {
          studentScores.push(num);
          if (num > maxEarnedScore) maxEarnedScore = num;
          if (parts.length > 1) {
            var denom = parseFloat(parts[1]);
            if (!isNaN(denom) && denom > 0 && denom > totalMaxPoints) {
              totalMaxPoints = denom;
            }
          }
        }
      }

      var rName = "";
      for (var key in students[i]) {
        var kClean = key.toLowerCase().trim();
        if (kClean === "ชั้น" || kClean === "ห้องเรียน" || kClean === "ห้อง" || kClean === "ระดับชั้น" || kClean === "class" || kClean === "room") {
          rName = students[i][key];
          break;
        }
      }
      if (rName) {
        var rTrim = rName.toString().trim();
        roomCounts[rTrim] = (roomCounts[rTrim] || 0) + 1;
      }
    }

    // นับจำนวนคำถามข้อสอบจริง (ตัดคอลัมน์ระบบและข้อมูลส่วนตัวออก)
    var qItemCount = 0;
    for (var h = 0; h < columnHeaders.length; h++) {
      var hc = columnHeaders[h].toLowerCase().trim();
      if (hc === "_rowindex" || hc.indexOf("ประทับเวลา") !== -1 || hc.indexOf("timestamp") !== -1 ||
          hc.indexOf("คะแนน") !== -1 || hc.indexOf("score") !== -1 || hc === "points" ||
          hc.indexOf("ชื่อ") !== -1 || hc.indexOf("ชั้น") !== -1 || hc.indexOf("ห้อง") !== -1 ||
          hc.indexOf("เลขที่") !== -1 || hc.indexOf("รหัส") !== -1 || hc.indexOf("อีเมล") !== -1 ||
          hc.indexOf("คำนำหน้า") !== -1) {
        continue;
      }
      qItemCount++;
    }

    // ข) ตรวจสอบจาก Metadata ใน summarySheet
    var hasManualGrading = false;
    var manualQuestions = [];
    if (summarySheet) {
      try {
        var zVals = summarySheet.getRange("Z3:Z5").getValues();
        var z3Val = zVals[0][0];
        if (z3Val === "HAS_MANUAL_GRADING") {
          hasManualGrading = true;
          var z4Val = zVals[1][0];
          if (z4Val) {
            try { manualQuestions = JSON.parse(z4Val); } catch (e) {}
          }
        }
        var z5Val = zVals[2][0];
        var metaMax = 0;
        if (typeof z5Val === "number" && z5Val > 0) {
          metaMax = z5Val;
        } else if (z5Val) {
          var parsedZ5 = parseFloat(z5Val);
          if (!isNaN(parsedZ5) && parsedZ5 > 0) metaMax = parsedZ5;
        }
        if (totalMaxPoints <= 0 && metaMax >= maxEarnedScore) {
          totalMaxPoints = metaMax;
        }
      } catch (zErr) {
        Logger.log("Read metadata error: " + zErr.message);
      }

      // ถ้ายังเป็น 0 ให้ลองอ่านจาก C6 (แถวคะแนนเต็มในตารางสรุป)
      if (totalMaxPoints <= 0) {
        try {
          var c6Val = summarySheet.getRange("C6").getValue();
          if (c6Val) {
            var c6Match = c6Val.toString().match(/\d+(\.\d+)?/);
            if (c6Match) {
              var c6Num = parseFloat(c6Match[0]);
              if (c6Num > 0 && c6Num >= maxEarnedScore) {
                totalMaxPoints = c6Num;
              }
            }
          }
        } catch (c6Err) {}
      }
    }

    // ค) ถ้ายังไม่ทราบ หรือค่า totalMaxPoints น้อยกว่าจำนวนข้อสอบจริง ให้ใช้ qItemCount
    if (qItemCount > 0) {
      if (totalMaxPoints <= 0 || (totalMaxPoints < qItemCount && maxEarnedScore <= qItemCount)) {
        totalMaxPoints = qItemCount;
      }
    }

    // ง) กฎเหล็กป้องกันข้อผิดพลาด: คะแนนเต็มต้องไม่น้อยกว่าคะแนนสูงสุดที่นักเรียนทำได้เด็ดขาด!
    if (maxEarnedScore > totalMaxPoints) {
      totalMaxPoints = Math.max(maxEarnedScore, qItemCount);
    }

    if (totalMaxPoints <= 0) {
      totalMaxPoints = 20;
    }

    var totalStudentsCount = students.length;
    var validScoreCount = studentScores.length;
    var avgScore = validScoreCount > 0 ? (studentScores.reduce(function(a, b) { return a + b; }, 0) / validScoreCount).toFixed(2) : "-";
    var maxS = validScoreCount > 0 ? Math.max.apply(null, studentScores) : "-";
    var minS = validScoreCount > 0 ? Math.min.apply(null, studentScores) : "-";

    var roomsList = [];
    if (summarySheet) {
      try {
        var roomData = summarySheet.getRange("E6:G20").getValues();
        for (var r = 0; r < roomData.length; r++) {
          if (roomData[r][0]) {
            var rm = roomData[r][0].toString().trim();
            var count = roomCounts[rm] || 0;
            roomsList.push({
              room: rm,
              count: count + " คน",
              status: count > 0 ? "✅ มีผู้ส่งแล้ว" : "⏳ รอนักเรียน"
            });
          }
        }
      } catch (rmErr) {}
    }

    // ถ้าไม่มีห้องใน summary ให้สร้างจากห้องที่มีนักเรียนตอบ
    if (roomsList.length === 0) {
      for (var rmKey in roomCounts) {
        roomsList.push({
          room: rmKey,
          count: roomCounts[rmKey] + " คน",
          status: "✅ มีผู้ส่งแล้ว"
        });
      }
    }

    var passThreshold = Math.ceil(totalMaxPoints * 0.5);
    var passCountNum = studentScores.filter(function(s) { return s >= passThreshold; }).length;
    var failCountNum = validScoreCount - passCountNum;
    var passRatePct = validScoreCount > 0 ? ((passCountNum / validScoreCount) * 100).toFixed(1) + "%" : "0%";

    var sheetTitle = "";
    if (summarySheet) {
      try {
        var a1 = summarySheet.getRange("A1").getValue();
        if (a1) sheetTitle = a1.toString().replace("📊 สรุปภาพรวมผลการสอบ: ", "").trim();
      } catch (tErr) {}
    }
    if (!sheetTitle && responseSheet) {
      sheetTitle = ss.getName().replace("ผลการสอบ - ", "").trim();
    }

    var stats = {
      title: sheetTitle,
      totalStudents: totalStudentsCount + " คน",
      totalScore: totalMaxPoints + " คะแนน",
      average: avgScore !== "-" ? avgScore + " คะแนน" : "-",
      maxScore: maxS !== "-" ? maxS + " คะแนน" : "-",
      minScore: minS !== "-" ? minS + " คะแนน" : "-",
      passCount: passCountNum + " คน",
      failCount: failCountNum + " คน",
      passRate: passRatePct,
      rooms: roomsList
    };

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      sheetId: sheetId,
      hasManualGrading: hasManualGrading,
      manualQuestions: manualQuestions,
      totalMaxPoints: totalMaxPoints,
      columnHeaders: columnHeaders,
      stats: stats,
      students: students,
      selectedSummarySheet: summarySheet ? summarySheet.getName() : null,
      selectedResponseSheet: responseSheet ? responseSheet.getName() : null,
      sheetsInfo: allSheetsInfo
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันบันทึก/แก้ไขคะแนนนักเรียนรายบุคคลจากเว็บแอป FormAuto โดยตรง
 */
function handleUpdateScore(data) {
  try {
    var sheetId = data.sheetUrl || data.sheetId;
    if (sheetId && typeof sheetId === "string" && sheetId.indexOf("http") !== -1) {
      var match = sheetId.match(/[-\w]{25,}/);
      if (match) sheetId = match[0];
    }

    if (!sheetId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing sheetId" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.openById(sheetId);
    var found = findSheets(ss);
    var responseSheet = found.responseSheet;

    if (!responseSheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "ไม่พบแท็บชีตคำตอบนักเรียน" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var rowIndex = parseInt(data.rowIndex, 10);
    if (!rowIndex || rowIndex < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid rowIndex: " + data.rowIndex }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var lastCol = responseSheet.getLastColumn();
    var headerVals = responseSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var scoreCol = -1;
    for (var c = 0; c < headerVals.length; c++) {
      var colName = headerVals[c].toString().trim().toLowerCase();
      if (colName === "คะแนน" || colName === "score" || colName === "total score" || colName === "คะแนนรวม" || colName === "points" || colName.indexOf("คะแนน") !== -1 || colName.indexOf("score") !== -1) {
        scoreCol = c + 1;
        break;
      }
    }
    if (scoreCol === -1) scoreCol = 2; // ดีฟอลต์คอลัมน์ B คือคอลัมน์คะแนนของ Google Forms

    var newScoreStr = data.newScore.toString().trim();
    if (newScoreStr.indexOf("/") === -1 && data.totalMax) {
      newScoreStr = newScoreStr + " / " + data.totalMax;
    }

    responseSheet.getRange(rowIndex, scoreCol).setValue(newScoreStr);
    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      rowIndex: rowIndex,
      newScore: newScoreStr
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชัน doGet สำหรับดึงข้อมูลสรุปผลคะแนนและรายชื่อนักเรียนกลับมาแสดงใน Web App FormAuto
 */
function doGet(e) {
  try {
    if (!e || !e.parameter || (!e.parameter.sheetUrl && !e.parameter.sheetId)) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "FormAuto GAS API Ready" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return handleGetSummary(e.parameter.sheetId || e.parameter.sheetUrl);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ฟังก์ชันสำหรับกดยอมรับสิทธิ์ (Authorize) ใน Google Apps Script
 */
function setupPermissions() {
  var ss = SpreadsheetApp.create("ทดสอบสิทธิ์ FormAuto");
  Logger.log("ชีตถูกสร้างเรียบร้อย ID: " + ss.getId());
  DriveApp.getFileById(ss.getId()).setTrashed(true);
  Logger.log("ให้สิทธิ์เข้าถึง Google Sheets & Google Drive สมบูรณ์แล้ว!");
}
