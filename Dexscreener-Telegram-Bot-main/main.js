const { prepare_data } = require("./prepare_data");
const { start_bot } = require("./start_bot");

const CronJob = require("cron").CronJob;

async function start() {
  await prepare_data();
  setTimeout(start,4*3600*1000);
}
// const job = new CronJob(
//   "00 00 00,12 * * *",
//   start,
//   null,
//   true,
//   "Europe/Helsinki"
// );

// job.start();
start();
start_bot();
