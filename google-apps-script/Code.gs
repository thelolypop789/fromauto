/**
 * Google Apps Script สำหรับ FormAuto
 * ทำหน้าที่สร้าง Google Form อัตโนมัติ พร้อมตั้งค่าเป็นแบบทดสอบ (Quiz) มีเฉลย
 * รองรับส่วนหัวแบบ Dropdown (เช่น เมนูเลือกห้องเรียน)
 * และสร้าง Google Sheet ซิงค์คำตอบ/คะแนนอัตโนมัติ พร้อมแท็บแดชบอร์ดสรุปภาพรวมคะแนน
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
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

    // 3. สร้างข้อสอบแบบปรนัย (Multiple Choice) พร้อมเฉลยและคะแนน (1 คะแนน/ข้อ)
    if (data.questions && Array.isArray(data.questions)) {
      data.questions.forEach(function(q) {
        var item = form.addMultipleChoiceItem();
        item.setTitle(q.text);
        item.setPoints(1);
        item.setRequired(true);

        var choices = [];
        q.choices.forEach(function(choiceText, idx) {
          var isCorrect = (idx === q.answer);
          choices.push(item.createChoice(choiceText, isCorrect));
        });
        item.setChoices(choices);
      });
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
      var totalQ = (data.questions && data.questions.length) ? data.questions.length : 10;
      var passScore = Math.ceil(totalQ * 0.5);

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
      summarySheet.getRange("Z2").setFormula("=ARRAYFORMULA(IF('ผลการสอบรายบุคคล'!A2:A=\"\", \"\", IFERROR(VALUE(REGEXEXTRACT('ผลการสอบรายบุคคล'!B2:B&\"\", \"^[0-9]+\")), 0)))");
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
        ["👥 จำนวนนักเรียนที่ส่งข้อสอบ", "=COUNTA('ผลการสอบรายบุคคล'!A2:A) & \" คน\""],
        ["🎯 คะแนนเต็ม", totalQ + " คะแนน"],
        ["📈 คะแนนเฉลี่ย (Mean)", "=IF(COUNTA('ผลการสอบรายบุคคล'!A2:A)=0, \"-\", ROUND(AVERAGE(Z2:Z), 2) & \" คะแนน\")"],
        ["🏆 คะแนนสูงสุด (Max)", "=IF(COUNTA('ผลการสอบรายบุคคล'!A2:A)=0, \"-\", MAX(Z2:Z) & \" คะแนน\")"],
        ["📉 คะแนนต่ำสุด (Min)", "=IF(COUNTA('ผลการสอบรายบุคคล'!A2:A)=0, \"-\", MIN(Z2:Z) & \" คะแนน\")"],
        ["✅ สอบผ่าน (เกณฑ์ ≥ " + passScore + " คะแนน)", "=IF(COUNTA('ผลการสอบรายบุคคล'!A2:A)=0, \"-\", COUNTIF(Z2:Z, \">=\" & " + passScore + ") & \" คน\")"],
        ["❌ ไม่ผ่านเกณฑ์ (< " + passScore + " คะแนน)", "=IF(COUNTA('ผลการสอบรายบุคคล'!A2:A)=0, \"-\", (COUNTA('ผลการสอบรายบุคคล'!A2:A) - COUNTIF(Z2:Z, \">=\" & " + passScore + ")) & \" คน\")"],
        ["📊 อัตราการผ่านเกณฑ์", "=IF(COUNTA('ผลการสอบรายบุคคล'!A2:A)=0, \"-\", ROUND((COUNTIF(Z2:Z, \">=\" & " + passScore + ") / COUNTA('ผลการสอบรายบุคคล'!A2:A)) * 100, 1) & \"%\")"]
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
 * ฟังก์ชันสำหรับกดยอมรับสิทธิ์ (Authorize) ใน Google Apps Script
 */
function setupPermissions() {
  var ss = SpreadsheetApp.create("ทดสอบสิทธิ์ FormAuto");
  Logger.log("ชีตถูกสร้างเรียบร้อย ID: " + ss.getId());
  DriveApp.getFileById(ss.getId()).setTrashed(true);
  Logger.log("ให้สิทธิ์เข้าถึง Google Sheets & Google Drive สมบูรณ์แล้ว!");
}
