/**
 * SyncToSupabase.gs
 * 
 * Script for extracting questions and choices from an active Google Form 
 * and sending them to the Supabase REST API to populate the 'question_bank'
 * and 'question_choices' tables.
 */

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; // Replace with your URL
const SUPABASE_KEY = 'YOUR_SERVICE_ROLE_KEY'; // Replace with your Service Role Key (not anon key)

/**
 * Main function to sync the currently open Google Form.
 * Run this from the Google Apps Script editor attached to a Form.
 */
function syncCurrentFormToSupabase() {
  const form = FormApp.getActiveForm();
  
  // If not running inside a form, use openById for testing:
  // const form = FormApp.openById('YOUR_FORM_ID');
  
  const formTitle = form.getTitle();
  Logger.log('Starting sync for form: ' + formTitle);
  
  // 1. Create/Find a Subject (Optional step, for this example we'll assume a dummy Subject ID or skip)
  // In a real app, you might map the form title to a subject in your DB.
  const dummySubjectId = null; // We'll insert NULL or a known UUID if you have one.
  
  const items = form.getItems();
  let syncedCount = 0;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const type = item.getType();
    
    // We only process Multiple Choice questions for this example
    if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
      const mcItem = item.asMultipleChoiceItem();
      const questionText = mcItem.getTitle();
      const choices = mcItem.getChoices();
      const points = mcItem.getPoints() || 1;
      
      // 1. Insert into question_bank
      const questionPayload = {
        topic: formTitle, // Use form title as topic for now
        type: 'MULTIPLE_CHOICE',
        content: questionText,
        difficulty: 'MEDIUM',
        created_by: Session.getActiveUser().getEmail()
      };
      
      const questionData = supabaseInsert('question_bank', questionPayload);
      
      if (questionData && questionData.length > 0) {
        const questionId = questionData[0].id;
        
        // 2. Insert choices into question_choices
        const choicesPayload = choices.map((choice, index) => {
          return {
            question_id: questionId,
            content: choice.getValue(),
            is_correct: choice.isCorrectAnswer(),
            order_num: index + 1
          };
        });
        
        supabaseInsert('question_choices', choicesPayload);
        syncedCount++;
      }
    }
    // Add logic for TEXT, PARAGRAPH, etc. if needed
  }
  
  Logger.log(`✅ Successfully synced ${syncedCount} questions to Supabase!`);
}

/**
 * Helper function to perform a POST request to Supabase REST API
 * @param {string} tableName - The name of the table to insert into
 * @param {Object|Array} payload - The data to insert (single object or array of objects)
 * @returns {Array} - The inserted records
 */
function supabaseInsert(tableName, payload) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}`;
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=representation' // This makes Supabase return the inserted rows (so we get the IDs)
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  
  if (responseCode >= 200 && responseCode < 300) {
    return JSON.parse(responseBody);
  } else {
    Logger.log(`❌ Error inserting into ${tableName}: ${responseBody}`);
    return null;
  }
}
