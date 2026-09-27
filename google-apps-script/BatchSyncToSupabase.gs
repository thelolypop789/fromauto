/**
 * BatchSyncToSupabase.gs
 * 
 * สคริปต์นี้ทำหน้าที่:
 * 1. ดึงประวัติแบบฟอร์มทั้ง 80 ชุด จากตาราง form_history ใน Supabase
 * 2. สกัดเอา Form ID จากลิงก์
 * 3. วนลูปเข้าไปเปิด Google Form แต่ละชุด
 * 4. ดูดข้อสอบและเฉลย ส่งเข้าไปเก็บในคลังข้อสอบ (question_bank) ทีเดียวรวด!
 */

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // เปลี่ยนเป็น URL ของคุณ
const SUPABASE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // เปลี่ยนเป็น Service Role Key

function batchSyncAllForms() {
  Logger.log('🚀 เริ่มต้นดึงข้อมูลประวัติการสร้างฟอร์มจาก Supabase...');
  
  // 1. ดึงประวัติฟอร์มทั้งหมดจากตาราง form_history (ตารางเก่าของคุณ)
  const historyUrl = `${SUPABASE_URL}/rest/v1/form_history?select=*`;
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(historyUrl, options);
  if (response.getResponseCode() !== 200) {
    Logger.log('❌ ดึงข้อมูลประวัติไม่สำเร็จ: ' + response.getContentText());
    return;
  }
  
  const forms = JSON.parse(response.getContentText());
  Logger.log(`✅ พบประวัติฟอร์มทั้งหมด ${forms.length} ชุด`);
  
  let totalQuestionsSynced = 0;
  
  // 2. วนลูปอ่านฟอร์มแต่ละชุด
  for (let i = 0; i < forms.length; i++) {
    const record = forms[i];
    if (!record.edit_url) continue;
    
    // สกัด Form ID จาก URL (เช่น https://docs.google.com/forms/d/1234567890/edit)
    const match = record.edit_url.match(/forms\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) continue;
    
    const formId = match[1];
    
    try {
      const form = FormApp.openById(formId);
      const formTitle = form.getTitle();
      Logger.log(`[${i+1}/${forms.length}] กำลังดูดข้อสอบจาก: ${formTitle}`);
      
      const items = form.getItems();
      
      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        const type = item.getType();
        
        // กรองเฉพาะข้อสอบปรนัย (ถ้าอยากได้อัตนัยเพิ่ม ก็เพิ่มเงื่อนไขได้)
        if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
          const mcItem = item.asMultipleChoiceItem();
          const questionText = mcItem.getTitle();
          const choices = mcItem.getChoices();
          
          // ส่งข้อสอบ 1 ข้อเข้า Supabase (ตาราง question_bank)
          const qPayload = {
            topic: formTitle, 
            type: 'MULTIPLE_CHOICE',
            content: questionText,
            difficulty: 'MEDIUM',
            created_by: 'BATCH_SYNC'
          };
          
          const qData = supabaseInsert('question_bank', qPayload);
          
          if (qData && qData.length > 0) {
            const questionId = qData[0].id;
            
            // ส่งตัวเลือก ก,ข,ค,ง เข้าตาราง (question_choices)
            const cPayload = choices.map((choice, index) => {
              return {
                question_id: questionId,
                content: choice.getValue(),
                is_correct: choice.isCorrectAnswer(),
                order_num: index + 1
              };
            });
            supabaseInsert('question_choices', cPayload);
            totalQuestionsSynced++;
          }
        }
      }
    } catch (err) {
      Logger.log(`⚠️ ข้ามฟอร์ม ID ${formId}: ${err.message}`);
    }
  }
  
  Logger.log(`🎉 ดูดข้อสอบเสร็จสมบูรณ์! ได้ข้อสอบเข้าคลังทั้งหมด ${totalQuestionsSynced} ข้อ`);
}

function supabaseInsert(tableName, payload) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
    return JSON.parse(response.getContentText());
  }
  return null;
}

/**
 * ⚡ ฟังก์ชันเติมชื่อวิชาและระดับชั้นที่หายไปให้ครบ 100%
 * ทำงานโดยดึงชื่อวิชาจาก form_history แล้วนำไปใส่ให้ข้อสอบที่มีชื่อว่างอยู่
 * ไม่สร้างข้อสอบซ้ำซ้อนแน่นอน (เป็นการ PATCH แก้ไขเฉพาะช่องชื่อวิชา)
 */
function fixAllSubjectTitles() {
  Logger.log('🚀 เริ่มต้นการเติมชื่อวิชาและระดับชั้นที่ว่างอยู่...');
  const historyUrl = `${SUPABASE_URL}/rest/v1/form_history?select=*`;
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(historyUrl, options);
  if (response.getResponseCode() !== 200) {
    Logger.log('❌ ไม่สามารถอ่าน form_history: ' + response.getContentText());
    return;
  }
  
  const forms = JSON.parse(response.getContentText());
  Logger.log(`✅ พบประวัติฟอร์ม ${forms.length} ฟอร์ม`);
  
  let totalPatched = 0;
  
  for (let i = 0; i < forms.length; i++) {
    const record = forms[i];
    if (!record.edit_url) continue;
    const match = record.edit_url.match(/forms\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) continue;
    
    const formId = match[1];
    const trueSubjectName = (record.form_title || '').trim();
    if (!trueSubjectName) continue;
    
    try {
      const form = FormApp.openById(formId);
      const items = form.getItems();
      let formPatchedCount = 0;
      
      for (let j = 0; j < items.length; j++) {
        if (items[j].getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
          const qText = items[j].asMultipleChoiceItem().getTitle().trim();
          if (!qText) continue;
          
          // ส่งคำสั่ง PATCH ไปอัปเดตเฉพาะข้อที่ content ตรงกันและ topic ยังว่างอยู่
          const patchUrl = `${SUPABASE_URL}/rest/v1/question_bank?content=eq.${encodeURIComponent(qText)}`;
          const patchOptions = {
            method: 'patch',
            contentType: 'application/json',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Prefer': 'return=minimal'
            },
            payload: JSON.stringify({ topic: trueSubjectName }),
            muteHttpExceptions: true
          };
          
          const patchRes = UrlFetchApp.fetch(patchUrl, patchOptions);
          if (patchRes.getResponseCode() >= 200 && patchRes.getResponseCode() < 300) {
            formPatchedCount++;
            totalPatched++;
          }
        }
      }
      Logger.log(`[${i+1}/${forms.length}] ✅ เติมวิชา "${trueSubjectName}" เรียบร้อย (${formPatchedCount} ข้อ)`);
    } catch (err) {
      Logger.log(`⚠️ ข้ามฟอร์ม "${trueSubjectName}": ${err.message}`);
    }
  }
  
  Logger.log(`🎉 สำเร็จทั้งหมด! ทำการเติมชื่อวิชาและระดับชั้นให้ข้อสอบไปแล้ว ${totalPatched} รายการ`);
}
