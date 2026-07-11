export function toNumber(value: any) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function hasRentalValue(value: any) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function firstRentalNumber(...values: any[]) {
    const value = values.find(hasRentalValue);
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  
  export function formatDate(date: any) {
    if (!date) return "";
    return String(date).slice(0, 10);
  }
  
  export function countRentalDays(
    startDate: any,
    endDate: any,
    avoidSundays: boolean = true
  ) {
    const start = new Date(formatDate(startDate));
    const end = new Date(formatDate(endDate) || formatDate(new Date()));
  
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    if (end < start) return 1;
  
    let days = 0;
    const current = new Date(start);
  
    while (current <= end) {
      const isSunday = current.getDay() === 0;
  
      if (!(avoidSundays && isSunday)) {
        days++;
      }
  
      current.setDate(current.getDate() + 1);
    }
  
    return Math.max(days, 1);
  }
  
  export function calculateRentalTotal(rental: any) {
    const qty = firstRentalNumber(rental.qty, rental.quantity, 1);
    const rate = firstRentalNumber(
      rental.daily_rate,
      rental.unit_price,
      rental.daily_rent,
      rental.rent,
      rental.rate,
      0
    );
    const discount = firstRentalNumber(rental.discount, 0);
  
    const startDate = rental.start_date || rental.date || rental.rental_date;
  
    const endDate =
      rental.end_date ||
      rental.return_date ||
      rental.closed_date ||
      rental.end ||
      new Date();
  
    const avoidSundays =
      rental.avoid_sundays === false || rental.avoid_sundays === "false"
        ? false
        : true;
  
    const days = countRentalDays(startDate, endDate, avoidSundays);
    const total = days * qty * rate - discount;
  
    return Math.max(0, total);
  }