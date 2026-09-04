/**
 * Google Apps Script สำหรับ FormAuto
 * ทำหน้าที่สร้าง Google Form อัตโนมัติ พร้อมตั้งค่าเป็นแบบทดสอบ (Quiz) มีเฉลย
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

    // 2. สร้างคำถามส่วนหัว (เช่น ชื่อ-สกุล, ชั้น, เลขที่)
    if (data.headers && Array.isArray(data.headers)) {
      data.headers.forEach(function(h) {
        var item = form.addTextItem();
        item.setTitle(h.label);
        item.setRequired(h.required !== false);
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
    var sheetTitle = "ผลการสอบ - " + (data.title || "แบบทดสอบออนไลน์");
    var ss = SpreadsheetApp.create(sheetTitle);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    var sheetUrl = ss.getUrl();

    // 5. โอนสิทธิ์ / แชร์ฟอร์มและชีตผลลัพธ์เข้า Google Drive ของคุณครูโดยอัตโนมัติ
    if (data.teacherEmail) {
      try {
        var formFile = DriveApp.getFileById(formId);
        var sheetFile = DriveApp.getFileById(ss.getId());

        // เพิ่มครูเป็น Editor
        formFile.addEditor(data.teacherEmail);
        sheetFile.addEditor(data.teacherEmail);

        // หากใช้อีเมลองค์กรเดียวกัน (@wangluangpitt.ac.th) โอนสิทธิ์เป็น Owner ให้ครูทันที
        try {
          formFile.setOwner(data.teacherEmail);
          sheetFile.setOwner(data.teacherEmail);
        } catch (ownerErr) {
          Logger.log("Note on ownership transfer: " + ownerErr.message);
        }
      } catch (driveErr) {
        Logger.log("Drive sharing error: " + driveErr.message);
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
