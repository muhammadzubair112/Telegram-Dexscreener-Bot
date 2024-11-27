const fs = require("fs");
const { setMonitor, get_block_number } = require("./utils/transactions");
const { process_transaction } = require("./actions/process_transaction");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let start_block_number = 18559965;

let first_start_flag = false;

async function getBlockNumber() {
  //start_block_number = 18583349  ;
  start_block_number = (await get_block_number()) - 20;
}

async function start_bot() {
  const lp_file_path = "./lpData.json";
  const wallet_file_path = "./walletData.json";
  let lp_data = [];
  let wallet_data = [];
  if (fs.existsSync(lp_file_path)) {
    const lpContent = fs.readFileSync(lp_file_path, "utf8");
    if (lpContent.trim().length > 0) {
      lp_data = JSON.parse(lpContent);
    } else {
      lp_data = [];
    }
  } else {
    console.log("There is no Lp address!");
  }
  if (fs.existsSync(wallet_file_path)) {
    const walletContent = fs.readFileSync(wallet_file_path, "utf8");
    if (walletContent.trim().length > 0) {
      wallet_data = JSON.parse(walletContent);
    } else {
      wallet_data = [];
    }
  } else {
    console.log("There is no Wallet address!");
  }
  if (lp_data.length > 0 && wallet_data.length > 0) {
    if (!first_start_flag) {
      await getBlockNumber();
      first_start_flag = true;
    }
    const current_block_number = await get_block_number();
    if (current_block_number <= start_block_number) {
      console.log("Waiting transactions...");
      await delay(15000);
      start_block_number = current_block_number;
    }
    await setMonitor(lp_data, start_block_number, process_transaction,wallet_data);
    start_block_number += 10;
    delay(100);
    start_bot();
  } else {
    setTimeout(start_bot, 10000);
    console.log("There is no Lp and wallet address!");
  }
}

module.exports = {
  start_bot,
  getBlockNumber,
};
