#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  computeReminders,
  reminderDeadline,
  remindersDueOnDate
} from "../assets/app-template/public/reminder-dates.js";

const reminders = computeReminders("2030-06-01", [
  { id: "after", item: "After", dueDate: "2030-06-03" },
  { id: "during", item: "During", dueDate: "2030-06-01" },
  { id: "before", item: "Before", dueDate: "2030-05-30" }
]);

assert.deepEqual(reminders.map((item) => item.id), ["before", "during", "after"]);
assert.deepEqual(remindersDueOnDate(reminders, "2030-06-01").map((item) => item.id), ["during"]);
assert.equal(reminderDeadline("2030-06-01", { leadDays: 2 }), "2030-05-30");
assert.equal(reminderDeadline("2030-06-01", { dueDate: "2030-06-03", leadDays: 99 }), "2030-06-03");

console.log("Reminder date tests passed.");
