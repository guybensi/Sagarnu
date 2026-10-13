# סגרנו – תוכנית עיצוב מחדש ומיתוג

מקור: `reports/מיתוג מחדש ומקורות מחירי ספקים.md` (13/10/2026), מותאם למבנה הפרויקט.
העבודה מתבצעת **שלב אחד בכל session**. ההחלטות נשמרות בקבצים ב-`docs/design/`, וכל session חדש מתחיל מהם.

## סטטוס

- [ ] הכנה: התקנת סקילים
- [ ] שלב 0 – בדיקת המצב הקיים → `docs/design/AUDIT.md`
- [ ] שלב 1 – בריף מותג עם 3 כיוונים → `docs/design/BRAND.md` → **עצירה: גיא והגר בוחרים כיוון**
- [ ] שלב 2 – tokens, גופנים, עמוד `/design-system` וסקיל `sagarnu-brand` → **עצירה: אישור העמוד**
- [ ] שלב 3 – רכיבים משותפים
- [ ] שלב 4 – תנועה ואנימציות
- [ ] שלב 5 – עמודים, עמוד אחד או שניים בכל session

אחרי כל שלב: מסמנים `[x]`, וכותבים בשורה אחת מה הוחלט (למשל "כיוון: כרם זיתים").

## משפט פתיחה לכל session

```
קרא את CLAUDE.md, את docs/design/PLAN.md ואת כל מה שכבר קיים ב-docs/design/.
בצע רק את שלב N מ-PLAN.md. כשתסיים: pnpm check, pnpm e2e, commit, סמן את השלב ב-PLAN.md ועצור.
```

בשלבים 1 ו-2 כדאי להתחיל ב-Plan mode, כדי לראות את התוכנית לפני שנכתב קוד.

## כללים לכל השלבים

- **לא משנים טקסטים.** כל הטקסטים בממשק נמצאים ב-`packages/i18n/src/he.ts`. בדיקות ה-E2E (10 בדיקות, 178 בחירות) מחפשות לפי טקסט עברי, תוויות שדות (`label`/`htmlFor`), `id` ושמות כפתורים. עיצוב מחדש לא משנה אף אחד מהם. אם שינוי ניסוח באמת נדרש, הוא נעשה בנפרד ומעדכנים את הבדיקות באותו commit.
- **לא מוסיפים טקסט עברי ישירות בקוד.** כלל ב-ESLint חוסם את זה ב-`apps/web/src`. טקסט חדש נכנס ל-`he.ts`.
- **RTL:** רק utilities לוגיים (`ms-`/`me-`/`ps-`/`pe-`, `start`/`end`, `text-start`/`text-end`). לא משתמשים ב-`left`/`right` פיזיים. אייקונים כיווניים (חצים, קודם/הבא) מתהפכים ב-`:dir(rtl)`. מספרים, וי, פקדי מדיה ואייקונים סימטריים לא מתהפכים. סכומים ותאריכים בתוך טקסט עברי משתמשים במחלקה `.num` הקיימת, או ב-`<bdi>`.
- **נגישות:** ניגודיות WCAG AA (לפחות 4.5:1 לטקסט), focus גלוי, וכיבוי תנועה ב-`prefers-reduced-motion`.
- **צילומי מסך:** בלי להרים שרתים ידנית. יוצרים קובץ זמני `e2e/tests/zz-shots.spec.ts` שמשתמש ב-`signUp` ו-`seedEvent` מ-`e2e/tests/helpers.ts`, מריצים `pnpm exec playwright test zz-shots` מתוך `e2e/`, ומוחקים את הקובץ. הצילומים נשמרים ב-`docs/design/shots/` (התיקייה ב-.gitignore) ב-390px וב-1440px.
- **commit לכל שלב** (ובשלב 5, לכל עמוד), אחרי `pnpm check` ו-`pnpm e2e`.
- **לא מתקינים** סקילים שמריצים hooks, מורידים קבצים בינאריים או שולחים טלמטריה (למשל impeccable). לא מפעילים כמה סקילי "טעם" ביחד, כי הכללים שלהם סותרים.

## הכנה (פעם אחת, לפני שלב 0)

```
/plugin install frontend-design@claude-plugins-official      ← scope: project
/plugin install playground@claude-plugins-official           ← אופציונלי, להשוואת פלטות
npx skills add https://github.com/Leonxlnx/taste-skill --skill "redesign-existing-projects"
npx skills@latest add emilkowalski/skills
# להעתיק ידנית מ-github.com/skills-il/localization את התיקיות
#   hebrew-rtl-best-practices ו-hebrew-tailwind-preset אל .claude/skills/
#   (לקרוא אותן לפני ההעתקה: הריפו קטן)
```

## המצב הנוכחי (נקודת המוצא)

- **Tokens:** `apps/web/src/app/globals.css`, בלוק `@theme` עם 22 משתנים: `canvas`, `surface`, `ink`, `muted`, `line`, `soft`, `brand-50/100/200/500/600/700`, `gold`, `success`/`warning`/`danger` ו-`-soft` לכל אחד, `--radius-card`, `--shadow-card`. 39 קבצי `.tsx` משתמשים בשמות האלה.
- **גופן:** Heebo דרך `next/font` ב-`apps/web/src/app/layout.tsx` (`--font-heebo`).
- **רכיבים משותפים:** `apps/web/src/components/ui/` (button; card: Card/CardTitle/Badge/EmptyState/Spinner; dialog: Dialog/Drawer/ConfirmDialog; form: Field/Input/Select/Textarea/Checkbox; money-input, password-input, scroll-row), ו-toasts של sonner ב-`apps/web/src/app/providers.tsx`.
- **מסכים:** כניסה, הרשמה, שכחתי סיסמה, איפוס, אימות מייל, הזמנה (`app/(auth)/*`), שאלון (`app/onboarding`), האירועים שלי (`app/events`), הגדרות (`app/settings`), ובתוך אירוע (`app/e/[eventId]/*`): דשבורד, חוזים, הוצאות, פרטי האירוע, שיתוף. חלונות: חוזה (`components/contracts/contract-dialog.tsx`), חלונית ספק (`vendor-drawer.tsx`), תשלום (`components/payments/payment-dialog.tsx`).
- **אין ספריית אנימציה מותקנת.** קודם CSS. אם צריך ספרייה, `motion`, אחרי אישור.

## שלב 0 – בדיקה, בלי שינוי קוד

```
אנחנו מתחילים עיצוב מחדש ומיתוג מחדש של "סגרנו" (Sagarnu): מנהל תקציב חתונה בעברית, RTL
(<html lang="he" dir="rtl">), לזוגות ישראלים ולמפיקים. סטאק: Next.js 16 App Router, React 19,
Tailwind CSS 4 (@theme), Radix UI, lucide-react, גופן נוכחי Heebo. השתמש ב-skill redesign-existing-projects
וב-hebrew-rtl-best-practices. אל תשנה קוד באפליקציה בשלב הזה.
צלם כל מסך ראשי ב-390px וב-1440px לפי "צילומי מסך" ב-PLAN.md: כניסה, הרשמה, שאלון (כל השלבים),
האירועים שלי, דשבורד, חוזים + חלון חוזה (צפייה ועריכה) + חלונית ספק, הוספת תשלום, הוצאות, פרטי האירוע,
שיתוף, הגדרות. כתוב docs/design/AUDIT.md עם: מה נראה גנרי או "עשוי ב-AI", בעיות היררכיה, חוסר
עקביות בריווח ובצבעים, באגי RTL (מחלקות left/right פיזיות, חצים שלא מתהפכים, מספרים ו-₪ שמתערבבים
בטקסט עברי), ונגישות (ניגודיות, focus, reduced motion). סיים ברשימת 10 הבעיות החשובות לפי סדר.
```

## שלב 1 – בריף מותג, בלי קוד, ועצירה לבחירה

```
השתמש ב-skill frontend-design. כתוב docs/design/BRAND.md.
נושא: סגרנו – "כל מה שסגרתם, במקום אחד." קהל: זוגות בני 25–35 בלחץ כלכלי, ומפיקים שמנהלים
כמה אירועים במקביל. התפקיד העיקרי של הממשק: לראות במבט אחד כמה התחייבנו, כמה שולם וכמה נשאר.
אישיות: רגוע, חם, אמין, חגיגי אבל לא קיטש – "חבר טוב שמבין בכסף". שאב מהעולם של החתונה הישראלית
(נייר הזמנות, חוזים, קבלות, פרחים) אבל זה כלי כספי: הפלטה החתונתית היא שכבת הדגשה, לא כל המסך.
הצע 3 כיוונים שונים באמת (למשל: שמפניה ודיו / כרם זיתים עם טרקוטה / ירוק עד פורמלי). לכל כיוון:
- משפט קונספט אחד.
- ערכים לכל אחד מה-tokens הקיימים ב-globals.css (canvas, surface, ink, muted, line, soft,
  brand-50…brand-700, gold, success/warning/danger + soft), כ-OKLCH ו-hex, כולל dark mode.
  success/warning/danger הם מצבי התקציב (בתוך התקציב / קרוב לגבול / חריגה) ולא מתנגשים בצבע ההדגשה.
  יחס ניגודיות לכל זוג טקסט/רקע (WCAG AA, לפחות 4.5:1). זהב לא משמש לטקסט.
- זוג גופנים עברי: גופן תצוגה עם אופי ו-UI לטבלאות ומספרים. שניהם עם עברית מלאה ו-4 משקלים
  לפחות, דרך next/font (מועמדים: Frank Ruhl Libre, Rubik, Secular One, Assistant, Heebo).
  אסור לבחור גופן לטיני בלבד. אסור ש-Inter/Roboto/Arial יהיו "הקול" של המותג (Heebo מבוסס Roboto).
  ספרות טבלאיות (tabular-nums) לסכומים.
- סולמות radius, shadow ו-spacing, כללי אייקונים (lucide, מה מתהפך ב-RTL), ו-wireframe ב-ASCII של הדשבורד.
- עקרונות תנועה: לכל היותר 300ms ב-UI, רגע מתוזמר אחד לעמוד, springs למגירות, תנועה אופקית
  לפי כיוון (מתחילה מצד ה-inline-start, ב-RTL זה מימין), כיבוי מלא ב-prefers-reduced-motion.
  "הרגע" של המותג הוא "סגרנו!": כשנוסף ספק, כשמשולם התשלום האחרון, וכש"סגרנו הכל" (ראה סעיף
  "מיתוג סגרנו בתוך הממשק" ב-Future/FUTURE_WORK.txt).
להימנע: גרדיאנט סגול, glassmorphism, hero ממורכז עם מספר גדול, כרטיסי SaaS זהים, תוויות all-caps,
פלטת קשת. אם אתה בוחר קרם + סריף, תסביר למה זו החלטה ולא ברירת מחדל.
אחרי זה תבדוק את שלושת הכיוונים מול הבריף, תתקן כל מה שגנרי ותכתוב מה שינית.
עצור וחכה שאבחר כיוון. אל תכתוב קוד באפליקציה.
```

## שלב 2 – tokens, גופנים וסקיל מותג

```
יישם רק את כיוון [X] מ-docs/design/BRAND.md.
1. ב-apps/web/src/app/globals.css: שמור על שמות ה-tokens הקיימים והחלף רק את הערכים, כדי שלא
   נצטרך לגעת ב-39 הקבצים שמשתמשים בהם. מוסיפים token חדש רק אם הכיוון באמת צריך (למשל accent או
   גופן תצוגה), ומתעדים אותו. light/dark.
2. גופנים דרך next/font ב-apps/web/src/app/layout.tsx (תצוגה + UI), עם subsets hebrew ו-latin.
3. עמוד /design-system שמוצג רק בסביבת פיתוח (notFound בפרודקשן): כל token, סולם הטיפוגרפיה וכל
   מצב של כל רכיב ב-components/ui. צלם אותו ב-390px וב-1440px.
4. השתמש ב-skill-creator כדי ליצור .claude/skills/sagarnu-brand/SKILL.md (paths: apps/web/**).
   הוא מסכם את ההחלטות: צבעים ותפקידם, גופנים ותפקידם, כללי RTL, תנועה וקול (עברית, ניסוח לפי מה
   שהמשתמש מבין, שגיאות שאומרות מה קרה ואיך מתקנים, "סגרנו!" רק ברגעים משמחים).
pnpm check, pnpm e2e, commit. עצור וחכה לאישור העמוד לפני שלב 3.
```

## שלב 3 – רכיבים

```
עצב מחדש את הרכיבים המשותפים לפי ה-tokens בלבד: components/ui (button, card: Card/CardTitle/Badge/
EmptyState/Spinner, dialog: Dialog/Drawer/ConfirmDialog, form: Field/Input/Select/Textarea/Checkbox,
money-input, password-input, scroll-row), toasts של sonner (providers.tsx), ופס התקדמות התקציב בדשבורד.
אין hex או px גולמיים ברכיבים. רק utilities לוגיים. אייקונים כיווניים מתהפכים ב-:dir(rtl).
סכומים ותאריכים בתוך טקסט עברי: .num או <bdi>. side של Sheet/Drawer נבחר לפי הכיוון.
אל תשנה props, טקסטים, label, id או role. הוסף מיקרו-אינטראקציות (לחיצה עם scale, hover, טבעת
focus) וצלם כל מצב בעמוד /design-system.
```

## שלב 4 – תנועה (עם skills של emilkowalski)

```
השתמש ב-find-animation-opportunities ואז ב-animate. הצע לכל היותר רגע מתוזמר אחד לכל עמוד, ואת
האנימציות של "סגרנו!" (ספק חדש / תשלום אחרון / סגרנו הכל). כתוב גם מה לא להנפיש.
קודם CSS. אם צריך ספרייה, motion, ורק אחרי שתסביר למה. ערכי x מוכפלים בכיוון (RTL = -1).
הכל כבוי ב-prefers-reduced-motion. בסוף הרץ review-animations.
```

## שלב 5 – עמודים

```
החל עמוד אחרי עמוד, session אחד לעמוד או לשניים:
דשבורד ← הוצאות ← חוזים (כולל חלון חוזה וחלונית ספק) ← תשלום ← פרטי האירוע ← שיתוף ←
האירועים שלי ← הגדרות ← כניסה/הרשמה/שאלון.
commit לכל עמוד, pnpm check ו-pnpm e2e לפני כל commit. צילומי לפני/אחרי ב-390px וב-1440px.
בסוף מעבר בדיקה מול BRAND.md ו-AUDIT.md: תקן סטיות, ותוריד אלמנט אחד מיותר מכל עמוד.
```
