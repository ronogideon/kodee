import cron from "node-cron";
import { currentPeriod, generateInvoicesForPeriod, sendRemindersForPeriod } from "./billing";

// On the 1st of every month at 08:00 (Africa/Nairobi): issue invoices for the
// month, then text every renter their total (with utilities) and the 5-day window.
export function startScheduler() {
  if (process.env.ENABLE_SCHEDULER === "false") {
    console.log("[scheduler] disabled via ENABLE_SCHEDULER=false");
    return;
  }

  cron.schedule(
    "0 8 1 * *",
    async () => {
      const period = currentPeriod();
      console.log(`[scheduler] month open — generating invoices for ${period}`);
      await generateInvoicesForPeriod(period);
      const result = await sendRemindersForPeriod(period);
      console.log(`[scheduler] reminders: ${result.sent}/${result.total} sent`);
    },
    { timezone: "Africa/Nairobi" }
  );

  console.log("[scheduler] monthly reminder job armed (1st @ 08:00 Africa/Nairobi)");
}
