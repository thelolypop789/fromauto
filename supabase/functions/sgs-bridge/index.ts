import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { action, username, password, sessionId } = await req.json();

    if (action === "login") {
      if (!username || !password) {
        return json({ ok: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, 400);
      }

      // Step 1: GET ViewState
      const getRes = await fetch("https://sgs.bopp-obec.info/sgs/Security/SignIn.aspx", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      });

      const html = await getRes.text();
      const vs = html.match(/id="__VIEWSTATE" value="([^"]+)"/)?.[1] || "";
      const vsg = html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/)?.[1] || "";
      const ev = html.match(/id="__EVENTVALIDATION" value="([^"]+)"/)?.[1] || "";
      const rawCookie = getRes.headers.get("set-cookie") || "";
      const sessionMatch = rawCookie.match(/ASP\.NET_SessionId=([^;]+)/);
      const newSessionId = sessionMatch ? sessionMatch[1] : "";

      // Step 2: POST credentials
      const bodyParams = new URLSearchParams();
      bodyParams.append("__EVENTTARGET", "");
      bodyParams.append("__EVENTARGUMENT", "");
      bodyParams.append("__VIEWSTATE", vs);
      bodyParams.append("__VIEWSTATEGENERATOR", vsg);
      if (ev) bodyParams.append("__EVENTVALIDATION", ev);
      bodyParams.append("ctl00$PageContent$UserName", username);
      bodyParams.append("ctl00$PageContent$Password", password);
      bodyParams.append("ctl00$_PageHeader$_SignIn", "เข้าสู่ระบบ");

      const postRes = await fetch("https://sgs.bopp-obec.info/sgs/Security/SignIn.aspx", {
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": `ASP.NET_SessionId=${newSessionId}`,
        },
        body: bodyParams.toString(),
        redirect: "manual",
      });

      const loc = postRes.headers.get("location") || "";
      const postCookies = postRes.headers.get("set-cookie") || "";
      const isSuccess = loc.length > 0 && !loc.includes("SignIn.aspx");

      if (isSuccess || postCookies.includes(".ASPXAUTH")) {
        return json({
          ok: true,
          sessionId: newSessionId,
          redirect: loc,
          message: "เข้าสู่ระบบ SGS สำเร็จ",
        });
      } else {
        return json({
          ok: false,
          error: "ชื่อผู้ใช้หรือรหัสผ่าน SGS ไม่ถูกต้อง (หรือเซิร์ฟเวอร์ยังไม่เปิดรับการเข้าสู่ระบบ)",
        }, 401);
      }
    }

    return json({ ok: false, error: "Action not supported" }, 400);
  } catch (err: any) {
    return json({ ok: false, error: err.message || "SGS Edge Function Error" }, 500);
  }
});
