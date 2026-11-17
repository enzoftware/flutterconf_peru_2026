/** "Add to calendar" links for the event (Google Calendar URL and an .ics file). Lima is UTC−5 all year. */
import event from '../data/event.json';

const utc = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  return `${event.isoDate.replaceAll('-', '')}T${String(h + 5).padStart(2, '0')}${String(m).padStart(2, '0')}00Z`;
};
const location = `${event.venue}, ${event.address}, ${event.city}, Perú`;
const details = 'Un día entero de Flutter y Dart en Lima. Ponentes, agenda y entradas: muy pronto.';

export const googleCalendarUrl = (pageUrl: string): string => 'https://calendar.google.com/calendar/render?' + new URLSearchParams({
  action: 'TEMPLATE', text: event.name, dates: `${utc(event.start)}/${utc(event.end)}`, location, details: `${details}\n${pageUrl}`,
}).toString();

export function ics(pageUrl: string): string {
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FlutterConf Peru//Landing//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:flutterconf-peru-${event.isoDate}@flutterconf.pe`, `DTSTAMP:${utc(event.start)}`,
    `DTSTART:${utc(event.start)}`, `DTEND:${utc(event.end)}`, `SUMMARY:${esc(event.name)}`,
    `LOCATION:${esc(location)}`, `DESCRIPTION:${esc(details)}`, `URL:${pageUrl}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
