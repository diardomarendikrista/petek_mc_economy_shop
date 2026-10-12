import { world } from "@minecraft/server";
import { CONFIG } from "../config.js";

// ==========================================
// INISIALISASI SCOREBOARD ECONOMY
// ==========================================
export function setupEconomy() {
  try {
    const objective = world.scoreboard.getObjective(CONFIG.CURRENCY);
    if (!objective) {
      world.scoreboard.addObjective(CONFIG.CURRENCY, CONFIG.DISPLAY_NAME);
      console.warn(
        `>> [Economy] Scoreboard '${CONFIG.CURRENCY}' berhasil dibuat.`,
      );
    }
  } catch (e) {
    console.warn(`>> [Economy Error] Gagal setup scoreboard: ${e}`);
  }
}

// Inisialisasi modal awal pemain baru
export function initPlayerEconomy(player) {
  if (!CONFIG.ENABLE_STARTER_MONEY) return;

  const starterTag = "starter_money_given";
  if (!player.hasTag(starterTag)) {
    addMoney(player, CONFIG.STARTER_MONEY_AMOUNT);
    player.addTag(starterTag);
    player.sendMessage(
      `§a[Economy] Selamat bermain! Anda menerima modal awal sebesar §e${formatMoney(CONFIG.STARTER_MONEY_AMOUNT)}§a.`,
    );
    player.playSound("random.levelup");
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export function formatMoney(amount) {
  const num = typeof amount === "number" ? amount : 0;
  return `${CONFIG.CURRENCY_SYMBOL}${num.toLocaleString("en-US")}`;
}

export function getBalance(player) {
  const objective = world.scoreboard.getObjective(CONFIG.CURRENCY);
  if (!objective) return 0;

  try {
    if (!objective.hasParticipant(player)) return 0;
    return objective.getScore(player) ?? 0;
  } catch (e) {
    return 0;
  }
}

export function addMoney(player, amount) {
  const objective = world.scoreboard.getObjective(CONFIG.CURRENCY);
  if (!objective) return;

  try {
    objective.addScore(player, amount);
  } catch (e) {
    if (!objective.hasParticipant(player)) {
      objective.setScore(player, amount);
    }
  }
}

export function setMoney(player, amount) {
  const objective = world.scoreboard.getObjective(CONFIG.CURRENCY);
  if (!objective) return;
  objective.setScore(player, amount);
}

// ==========================================
// CHAT COMMAND HANDLERS
// ==========================================

export function handleBalance(player) {
  const bal = getBalance(player);
  player.sendMessage(`§aSaldo Anda saat ini: §e${formatMoney(bal)}`);
  player.playSound("random.orb");
}

export function handleAddMoney(player, amountStr) {
  if (!CONFIG.ENABLE_CHEAT_COMMANDS) {
    player.sendMessage("§cCommand ini dinonaktifkan di config.js.");
    return;
  }

  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount <= 0) {
    player.sendMessage(`§cUsage: ${CONFIG.CMD_PREFIX}addmoney <jumlah_angka>`);
    return;
  }

  addMoney(player, amount);
  const newBal = getBalance(player);
  player.sendMessage(
    `§aBerhasil menambahkan §e${formatMoney(amount)}§a. Saldo baru: §e${formatMoney(newBal)}`,
  );
  player.playSound("random.levelup");
}

export function handleSetMoney(player, amountStr) {
  if (!CONFIG.ENABLE_CHEAT_COMMANDS) {
    player.sendMessage("§cCommand ini dinonaktifkan di config.js.");
    return;
  }

  const amount = parseInt(amountStr);
  if (isNaN(amount) || amount < 0) {
    player.sendMessage(`§cUsage: ${CONFIG.CMD_PREFIX}setmoney <jumlah_angka>`);
    return;
  }

  setMoney(player, amount);
  player.sendMessage(
    `§aSaldo Anda disetel menjadi §e${formatMoney(amount)}§a.`,
  );
  player.playSound("random.levelup");
}
