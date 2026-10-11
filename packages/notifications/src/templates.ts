import type { EmailMessage } from "./email";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html>
<html dir="rtl" lang="he"><body style="margin:0;background:#f6f4f1;font-family:Arial,Helvetica,sans-serif;color:#2b2622">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:bold;padding-bottom:16px">${escape(title)}</td></tr>
<tr><td style="font-size:16px;line-height:1.6;padding-bottom:24px">${body}</td></tr>
<tr><td><a href="${escape(cta.url)}" style="display:inline-block;background:#b5476a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold">${escape(cta.label)}</a></td></tr>
<tr><td style="font-size:13px;color:#8a817a;padding-top:24px">אם לא ביקשת את זה, אפשר להתעלם מהמייל.</td></tr>
</table><div style="font-size:12px;color:#8a817a;padding-top:16px">סגרנו – ניהול תקציב החתונה</div>
</td></tr></table></body></html>`;
}

export function verifyEmailMessage(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: "אימות כתובת האימייל – סגרנו",
    html: layout(`היי ${name},`, "כדי להתחיל לנהל את התקציב צריך לאמת את כתובת האימייל.", {
      label: "אימות האימייל",
      url,
    }),
    text: `היי ${name}, לאימות האימייל: ${url}`,
  };
}

export function invitationMessage(
  to: string,
  inviterName: string,
  eventName: string,
  roleLabel: string,
  url: string,
): EmailMessage {
  return {
    to,
    subject: `${inviterName} מזמין/ה אותך ל"${eventName}" – סגרנו`,
    html: layout(
      "הוזמנת לנהל איתנו את האירוע",
      `${escape(inviterName)} הזמין/ה אותך להצטרף ל<b>${escape(eventName)}</b> בסגרנו (הרשאה: ${escape(roleLabel)}).<br>` +
        "שם רואים את החוזים, התשלומים והתקציב במקום אחד. הקישור בתוקף 7 ימים.",
      { label: "הצטרפות לאירוע", url },
    ),
    text: `${inviterName} הזמין/ה אותך להצטרף ל"${eventName}" בסגרנו (${roleLabel}). להצטרפות (בתוקף 7 ימים): ${url}`,
  };
}

export function resetPasswordMessage(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    subject: "איפוס סיסמה – סגרנו",
    html: layout(`היי ${name},`, "קיבלנו בקשה לאיפוס הסיסמה. הקישור בתוקף לשעה אחת.", {
      label: "בחירת סיסמה חדשה",
      url,
    }),
    text: `היי ${name}, לאיפוס הסיסמה (בתוקף לשעה): ${url}`,
  };
}
