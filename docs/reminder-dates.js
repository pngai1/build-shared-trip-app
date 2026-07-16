const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function reminderDeadline(startDateISO, reminder = {}) {
  if (validISODate(reminder.dueDate)) return reminder.dueDate;
  if (!validISODate(startDateISO)) return "";

  const deadline = new Date(`${startDateISO}T00:00:00Z`);
  const leadDays = Number(reminder.leadDays);
  deadline.setUTCDate(deadline.getUTCDate() - (Number.isFinite(leadDays) ? leadDays : 0));
  return deadline.toISOString().slice(0, 10);
}

export function computeReminders(startDateISO, items = []) {
  return items
    .map((item) => ({
      id: item.id,
      item: item.item,
      deadline: reminderDeadline(startDateISO, item)
    }))
    .filter((item) => item.deadline)
    .sort((first, second) => first.deadline.localeCompare(second.deadline));
}

export function remindersDueOnDate(reminders = [], date = "") {
  return reminders.filter((reminder) => reminder.deadline === date);
}

function validISODate(value) {
  if (!ISO_DATE.test(String(value || ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
