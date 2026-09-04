/**
 * Google Apps Script สำหรับ FormAuto
 * ทำหน้าที่สร้าง Google Form อัตโนมัติ พร้อมตั้งค่าเป็นแบบทดสอบ (Quiz) มีเฉลย
 * รองรับส่วนหัวแบบ Dropdown (เช่น เมนูเลือกห้องเรียน)
 * และสร้าง Google Sheet ซิงค์คำตอบ/คะแนนอัตโนมัติ พร้อมโอนสิทธิ์ให้คุณครู
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var form = FormApp.create(data.title || "แบบทดสอบออนไลน์");

    // 1. ตั้งค่าให้เป็นแบบทดสอบ (Quiz) และใส่คำอธิบาย
    form.setIsQuiz(true);
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

    // 4. สร้าง Google Sheet สำหรับซิงค์คะแนนและคำตอบแบบ Real-time
    var sheetUrl = "";
    try {
      var sheetTitle = "ผลการสอบ - " + (data.title || "แบบทดสอบออนไลน์");
      var ss = SpreadsheetApp.create(sheetTitle);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
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
    if (data.teacherEmail) {
      try {
        var formFile = DriveApp.getFileById(formId);
        formFile.addEditor(data.teacherEmail);
        try {
          formFile.setOwner(data.teacherEmail);
        } catch (ownerErr) {
          Logger.log("Form owner transfer note: " + ownerErr.message);
        }
      } catch (driveErr) {
        Logger.log("Form share error: " + driveErr.message);
      }
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
 * วิธีใช้:
 * 1. ในหน้า script.google.com เลือกฟังก์ชัน "setupPermissions" จากเมนูด้านบนข้างปุ่ม "เรียกใช้ (Run)"
 * 2. กดปุ่ม "เรียกใช้ (Run)"
 * 3. กด "ตรวจสอบสิทธิ์" -> เลือกเมล -> ขั้นสูง -> ไปที่... -> กดยอมรับ (Allow)
 */
function setupPermissions() {
  var ss = SpreadsheetApp.create("ทดสอบสิทธิ์ FormAuto");
  Logger.log("ชีตถูกสร้างเรียบร้อย ID: " + ss.getId());
  DriveApp.getFileById(ss.getId()).setTrashed(true);
  Logger.log("ให้สิทธิ์เข้าถึง Google Sheets & Google Drive สมบูรณ์แล้ว!");
}

