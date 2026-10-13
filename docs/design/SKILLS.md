# סקילים לעיצוב מחדש – מקור וגרסה

הותקנו ב-13/10/2026 ב-`.claude/skills/` (scope של הפרויקט, נכנסים ל-git). הותקנו בהעתקה של קובצי Markdown בלבד, בגרסה (commit) קבועה, בלי להריץ את ה-CLI של `npx skills` ובלי מערכת ה-plugins. אין בהם סקריפטים, hooks או גישה לרשת.

| סקיל                                                                                                                                                                       | מקור                                                                                                                                         | commit     | רישיון     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| `frontend-design`                                                                                                                                                          | [anthropics/skills](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/frontend-design) (רשמי)        | `dbd4588`  | Apache-2.0 |
| `redesign-existing-projects`                                                                                                                                               | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/d237dd399d57524945c0c81327da5da19f7a468d/skills/redesign-skill)          | `d237dd3`  | MIT        |
| `animate`, `animation-vocabulary`, `animation-performance`, `find-animation-opportunities`, `improve-animations`, `review-animations`, `ask-sonner`                          | [emilkowalski/skills](https://github.com/emilkowalski/skills/tree/2d228630ba1446365f614a108cb8252f1feda202/skills)                           | `2d22863`  | MIT        |
| `hebrew-rtl-best-practices`, `hebrew-tailwind-preset`                                                                                                                      | [skills-il/localization](https://github.com/skills-il/localization/tree/c6dbba434e415b9201b29cb9012246066a144c71) (SKILL.md + references)    | `c6dbba4`  | MIT        |

**לא הותקנו:** `playground` (אופציונלי, plugin רשמי: `/plugin install playground@claude-plugins-official`), `impeccable` (hook, בינארי וטלמטריה), `ui-ux-pro-max` (105 קבצי Python), ושאר הסקילים של emilkowalski (Expo, Swift, Apple, prototype ועוד) שלא רלוונטיים לאתר.

**הערות שימוש:**

- `review-animations` מוגדר `disable-model-invocation: true`: הוא רץ רק כשמפעילים אותו ידנית, `/review-animations`.
- `ask-sonner` נוסף כי ה-toasts באתר הם של sonner.
- `redesign-existing-projects` ממליץ על גופנים לטיניים (Geist, Outfit, Satoshi), על החלפת lucide, על glassmorphism ועל תמונות רקע מ-picsum. אצלנו **PLAN.md ו-BRAND.md גוברים**: גופנים עם עברית מלאה בלבד, ואייקונים ותמונות לפי מה שנבחר בבריף.
- `hebrew-tailwind-preset` כולל הוראות התקנה של Tailwind לפרויקט חדש. אצלנו Tailwind 4 כבר מותקן, ולא מתקינים שום דבר לפיו.

**עדכון גרסה:** מורידים מחדש את הקבצים מה-commit החדש, עוברים על ה-diff, ומעדכנים את הטבלה.
