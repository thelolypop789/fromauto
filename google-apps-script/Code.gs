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
          manualQuestions.push(q.text || "ข้อสอบเติมคำ");
          var item = form.addTextItem();
          item.setTitle(q.text);
          item.setPoints(pts);
          item.setRequired(true);
          if (q.answerText) {
            item.setHelpText("แนวคำตอบ/เฉลย: " + q.answerText);
          }
        } else if (q.type === "paragraph" || q.type === "essay") {
          hasManualGrading = true;
          manualQuestions.push(q.text || "ข้อสอบอัตนัย");
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
    var sheets = ss.getSheets();
    var summarySheet = null;
    var responseSheet = null;
    for (var s = 0; s < sheets.length; s++) {
      var sName = sheets[s].getName();
      if (sName.indexOf("สรุป") !== -1) {
        summarySheet = sheets[s];
      } else {
        responseSheet = sheets[s];
      }
    }
    if (!summarySheet) summarySheet = sheets[0];
    if (!responseSheet) responseSheet = sheets.length > 1 ? sheets[1] : sheets[0];

    // 1. อ่านข้อมูลคำตอบนักเรียนทั้งหมดจากแท็บคะแนนดิบ
    var students = [];
    if (responseSheet) {
      var lastRow = responseSheet.getLastRow();
      var lastCol = responseSheet.getLastColumn();
      if (lastRow > 1 && lastCol >= 2) {
        var headerVals = responseSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var dataRows = responseSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        for (var i = 0; i < dataRows.length; i++) {
          var item = {};
          item["_rowIndex"] = i + 2; // ตำแหน่งแถวจริงใน Google Sheet สำหรับอัปเดตคะแนน
          for (var c = 0; c < headerVals.length; c++) {
            var colName = headerVals[c].toString().trim();
            item[colName] = dataRows[i][c];
          }
          students.push(item);
        }
      }
    }

    // 2. คำนวณสถิติจากคะแนนนักเรียนจริงโดยตรง (ไม่พึ่งพาสูตรในชีต เพื่อความแม่นยำ 100%)
    var studentScores = [];
    var totalMaxPoints = 20;
    var roomCounts = {};

    for (var i = 0; i < students.length; i++) {
      var scoreVal = students[i]["คะแนน"] || students[i]["Score"] || "";
      if (scoreVal) {
        var parts = scoreVal.toString().split("/");
        var num = parseFloat(parts[0]);
        if (!isNaN(num)) {
          studentScores.push(num);
          if (parts.length > 1) {
            var denom = parseFloat(parts[1]);
            if (!isNaN(denom) && denom > 0) totalMaxPoints = denom;
          }
        }
      }

      var rName = students[i]["ชั้น"] || students[i]["ห้องเรียน"] || students[i]["ห้อง"] || "";
      if (rName) {
        var rTrim = rName.toString().trim();
        roomCounts[rTrim] = (roomCounts[rTrim] || 0) + 1;
      }
    }

    var totalStudentsCount = studentScores.length;
    var avgScore = totalStudentsCount > 0 ? (studentScores.reduce(function(a, b) { return a + b; }, 0) / totalStudentsCount).toFixed(2) : "-";
    var maxS = totalStudentsCount > 0 ? Math.max.apply(null, studentScores) : "-";
    var minS = totalStudentsCount > 0 ? Math.min.apply(null, studentScores) : "-";
    var passThreshold = Math.ceil(totalMaxPoints * 0.5);
    var passCountNum = studentScores.filter(function(s) { return s >= passThreshold; }).length;
    var failCountNum = totalStudentsCount - passCountNum;
    var passRatePct = totalStudentsCount > 0 ? ((passCountNum / totalStudentsCount) * 100).toFixed(1) + "%" : "0%";

    var roomsList = [];
    if (summarySheet) {
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

    // ตรวจสอบข้อมูลข้อสอบอัตนัย/เติมคำและคะแนนเต็มรวมจาก Metadata
    var hasManualGrading = false;
    var manualQuestions = [];
    if (summarySheet) {
      try {
        var z3Val = summarySheet.getRange("Z3").getValue();
        if (z3Val === "HAS_MANUAL_GRADING") {
          hasManualGrading = true;
          var z4Val = summarySheet.getRange("Z4").getValue();
          if (z4Val) manualQuestions = JSON.parse(z4Val);
        }
        var z5Val = summarySheet.getRange("Z5").getValue();
        if (typeof z5Val === "number" && z5Val > 0) {
          totalMaxPoints = z5Val;
        } else if (z5Val) {
          var parsedZ5 = parseFloat(z5Val);
          if (!isNaN(parsedZ5) && parsedZ5 > 0) totalMaxPoints = parsedZ5;
        }
      } catch (zErr) {
        Logger.log("Read metadata error: " + zErr.message);
      }

      // ถ้ายังเป็นค่าเริ่มต้น 20 ให้ลองอ่านจาก C6 (แถวคะแนนเต็มในตารางสรุป)
      if (totalMaxPoints === 20 || !totalMaxPoints) {
        try {
          var c6Val = summarySheet.getRange("C6").getValue();
          if (c6Val) {
            var c6Match = c6Val.toString().match(/\d+(\.\d+)?/);
            if (c6Match && parseFloat(c6Match[0]) > 0) {
              totalMaxPoints = parseFloat(c6Match[0]);
            }
          }
        } catch (c6Err) {}
      }
    }

    var passThreshold = Math.ceil(totalMaxPoints * 0.5);
    var passCountNum = studentScores.filter(function(s) { return s >= passThreshold; }).length;
    var failCountNum = totalStudentsCount - passCountNum;
    var passRatePct = totalStudentsCount > 0 ? ((passCountNum / totalStudentsCount) * 100).toFixed(1) + "%" : "0%";

    var stats = {
      title: summarySheet ? summarySheet.getRange("A1").getValue().toString().replace("📊 สรุปภาพรวมผลการสอบ: ", "") : "",
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
      stats: stats,
      students: students
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
    var sheets = ss.getSheets();
    var responseSheet = null;
    for (var s = 0; s < sheets.length; s++) {
      if (sheets[s].getName().indexOf("สรุป") === -1) {
        responseSheet = sheets[s];
        break;
      }
    }
    if (!responseSheet) responseSheet = sheets.length > 1 ? sheets[1] : sheets[0];

    var rowIndex = parseInt(data.rowIndex, 10);
    if (!rowIndex || rowIndex < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid rowIndex: " + data.rowIndex }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var lastCol = responseSheet.getLastColumn();
    var headerVals = responseSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var scoreCol = -1;
    for (var c = 0; c < headerVals.length; c++) {
      var colName = headerVals[c].toString().trim();
      if (colName === "คะแนน" || colName.toLowerCase() === "score") {
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
    if (!e || !e.parameter) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "FormAuto GAS API Ready" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return handleGetSummary(e.parameter.sheetUrl || e.parameter.sheetId);
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
