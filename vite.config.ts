import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function updateCookieJar(jar: string, setCookies?: string[]): string {
  const map = new Map<string, string>();
  if (jar) {
    jar.split(';').forEach(c => {
      const [k, ...v] = c.trim().split('=');
      if (k) map.set(k.trim(), v.join('='));
    });
  }
  if (setCookies && Array.isArray(setCookies)) {
    setCookies.forEach(sc => {
      const part = sc.split(';')[0];
      const [k, ...v] = part.trim().split('=');
      if (k) map.set(k.trim(), v.join('='));
    });
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

function extractTeacherName(text: string, defaultUsername: string): string {
  if (!text) return defaultUsername ? `คุณครู (${defaultUsername})` : '';
  const match = text.match(/UserStatusLbl"[^>]*>([\s\S]*?)<\/span>/i) ||
                text.match(/Log in\s*:\s*([^<\n\r]+)/i) ||
                text.match(/UserName"[^>]*>([^<]+)/i);
  if (!match) return defaultUsername ? `คุณครู (${defaultUsername})` : '';
  const raw = (match[1] || '').replace(/<[^>]+>/g, '').replace(/Log in\s*:\s*/i, '').replace(/&nbsp;/g, ' ').trim();
  const prefixMatch = raw.match(/((?:นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ดร\.|อาจารย์|ครู)\s*[^\d<]+)/i);
  if (prefixMatch) {
    return prefixMatch[1].trim().replace(/\s+/g, ' ');
  }
  const cleaned = raw.replace(/^\d+\s*/, '').trim().replace(/\s+/g, ' ');
  return cleaned || (defaultUsername ? `คุณครู (${defaultUsername})` : '');
}

// In-memory session store
let sgsSessionCookie = '';
let sgsTeacherInfo = { name: '', school: 'โรงเรียนวังหลวงพิทยาสรรพ์' };

function sgsBridgePlugin() {
  return {
    name: 'sgs-bridge-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/sgs', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const url = req.url || '';

        const readBody = (): Promise<any> => {
          return new Promise((resolve) => {
            let data = '';
            req.on('data', (chunk: any) => { data += chunk; });
            req.on('end', () => {
              try { resolve(JSON.parse(data)); } catch { resolve({}); }
            });
          });
        };

        const json = (data: any, code = 200) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(data));
        };

        const SGS_BASE = 'https://sgs.bopp-obec.info';
        const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

        try {
          // Status check
          if (url.startsWith('/status')) {
            return json({
              ok: true,
              connected: Boolean(sgsSessionCookie),
              teacher: sgsTeacherInfo
            });
          }

          // Logout
          if (url.startsWith('/logout')) {
            sgsSessionCookie = '';
            sgsTeacherInfo = { name: '', school: '' };
            return json({ ok: true, message: 'ออกจากระบบ SGS เรียบร้อยแล้ว' });
          }

          // Login to SGS Live
          if (url.startsWith('/login') && req.method === 'POST') {
            sgsSessionCookie = '';
            sgsTeacherInfo = { name: '', school: '' };
            const { username, password } = await readBody();
            if (!username || !password) {
              return json({ ok: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน SGS' }, 400);
            }

            // Step 1: GET initial session and ViewState
            const getRes = await fetch(`${SGS_BASE}/sgs/Security/SignIn.aspx`, {
              headers: { 'User-Agent': USER_AGENT }
            });

            const html = await getRes.text();
            const vs = html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
            const vsg = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
            const ev = html.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';
            
            let cookieJar = updateCookieJar('', getRes.headers.getSetCookie());

            // Step 2: POST credentials to SGS
            const bodyParams = new URLSearchParams();
            bodyParams.append('__EVENTTARGET', 'ctl00$PageContent$OKButton$_Button');
            bodyParams.append('__EVENTARGUMENT', '');
            bodyParams.append('__VIEWSTATE', vs);
            bodyParams.append('__VIEWSTATEGENERATOR', vsg);
            if (ev) bodyParams.append('__EVENTVALIDATION', ev);
            bodyParams.append('ctl00$PageContent$UserName', username.trim());
            bodyParams.append('ctl00$PageContent$Password', password.trim());

            const postRes = await fetch(`${SGS_BASE}/sgs/Security/SignIn.aspx`, {
              method: 'POST',
              headers: {
                'User-Agent': USER_AGENT,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieJar
              },
              body: bodyParams.toString(),
              redirect: 'manual'
            });

            cookieJar = updateCookieJar(cookieJar, postRes.headers.getSetCookie());
            const loc = postRes.headers.get('location') || '';
            const postHtml = await postRes.text();

            const isAuthSuccess = (loc.length > 0 && !loc.includes('SignIn.aspx')) || cookieJar.includes('.ASPXAUTH');

            if (!isAuthSuccess) {
              const errMatch = postHtml.match(/id="ctl00_PageContent_LoginMessage"[^>]*>([^<]+)</i);
              const errMsg = errMatch ? errMatch[1].trim() : 'ชื่อผู้ใช้หรือรหัสผ่าน SGS ไม่ถูกต้อง (กรุณาตรวจสอบอีกครั้ง)';
              return json({ ok: false, error: errMsg }, 401);
            }

            // Login Success! Save active session
            sgsSessionCookie = cookieJar;

            // Step 3: Fetch Show-TblSchoolInfo.aspx to extract real teacher name and school
            let targetPage = loc ? (loc.startsWith('http') ? loc : `${SGS_BASE}${loc}`) : `${SGS_BASE}/sgs/TblSchoolInfo/Show-TblSchoolInfo.aspx`;
            const mainRes = await fetch(targetPage, {
              headers: { 'User-Agent': USER_AGENT, 'Cookie': sgsSessionCookie }
            });
            const mainHtml = await mainRes.text();
            sgsSessionCookie = updateCookieJar(sgsSessionCookie, mainRes.headers.getSetCookie());

            // Extract Teacher Name directly from SGS page
            sgsTeacherInfo = {
              name: extractTeacherName(mainHtml, username),
              school: 'โรงเรียนวังหลวงพิทยาสรรพ์'
            };

            // Step 4: Extract Real Subjects & Rooms for THIS specific teacher
            const subjects: any[] = [];
            try {
              const tRes = await fetch(`${SGS_BASE}/sgs/TblTranscripts/Edit-TblTranscripts-Table.aspx`, {
                headers: { 'User-Agent': USER_AGENT, 'Cookie': sgsSessionCookie }
              });
              const tHtml = await tRes.text();
              sgsSessionCookie = updateCookieJar(sgsSessionCookie, tRes.headers.getSetCookie());

              // Extract Teacher Name from both tHtml and mainHtml
              const liveName = extractTeacherName(tHtml + ' ' + mainHtml, username);
              if (liveName && !liveName.startsWith('คุณครู (')) {
                sgsTeacherInfo.name = liveName;
              }

              const selectMatch = tHtml.match(/name="ctl00\$PageContent\$ClassSubjectIDFilter"[^>]*>([\s\S]*?)<\/select>/i);
              const rawSubs: { val: string, text: string }[] = [];
              if (selectMatch) {
                const optRegex = /<option\s+value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi;
                let sm;
                while ((sm = optRegex.exec(selectMatch[1])) !== null) {
                  const val = sm[1].trim();
                  const text = sm[2].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                  if (val && val !== '0' && val !== '-1' && val !== '--ANY--' && !text.includes('เลือก')) {
                    rawSubs.push({ val, text });
                  }
                }
              }

              const yr = tHtml.match(/<select[^>]+name="ctl00\$_PageHeader\$_DropDownListYr"[^>]*>[\s\S]*?<option[^>]+selected="selected"[^>]*value="([^"]+)"/i)?.[1] || '2569';
              const tr = tHtml.match(/<select[^>]+name="ctl00\$_PageHeader\$_DropDownListTr"[^>]*>[\s\S]*?<option[^>]+selected="selected"[^>]*value="([^"]+)"/i)?.[1] || '1';
              const lvl = tHtml.match(/<select[^>]+name="ctl00\$_PageHeader\$_DropDownListLevel"[^>]*>[\s\S]*?<option[^>]+selected="selected"[^>]*value="([^"]+)"/i)?.[1] || '20';
              let vs = tHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
              let vsg = tHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
              let ev = tHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';

              for (const sub of rawSubs) {
                const parts = sub.text.split(/\s+/);
                const code = parts[0] || 'วิชา';
                const levelMatch = sub.text.match(/ม\.\d+/)?.[0] || 'ม.4';

                try {
                  const pSub = new URLSearchParams();
                  pSub.append('__EVENTTARGET', 'ctl00$PageContent$ClassSubjectIDFilter');
                  pSub.append('__EVENTARGUMENT', '');
                  pSub.append('__VIEWSTATE', vs);
                  pSub.append('__VIEWSTATEGENERATOR', vsg);
                  if (ev) pSub.append('__EVENTVALIDATION', ev);
                  pSub.append('ctl00$_PageHeader$_DropDownListYr', yr);
                  pSub.append('ctl00$_PageHeader$_DropDownListTr', tr);
                  pSub.append('ctl00$_PageHeader$_DropDownListLevel', lvl);
                  pSub.append('ctl00$PageContent$ClassSubjectIDFilter', sub.val);
                  pSub.append('ctl00$PageContent$ClassSectionNoFilter', '--ANY--');

                  const rSub = await fetch(`${SGS_BASE}/sgs/TblTranscripts/Edit-TblTranscripts-Table.aspx`, {
                    method: 'POST',
                    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sgsSessionCookie },
                    body: pSub.toString()
                  });
                  const subHtml = await rSub.text();
                  sgsSessionCookie = updateCookieJar(sgsSessionCookie, rSub.headers.getSetCookie());

                  const secMatch = subHtml.match(/name="ctl00\$PageContent\$ClassSectionNoFilter"[^>]*>([\s\S]*?)<\/select>/i);
                  const rooms: string[] = [];
                  if (secMatch) {
                    const rOptRegex = /<option\s+value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi;
                    let rm;
                    while ((rm = rOptRegex.exec(secMatch[1])) !== null) {
                      const rVal = rm[1].trim();
                      if (rVal && rVal !== '--ANY--') {
                        rooms.push(rVal);
                      }
                    }
                  }

                  if (rooms.length > 0) {
                    rooms.forEach(roomNo => {
                      subjects.push({
                        code,
                        name: sub.text,
                        gradeLevel: levelMatch,
                        room: roomNo,
                        credit: 1.0,
                        totalStudents: 30,
                        value: sub.val,
                        sgsClassId: sub.val
                      });
                    });
                  } else {
                    subjects.push({
                      code,
                      name: sub.text,
                      gradeLevel: levelMatch,
                      room: '1',
                      credit: 1.0,
                      totalStudents: 30,
                      value: sub.val,
                      sgsClassId: sub.val
                    });
                  }
                } catch {
                  subjects.push({
                    code,
                    name: sub.text,
                    gradeLevel: levelMatch,
                    room: '1',
                    credit: 1.0,
                    totalStudents: 30,
                    value: sub.val,
                    sgsClassId: sub.val
                  });
                }
              }
            } catch (err: any) {
              console.error('Failed fetching subjects from SGS:', err);
            }

            return json({
              ok: true,
              message: 'เข้าสู่ระบบ SGS สำเร็จ!',
              teacher: sgsTeacherInfo,
              subjects
            });
          }

          // Fetch student roster for a selected subject/room LIVE from SGS
          if (url.startsWith('/roster') && req.method === 'POST') {
            const body = await readBody();
            const room = body.room || '1';
            const subjectVal = body.subjectValue || '';

            if (sgsSessionCookie && subjectVal) {
              try {
                // Fetch page
                const pRes = await fetch(`${SGS_BASE}/sgs/TblTranscripts/Edit-TblTranscripts-Table.aspx`, {
                  headers: { 'User-Agent': USER_AGENT, 'Cookie': sgsSessionCookie }
                });
                let html = await pRes.text();
                sgsSessionCookie = updateCookieJar(sgsSessionCookie, pRes.headers.getSetCookie());

                // Update teacher name if still default
                const liveRosterTName = extractTeacherName(html, '');
                if (liveRosterTName && !liveRosterTName.startsWith('คุณครู (')) {
                  sgsTeacherInfo.name = liveRosterTName;
                }

                let vs = html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
                let vsg = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
                let ev = html.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';
                const yr = html.match(/<select[^>]+name="ctl00\$_PageHeader\$_DropDownListYr"[^>]*>[\s\S]*?<option[^>]+selected="selected"[^>]*value="([^"]+)"/i)?.[1] || '2569';
                const tr = html.match(/<select[^>]+name="ctl00\$_PageHeader\$_DropDownListTr"[^>]*>[\s\S]*?<option[^>]+selected="selected"[^>]*value="([^"]+)"/i)?.[1] || '1';
                const lvl = html.match(/<select[^>]+name="ctl00\$_PageHeader\$_DropDownListLevel"[^>]*>[\s\S]*?<option[^>]+selected="selected"[^>]*value="([^"]+)"/i)?.[1] || '20';

                // Select subject
                const pSub = new URLSearchParams();
                pSub.append('__EVENTTARGET', 'ctl00$PageContent$ClassSubjectIDFilter');
                pSub.append('__EVENTARGUMENT', '');
                pSub.append('__VIEWSTATE', vs);
                pSub.append('__VIEWSTATEGENERATOR', vsg);
                if (ev) pSub.append('__EVENTVALIDATION', ev);
                pSub.append('ctl00$_PageHeader$_DropDownListYr', yr);
                pSub.append('ctl00$_PageHeader$_DropDownListTr', tr);
                pSub.append('ctl00$_PageHeader$_DropDownListLevel', lvl);
                pSub.append('ctl00$PageContent$ClassSubjectIDFilter', String(subjectVal));
                pSub.append('ctl00$PageContent$ClassSectionNoFilter', '--ANY--');

                const rSub = await fetch(`${SGS_BASE}/sgs/TblTranscripts/Edit-TblTranscripts-Table.aspx`, {
                  method: 'POST',
                  headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sgsSessionCookie },
                  body: pSub.toString()
                });
                html = await rSub.text();
                sgsSessionCookie = updateCookieJar(sgsSessionCookie, rSub.headers.getSetCookie());

                vs = html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
                vsg = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
                ev = html.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';

                // Select section (Page 1)
                const pSec = new URLSearchParams();
                pSec.append('__EVENTTARGET', 'ctl00$PageContent$ClassSectionNoFilter');
                pSec.append('__EVENTARGUMENT', '');
                pSec.append('__VIEWSTATE', vs);
                pSec.append('__VIEWSTATEGENERATOR', vsg);
                if (ev) pSec.append('__EVENTVALIDATION', ev);
                pSec.append('ctl00$_PageHeader$_DropDownListYr', yr);
                pSec.append('ctl00$_PageHeader$_DropDownListTr', tr);
                pSec.append('ctl00$_PageHeader$_DropDownListLevel', lvl);
                pSec.append('ctl00$PageContent$ClassSubjectIDFilter', String(subjectVal));
                pSec.append('ctl00$PageContent$ClassSectionNoFilter', String(room));

                const rSec = await fetch(`${SGS_BASE}/sgs/TblTranscripts/Edit-TblTranscripts-Table.aspx`, {
                  method: 'POST',
                  headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sgsSessionCookie },
                  body: pSec.toString()
                });
                html = await rSec.text();
                sgsSessionCookie = updateCookieJar(sgsSessionCookie, rSec.headers.getSetCookie());

                // Extract Dynamic Max Scores (Weights) from CheckValue
                const decodedForWeights = html.replace(/&#39;/g, "'").replace(/&quot;/g, '"');
                const getMax = (field: string) => {
                  const m = decodedForWeights.match(new RegExp(`CheckValue\\([^,]+,\\s*'${field}',\\s*'(\\d+)'`, 'i'));
                  return m ? parseInt(m[1], 10) : 0;
                };

                const s1Max = getMax('S1');
                const s2Max = getMax('S2');
                const s3Max = getMax('S3');
                const midMax = getMax('Midterm');
                const s10Max = getMax('S10');
                const s11Max = getMax('S11');
                const s12Max = getMax('S12');
                const finMax = getMax('Final');

                const weights = {
                  preMid: (s1Max + s2Max + s3Max) || 20,
                  mid: midMax || 30,
                  preFinal: (s10Max + s11Max + s12Max) || 20,
                  final: finMax || 30
                };

                // Helper to fetch and extract Q (คุณลักษณะ) or L (อ่านคิดวิเคราะห์) grades map: studentId -> gradeNumber (0-3)
                const fetchEvalMap = async (pageUrl: string, gradeInputPrefix: string): Promise<Map<string, number>> => {
                  const map = new Map<string, number>();
                  try {
                    const pRes = await fetch(`${SGS_BASE}${pageUrl}`, {
                      headers: { 'User-Agent': USER_AGENT, 'Cookie': sgsSessionCookie }
                    });
                    let pHtml = await pRes.text();
                    sgsSessionCookie = updateCookieJar(sgsSessionCookie, pRes.headers.getSetCookie());

                    let pVs = pHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
                    let pVsg = pHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
                    let pEv = pHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';

                    // Select Subject
                    const pSub = new URLSearchParams();
                    pSub.append('__EVENTTARGET', 'ctl00$PageContent$ClassSubjectIDFilter');
                    pSub.append('__EVENTARGUMENT', '');
                    pSub.append('__VIEWSTATE', pVs);
                    pSub.append('__VIEWSTATEGENERATOR', pVsg);
                    if (pEv) pSub.append('__EVENTVALIDATION', pEv);
                    pSub.append('ctl00$_PageHeader$_DropDownListYr', yr);
                    pSub.append('ctl00$_PageHeader$_DropDownListTr', tr);
                    pSub.append('ctl00$_PageHeader$_DropDownListLevel', lvl);
                    pSub.append('ctl00$PageContent$ClassSubjectIDFilter', String(subjectVal));
                    pSub.append('ctl00$PageContent$ClassSectionNoFilter', '--ANY--');

                    const rSub = await fetch(`${SGS_BASE}${pageUrl}`, {
                      method: 'POST',
                      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sgsSessionCookie },
                      body: pSub.toString()
                    });
                    pHtml = await rSub.text();
                    sgsSessionCookie = updateCookieJar(sgsSessionCookie, rSub.headers.getSetCookie());

                    // Select Room
                    pVs = pHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
                    pVsg = pHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
                    pEv = pHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';

                    const pSec = new URLSearchParams();
                    pSec.append('__EVENTTARGET', 'ctl00$PageContent$ClassSectionNoFilter');
                    pSec.append('__EVENTARGUMENT', '');
                    pSec.append('__VIEWSTATE', pVs);
                    pSec.append('__VIEWSTATEGENERATOR', pVsg);
                    if (pEv) pSec.append('__EVENTVALIDATION', pEv);
                    pSec.append('ctl00$_PageHeader$_DropDownListYr', yr);
                    pSec.append('ctl00$_PageHeader$_DropDownListTr', tr);
                    pSec.append('ctl00$_PageHeader$_DropDownListLevel', lvl);
                    pSec.append('ctl00$PageContent$ClassSubjectIDFilter', String(subjectVal));
                    pSec.append('ctl00$PageContent$ClassSectionNoFilter', String(room));

                    const rSec = await fetch(`${SGS_BASE}${pageUrl}`, {
                      method: 'POST',
                      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sgsSessionCookie },
                      body: pSec.toString()
                    });
                    pHtml = await rSec.text();
                    sgsSessionCookie = updateCookieJar(sgsSessionCookie, rSec.headers.getSetCookie());

                    const parseEvalRows = (h: string) => {
                      const rowChunks = h.split(/<tr(?=[^>]*><td class="ticnb")/i);
                      for (let i = 1; i < rowChunks.length; i++) {
                        const chunk = rowChunks[i];
                        const tds = chunk.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
                        let sid = '';
                        for (let t = 2; t < Math.min(8, tds.length); t++) {
                          const text = tds[t].replace(/<[^>]+>/g, '').trim();
                          if (/^\d{5}$/.test(text)) {
                            sid = text;
                            break;
                          }
                        }
                        if (!sid) continue;

                        const inpMatch = chunk.match(new RegExp(`<input[^>]+[$_]${gradeInputPrefix}["\\s][^>]*>`, 'i'));
                        if (!inpMatch) continue;
                        const vMatch = inpMatch[0].match(/value="([^"]*)"/i);
                        const val = vMatch ? vMatch[1].trim() : '';
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0 && num <= 3) {
                          map.set(sid, num);
                        }
                      }
                    };

                    parseEvalRows(pHtml);

                    // Pagination for Q / L
                    const totalP = parseInt(pHtml.match(/id="ctl00_PageContent_[^"]*Pagination__TotalPages"[^>]*>(\d+)/i)?.[1] || '1', 10);
                    let curP = 1;
                    const pagerName = gradeInputPrefix === 'QGrade' ? 'TblTranscriptsQPagination' : 'TblTranscriptsLPagination';
                    while (curP < totalP && curP < 5) {
                      pVs = pHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
                      pVsg = pHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
                      pEv = pHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';

                      const pNext = new URLSearchParams();
                      pNext.append('__EVENTTARGET', `ctl00$PageContent$${pagerName}$_NextPage`);
                      pNext.append('__EVENTARGUMENT', '');
                      pNext.append('__VIEWSTATE', pVs);
                      pNext.append('__VIEWSTATEGENERATOR', pVsg);
                      if (pEv) pNext.append('__EVENTVALIDATION', pEv);
                      pNext.append('ctl00$_PageHeader$_DropDownListYr', yr);
                      pNext.append('ctl00$_PageHeader$_DropDownListTr', tr);
                      pNext.append('ctl00$_PageHeader$_DropDownListLevel', lvl);
                      pNext.append('ctl00$PageContent$ClassSubjectIDFilter', String(subjectVal));
                      pNext.append('ctl00$PageContent$ClassSectionNoFilter', String(room));

                      const rNext = await fetch(`${SGS_BASE}${pageUrl}`, {
                        method: 'POST',
                        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sgsSessionCookie },
                        body: pNext.toString()
                      });
                      pHtml = await rNext.text();
                      sgsSessionCookie = updateCookieJar(sgsSessionCookie, rNext.headers.getSetCookie());
                      parseEvalRows(pHtml);
                      curP++;
                    }
                  } catch (err) {
                    console.error('Error fetching eval map:', pageUrl, err);
                  }
                  return map;
                };

                // Parse students from full outer row chunks (handles nested table tags in SGS cells)
                const parseStudents = (h: string) => {
                  const rowChunks = h.split(/<tr(?=[^>]*><td class="ticnb")/i);
                  const res: any[] = [];
                  for (let i = 1; i < rowChunks.length; i++) {
                    const chunk = rowChunks[i];
                    const tds = chunk.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
                    if (tds.length < 5) continue;

                    const noText = tds[2] ? tds[2].replace(/<[^>]+>/g, '').trim() : '';
                    const idText = tds[3] ? tds[3].replace(/<[^>]+>/g, '').trim() : '';
                    const nameText = tds[4] ? tds[4].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : '';

                    if (!idText || !/^\d{5}$/.test(idText)) continue;

                    const getNum = (name: string) => {
                      const m = chunk.match(new RegExp(`<input[^>]+[$_]${name}["\\s][^>]*>`, 'i'));
                      if (!m) return null;
                      const vm = m[0].match(/value="([^"]*)"/i);
                      if (!vm || vm[1].trim() === '') return null;
                      const n = parseFloat(vm[1]);
                      return isNaN(n) ? null : n;
                    };

                    const getStr = (name: string) => {
                      const m = chunk.match(new RegExp(`<input[^>]+[$_]${name}["\\s][^>]*>`, 'i'));
                      if (!m) return '';
                      const vm = m[0].match(/value="([^"]*)"/i);
                      return vm ? vm[1].trim() : '';
                    };

                    const s1 = getNum('S1');
                    const s2 = getNum('S2');
                    const s3 = getNum('S3');
                    const mid = getNum('Midterm');
                    const s10 = getNum('S10');
                    const s11 = getNum('S11');
                    const s12 = getNum('S12');
                    const fin = getNum('Final');
                    const total = getNum('TotalPercent');
                    const gr = getStr('Gr');
                    const rem = getStr('Remark');

                    let preMid: number | "" = "";
                    if (s1 !== null || s2 !== null || s3 !== null) {
                      preMid = (s1 || 0) + (s2 || 0) + (s3 || 0);
                    }

                    let preFinal: number | "" = "";
                    if (s10 !== null || s11 !== null || s12 !== null) {
                      preFinal = (s10 || 0) + (s11 || 0) + (s12 || 0);
                    }

                    let status: "normal" | "0" | "r" | "ms" = "normal";
                    if (gr === "ร" || rem === "ร") status = "r";
                    else if (gr === "มส" || rem === "มส") status = "ms";
                    else if (gr === "0") status = "0";

                    res.push({
                      no: parseInt(noText, 10) || 0,
                      id: idText,
                      name: nameText,
                      preMid,
                      mid: mid !== null ? mid : "",
                      preFinal,
                      final: fin !== null ? fin : "",
                      totalScore: total !== null ? total : undefined,
                      grade: (gr && gr !== 'Default') ? gr : undefined,
                      qualityAttr: 3,
                      readWrite: 3,
                      status
                    });
                  }
                  return res;
                };

                const allStudents: any[] = parseStudents(html);
                const totalPages = parseInt(html.match(/id="ctl00_PageContent_TblTranscriptsPagination__TotalPages"[^>]*>(\d+)/i)?.[1] || '1', 10);

                let curPage = 1;
                while (curPage < totalPages && curPage < 6) {
                  vs = html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)?.[1] || '';
                  vsg = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)?.[1] || '';
                  ev = html.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/)?.[1] || '';

                  const pNext = new URLSearchParams();
                  pNext.append('__EVENTTARGET', 'ctl00$PageContent$TblTranscriptsPagination$_NextPage');
                  pNext.append('__EVENTARGUMENT', '');
                  pNext.append('__VIEWSTATE', vs);
                  pNext.append('__VIEWSTATEGENERATOR', vsg);
                  if (ev) pNext.append('__EVENTVALIDATION', ev);
                  pNext.append('ctl00$_PageHeader$_DropDownListYr', yr);
                  pNext.append('ctl00$_PageHeader$_DropDownListTr', tr);
                  pNext.append('ctl00$_PageHeader$_DropDownListLevel', lvl);
                  pNext.append('ctl00$PageContent$ClassSubjectIDFilter', String(subjectVal));
                  pNext.append('ctl00$PageContent$ClassSectionNoFilter', String(room));

                  const rNext = await fetch(`${SGS_BASE}/sgs/TblTranscripts/Edit-TblTranscripts-Table.aspx`, {
                    method: 'POST',
                    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': sgsSessionCookie },
                    body: pNext.toString()
                  });
                  html = await rNext.text();
                  sgsSessionCookie = updateCookieJar(sgsSessionCookie, rNext.headers.getSetCookie());

                  const nextBatch = parseStudents(html);
                  if (nextBatch.length === 0) break;
                  allStudents.push(...nextBatch);
                  curPage++;
                }

                // Also fetch Q (คุณลักษณะ) and L (อ่านคิดวิเคราะห์) evaluations
                const qMap = await fetchEvalMap('/sgs/TblTranscriptsQ/Edit-TblTranscriptsQ-Table.aspx', 'QGrade');
                const lMap = await fetchEvalMap('/sgs/TblTranscriptsL/Edit-TblTranscriptsL-Table.aspx', 'LGrade');

                const unique = Array.from(new Map(allStudents.map(s => [s.id, s])).values());
                unique.forEach(s => {
                  if (qMap.has(s.id)) s.qualityAttr = qMap.get(s.id)!;
                  if (lMap.has(s.id)) s.readWrite = lMap.get(s.id)!;
                });
                unique.sort((a, b) => a.no - b.no);

                return json({
                  ok: true,
                  teacherName: sgsTeacherInfo.name,
                  weights,
                  students: unique
                });
              } catch (err: any) {
                console.error('Error fetching live students from SGS:', err);
              }
            }

            return json({ ok: true, students: [] });
          }

          json({ ok: false, error: 'Endpoint not found' }, 404);
        } catch (err: any) {
          json({ ok: false, error: err.message || 'SGS Bridge Server Error' }, 500);
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), sgsBridgePlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
