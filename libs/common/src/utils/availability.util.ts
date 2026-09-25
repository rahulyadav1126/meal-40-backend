/** Local wall-clock schedules; interval end is exclusive. Overnight intervals belong to their starting day. */
export interface ServiceInterval { day: number; opens: string; closes: string }
export interface ServiceException { date: string; intervals: Array<{ opens: string; closes: string }> }
export interface AvailabilitySettings {
  timezone: string;
  availabilityMode: 'SCHEDULED' | 'FORCED_OPEN' | 'FORCED_CLOSED';
  overrideExpiresAt?: string | null;
  overrideReason?: string | null;
  weeklyHours: ServiceInterval[];
  exceptions: ServiceException[];
}
export interface AvailabilitySource {
  openingStatus: string; approvalStatus: string; isActive: boolean;
  availabilitySettings?: AvailabilitySettings | null;
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const formatters = new Map<string, Intl.DateTimeFormat>();
function local(now: Date, timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, day: new Date(`${date}T12:00:00Z`).getUTCDay(), minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
function shift(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function intervals(settings: AvailabilitySettings, date: string) {
  const exception = settings.exceptions.find(e => e.date === date);
  return exception?.intervals ?? settings.weeklyHours.filter(i => i.day === new Date(`${date}T12:00:00Z`).getUTCDay());
}
export function scheduleOpen(settings: AvailabilitySettings, now: Date): boolean {
  const current = local(now, settings.timezone);
  const exception = settings.exceptions.find(e => e.date === current.date);
  if (exception) return exception.intervals.some(i => {
    const start = minutes(i.opens), end = minutes(i.closes);
    return current.minute >= start && (end > start ? current.minute < end : true);
  });
  const today = intervals(settings, current.date).some(i => {
    const start = minutes(i.opens), end = minutes(i.closes);
    return current.minute >= start && (end > start ? current.minute < end : true);
  });
  return today || intervals(settings, shift(current.date, -1)).some(i => minutes(i.closes) <= minutes(i.opens) && current.minute < minutes(i.closes));
}
function wallTime(date: string, time: string, timezone: string): Date | null {
  const target = Date.parse(`${date}T${time}:00Z`);
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const observed = local(new Date(guess), timezone);
    const observedUtc = Date.parse(`${observed.date}T00:00:00Z`) + observed.minute * 60000;
    const delta = target - observedUtc;
    if (!delta) return new Date(guess);
    guess += delta;
  }
  return null; // Nonexistent wall-clock time during a daylight-saving jump.
}
export function restaurantAvailability(source: AvailabilitySource, now = new Date(), includeNextTransition = true) {
  const settings = source.availabilitySettings;
  const eligible = source.isActive && source.approvalStatus === 'APPROVED';
  const expires = settings?.overrideExpiresAt ? Date.parse(settings.overrideExpiresAt) : null;
  const override = settings && settings.availabilityMode !== 'SCHEDULED' && (expires === null || expires > now.getTime());
  const openAt = (at: Date) => {
    if (!eligible) return false;
    if (!settings) return source.openingStatus === 'OPEN';
    if (settings.availabilityMode !== 'SCHEDULED' && (expires === null || expires > at.getTime())) return settings.availabilityMode === 'FORCED_OPEN';
    return scheduleOpen(settings, at);
  };
  const isAcceptingOrders = openAt(now);
  let next: Date | null = null;
  if (includeNextTransition && eligible && settings && !(override && expires === null)) {
    const dates = new Set<string>();
    const today = local(now, settings.timezone).date;
    for (let d = -1; d <= 8; d++) dates.add(shift(today, d));
    if (expires && expires > now.getTime()) {
      const expiryDate = local(new Date(expires), settings.timezone).date;
      for (let d = -1; d <= 8; d++) dates.add(shift(expiryDate, d));
    }
    for (const e of settings.exceptions) { if (e.date >= today) { dates.add(e.date); dates.add(shift(e.date, 1)); } }
    const boundaries: number[] = expires && expires > now.getTime() ? [expires] : [];
    for (const date of dates) {
      const midnight = wallTime(date, '00:00', settings.timezone); if (midnight) boundaries.push(midnight.getTime());
      for (const i of intervals(settings, date)) {
        for (const [day, time] of [[date, i.opens], [minutes(i.closes) <= minutes(i.opens) ? shift(date, 1) : date, i.closes]] as const) {
          const at = wallTime(day, time, settings.timezone); if (at) boundaries.push(at.getTime());
        }
      }
    }
    for (const at of [...new Set(boundaries)].filter(t => t > now.getTime()).sort((a, b) => a - b)) {
      if (openAt(new Date(at)) !== isAcceptingOrders) { next = new Date(at); break; }
    }
  }
  return {
    isAcceptingOrders,
    openingStatus: isAcceptingOrders ? 'OPEN' : 'CLOSED',
    effectiveStatus: isAcceptingOrders ? 'OPEN' : 'CLOSED',
    statusReason: !eligible ? 'Restaurant is not accepting orders' : override ? settings?.overrideReason || (isAcceptingOrders ? 'Opened manually' : 'Temporarily closed') : isAcceptingOrders ? 'Accepting orders' : 'Outside operating hours',
    closesAt: isAcceptingOrders ? next?.toISOString() ?? null : null,
    nextOpensAt: !isAcceptingOrders ? next?.toISOString() ?? null : null,
    evaluatedAt: now.toISOString(),
  };
}
export function menuAvailability(item: { isAvailable: boolean; soldOutUntil?: Date | string | null; serviceHours?: ServiceInterval[] | null }, restaurant: AvailabilitySource, now = new Date()) {
  const store = restaurantAvailability(restaurant, now, false);
  const soldOut = !!item.soldOutUntil && new Date(item.soldOutUntil) > now;
  const scheduled = !item.serviceHours?.length || scheduleOpen({ timezone: restaurant.availabilitySettings?.timezone ?? 'Asia/Kolkata', availabilityMode: 'SCHEDULED', weeklyHours: item.serviceHours, exceptions: [] }, now);
  const isOrderable = store.isAcceptingOrders && item.isAvailable && !soldOut && scheduled;
  return { isOrderable, availabilityReason: !store.isAcceptingOrders ? store.statusReason : !item.isAvailable ? 'Unavailable' : soldOut ? 'Temporarily sold out' : !scheduled ? 'Outside item serving hours' : 'Available' };
}
