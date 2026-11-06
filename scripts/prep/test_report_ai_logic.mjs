// Unit tests for the safety guards of prep-report-ai (node scripts/prep/test_report_ai_logic.mjs, run from the repo root).
import ts from 'typescript';
import fs from 'fs';
const src=fs.readFileSync('supabase/functions/prep-report-ai/logic.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
fs.writeFileSync('/tmp/prep_report_ai_logic.mjs',js);
const L=await import('/tmp/prep_report_ai_logic.mjs');
const ctx={question:{id:1,topic:'B3-MATH',topic_name:'คณิต',level:'apply',stem:'2+2=?',choices:['3','4','5','6'],answer:1,explanation:'e',law_ref:null},reports:[{id:1,category:'wrong_answer',label:'เฉลยผิด',reason:'[เฉลยผิด] ควรเป็น 5'}]};
let n=0,bad=0; const t=(name,c)=>{n++; if(!c){bad++; console.log('FAIL',name)}};
const blind=a=>({answer:a,confident:true,ambiguous:false,working:'w'});
// ok verdict agrees with blind
let r=L.finalize(ctx,blind(1),{verdict:'ok',confidence:90,analysis:'a',user_message:'ขอบคุณ ถูกแล้ว'}); t('ok accepted',r.verdict==='ok'&&r.user_message==='ขอบคุณ ถูกแล้ว');
// ok verdict but blind disagrees -> human
r=L.finalize(ctx,blind(2),{verdict:'ok',confidence:95,analysis:'a',user_message:'x'}); t('ok vs blind mismatch -> human',r.verdict==='human'&&r.user_message===L.DEFAULT_MESSAGE.human);
// low confidence
r=L.finalize(ctx,blind(1),{verdict:'ok',confidence:60,analysis:'a',user_message:'x'}); t('low conf -> human',r.verdict==='human');
// fix with new key confirmed by blind
r=L.finalize(ctx,blind(2),{verdict:'fix',confidence:90,analysis:'a',user_message:'แก้แล้ว',fix:{answer:2}}); t('fix answer confirmed',r.verdict==='fix'&&r.fix.answer===2);
// fix not confirmed
r=L.finalize(ctx,blind(1),{verdict:'fix',confidence:90,analysis:'a',user_message:'แก้แล้ว',fix:{answer:2}}); t('fix not confirmed -> human',r.verdict==='human'&&r.fix===null);
// fix choices w/o answer
r=L.finalize(ctx,blind(1),{verdict:'fix',confidence:90,analysis:'a',user_message:'m',fix:{choices:['ก. 1','ข. 2','ค. 3','ง. 4']}}); t('choices without answer -> human',r.verdict==='human');
// fix choices with prefixes stripped, key confirmed by text
const ctx2={...ctx,question:{...ctx.question,choices:['3','4','5','6'],answer:0}};
r=L.finalize(ctx2,blind(1),{verdict:'fix',confidence:90,analysis:'a',user_message:'m',fix:{choices:['ก. 5','ข. 4','ค. 3','ง. 6'],answer:1}}); t('fix choices stripped & confirmed',r.verdict==='fix'&&r.fix.choices[0]==='5'&&r.fix.answer===1);
// duplicate choices
r=L.finalize(ctx,blind(1),{verdict:'fix',confidence:90,analysis:'a',user_message:'m',fix:{choices:['1','1','2','3'],answer:1}}); t('dup choices -> human',r.verdict==='human');
// answer out of range / string
r=L.finalize(ctx,blind(1),{verdict:'fix',confidence:90,analysis:'a',user_message:'m',fix:{answer:7}}); t('answer 7 -> human',r.verdict==='human');
r=L.finalize(ctx,blind(1),{verdict:'fix',confidence:90,analysis:'a',user_message:'m',fix:{answer:'1'}}); t('answer string -> human',r.verdict==='human');
// typo fix, key unchanged, blind agrees
r=L.finalize(ctx,blind(1),{verdict:'fix',confidence:85,analysis:'a',user_message:'m',fix:{stem:'สอง บวก สอง เท่ากับเท่าไร'}}); t('typo fix ok',r.verdict==='fix'&&r.fix.stem.startsWith('สอง'));
// hide
r=L.finalize(ctx,{answer:null,confident:false,ambiguous:true,working:''},{verdict:'hide',confidence:80,analysis:'a',user_message:''}); t('hide accepted w/ default msg',r.verdict==='hide'&&r.user_message===L.DEFAULT_MESSAGE.hide);
// bad verdict string
r=L.finalize(ctx,blind(1),{verdict:'delete_everything',confidence:99,analysis:'',user_message:''}); t('unknown verdict -> human',r.verdict==='human');
// blind ambiguous blocks ok
r=L.finalize(ctx,{answer:1,confident:false,ambiguous:true,working:''},{verdict:'ok',confidence:99,analysis:'a',user_message:'m'}); t('ambiguous blind blocks ok',r.verdict==='human');
// normalizeBlind / parseJson
t('parseJson fenced',L.parseJson('```json\n{"a":1}\n```').a===1);
t('normalizeBlind out of range',L.normalizeBlind({answer:9,confident:true}).answer===null);
t('prompts mention reports',L.judgePrompt(ctx,blind(1)).includes('ควรเป็น 5')&&!L.blindPrompt(ctx).includes('เฉลยในระบบ'));
// Q#13658: outdated fact, AI rewrites the key choice; the blind pass answered the OLD question -> human, but the edit is kept as a draft
const ctx3={...ctx,question:{...ctx.question,choices:['a','b','c','ไม่เกิน 200,000 บาท'],answer:3}};
r=L.finalize(ctx3,blind(3),{verdict:'fix',confidence:100,analysis:'ควรแก้',user_message:'m',fix:{choices:['a','b','c','ไม่เกิน 5,000,000 บาท'],answer:3,explanation:'ใหม่'}});
t('rewritten key -> human with draft',r.verdict==='human'&&r.fix===null&&r.suggestion&&r.suggestion.choices[3].includes('5,000,000')&&r.user_message===L.DEFAULT_MESSAGE.human);
t('downgrade note explains choices',r.analysis.includes('ทำจากข้อเดิม'));
// low confidence fix keeps draft; invalid fix gives no draft; ok/hide never carry a draft
r=L.finalize(ctx,blind(2),{verdict:'fix',confidence:50,analysis:'a',user_message:'m',fix:{answer:2,explanation:'x'}}); t('low conf fix -> draft',r.verdict==='human'&&r.suggestion?.answer===2);
r=L.finalize(ctx,blind(1),{verdict:'fix',confidence:90,analysis:'a',user_message:'m',fix:{answer:9}}); t('invalid fix -> no draft',r.verdict==='human'&&r.suggestion===null);
r=L.finalize(ctx,blind(2),{verdict:'ok',confidence:95,analysis:'a',user_message:'m',fix:{answer:2}}); t('ok downgraded -> no draft',r.verdict==='human'&&r.suggestion===null);
r=L.finalize(ctx,blind(2),{verdict:'fix',confidence:90,analysis:'a',user_message:'m',fix:{answer:2}}); t('accepted fix has no draft',r.verdict==='fix'&&r.suggestion===null);
t('judge prompt asks for proposal wording',L.judgePrompt(ctx,blind(1)).includes('ห้ามเขียนว่าแก้แล้ว'));
console.log(`${n-bad}/${n} passed`);
