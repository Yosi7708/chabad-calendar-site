/** @license Tanya reference lookup. Adapted from libzmanim, © 2018 Y Paritcher.
 * LGPL-2.1. See docs/third-party/tanya-source.md and libzmanim-LICENSE.txt.
 * Changes: HDate integration, explicit cycle metadata and display formatting.
 */
import {HDate} from '@hebcal/core';
import index from './tanya-index.json';
export function tanyaReference(date:Date,language='he') {
 const h=new HDate(date),m=h.getMonth(),day=h.getDate();
 const cycleYear=(m===7||m===8||m===9&&day<19)?h.getFullYear()-1:h.getFullYear();
 const leap=HDate.isLeapYear(cycleYear),variant=leap?'leap':'regular';
 const row=index[variant][m-1];
 // Entry zero contains the combined final readings of a 29-day month.
 const raw=row?.[day===29&&h.daysInMonth()===29?0:day];
 if(!raw)return {cycleYear,leap,text:language==='he'?'מראה המקום אינו זמין לתאריך הזה':'Reference unavailable for this date'};
 const [from,...tail]=raw.split('\n');const end=tail.join(' ');
 const match=end.match(/^־([^־]+)־\s*(.*)$/);
 const page=match?.[1],to=match?.[2]||end;
 const yearLabel=language==='he'?(leap?'מחזור שנה מעוברת':'מחזור שנה רגילה'):(leap?'Leap-year cycle':'Ordinary-year cycle');
 const text=language==='he'?`${yearLabel} · מ״${from}״ עד ״${to}״${page?` (עמ׳ ${page})`:''}`:`${yearLabel} · from “${from}” to “${to}”${page?` (p. ${page})`:''}`;
 return {cycleYear,leap,text};
}
