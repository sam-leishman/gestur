/**
 * Returns a "YYYY-MM-DD" string for the given Date in the user's local timezone.
 * offsetDays can shift the date (e.g. -1 for yesterday).
 */
export function localDateString(date: Date, offsetDays = 0): string {
	const d = offsetDays === 0 ? date : new Date(date);
	if (offsetDays !== 0) d.setDate(d.getDate() + offsetDays);
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}
