import { world, system } from "@minecraft/server";
import { CONFIG } from "./config.js";
import {
  setupEconomy,
  initPlayerEconomy,
  handleBalance,
  handleAddMoney,
  handleSetMoney,
} from "./economy/economy.js";
import {
  handleSellHand,
  handlePriceCheck,
  handleShopSignInteract,
} from "./shop/shop.js";
import { showMainShopMenu } from "./shop/shop_ui.js";

const menuCooldowns = new Map();

// ==========================================
// INISIALISASI SAAT WORLD DIBUKA
// ==========================================
system.run(() => {
  setupEconomy();
  console.warn(">> [Petek Economy & Shop SP] Addon successfully loaded!");
});

// Listener Player Spawn (Modal awal & inisialisasi)
world.afterEvents.playerSpawn.subscribe((ev) => {
  system.run(() => {
    initPlayerEconomy(ev.player);
  });
});

// ==========================================
// 1. TRIGGER MENU VIA ITEM (KLIK KANAN / TAHAN LAYAR)
// ==========================================
world.beforeEvents.itemUse.subscribe((ev) => {
  const item = ev.itemStack;
  const player = ev.source;

  if (!item) return;

  if (CONFIG.TRIGGER_ITEMS.includes(item.typeId)) {
    ev.cancel = true;

    const now = Date.now();
    const lastUse = menuCooldowns.get(player.name) || 0;

    if (now - lastUse < CONFIG.TRIGGER_COOLDOWN_MS) {
      return;
    }
    menuCooldowns.set(player.name, now);

    system.run(() => {
      if (CONFIG.ALLOW_GLOBAL_SHOP_ACCESS) {
        showMainShopMenu(player);
      } else {
        player.sendMessage(
          "§c[Shop] Akses belanja di mana saja dinonaktifkan.",
        );
        player.sendMessage(
          "§eSilakan buat & gunakan Sign §b[MARKET] §eatau §b[SHOP] §edi toko fisikmu!",
        );
        player.sendMessage(
          "§7(Bisa diaktifkan kembali lewat 'ALLOW_GLOBAL_SHOP_ACCESS' di scripts/config.js)",
        );
        player.playSound("mob.villager.no");
      }
    });
  }
});

// ==========================================
// 2. CHAT COMMAND LISTENER
// ==========================================
world.beforeEvents.chatSend.subscribe((ev) => {
  const message = ev.message;
  const player = ev.sender;

  if (!message.startsWith(CONFIG.CMD_PREFIX)) return;

  ev.cancel = true;

  const content = message.substring(CONFIG.CMD_PREFIX.length).trim();
  const parts = content.split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  system.run(() => {
    switch (command) {
      case "shop":
      case "market":
      case "menu":
        if (CONFIG.ALLOW_GLOBAL_SHOP_ACCESS) {
          showMainShopMenu(player);
        } else {
          player.sendMessage(
            "§c[Shop] Belanja via command di mana saja dinonaktifkan.",
          );
          player.sendMessage(
            "§eSilakan buat & gunakan Sign §b[MARKET] §eatau §b[SHOP] §edi toko fisikmu!",
          );
          player.sendMessage(
            "§7(Bisa diaktifkan kembali lewat 'ALLOW_GLOBAL_SHOP_ACCESS' di scripts/config.js)",
          );
          player.playSound("mob.villager.no");
        }
        break;

      case "sell":
        if (CONFIG.ALLOW_GLOBAL_SELL_COMMAND) {
          handleSellHand(player);
        } else {
          player.sendMessage(
            "§c[Shop] Jual via command di mana saja dinonaktifkan.",
          );
          player.sendMessage(
            "§eSilakan buat & gunakan Sign §6[SELL] §eatau §b[MARKET] §edi toko fisikmu!",
          );
          player.sendMessage(
            "§7(Bisa diaktifkan kembali lewat 'ALLOW_GLOBAL_SELL_COMMAND' di scripts/config.js)",
          );
          player.playSound("mob.villager.no");
        }
        break;

      case "price":
      case "cek":
        handlePriceCheck(player);
        break;

      case "bal":
      case "balance":
      case "money":
      case "uang":
        handleBalance(player);
        break;

      case "addmoney":
        handleAddMoney(player, args);
        break;

      case "setmoney":
        handleSetMoney(player, args);
        break;

      case "help":
      case "h":
        printHelp(player);
        break;

      default:
        player.sendMessage(
          `§c[Shop] Command '${CONFIG.CMD_PREFIX}${command}' tidak dikenal. Ketik ${CONFIG.CMD_PREFIX}help untuk bantuan.`,
        );
        break;
    }
  });
});

function printHelp(player) {
  player.sendMessage("\n§l§2=== PETEK ECONOMY & SHOP (SIGN SYSTEM) ===");
  player.sendMessage("§bCara Membuat Toko Fisik Menggunakan Sign:");
  player.sendMessage(
    "§e 1. [MARKET] §7(Baris 2: All / Kategori) §f-> Klik kanan untuk buka GUI Shop",
  );
  player.sendMessage(
    "§e 2. [SELL] §f-> Klik kanan untuk buka Menu Jual (Tangan / Tas)",
  );
  player.sendMessage(
    "§e 3. [SHOP] §7(Brs 2: Harga, Brs 3: Qty, Brs 4: Item/hand) §f-> Beli instan",
  );
  player.sendMessage("\n§aCommand yang Tersedia:");
  player.sendMessage(`§e${CONFIG.CMD_PREFIX}bal §f: Cek saldo uang saat ini`);
  player.sendMessage(
    `§e${CONFIG.CMD_PREFIX}price §f: Cek harga jual item di tangan`,
  );
  if (CONFIG.ENABLE_CHEAT_COMMANDS) {
    player.sendMessage(
      `§e${CONFIG.CMD_PREFIX}addmoney <jumlah> §f: Tambah saldo sendiri (Cheat SP)`,
    );
    player.sendMessage(
      `§e${CONFIG.CMD_PREFIX}setmoney <jumlah> §f: Setel saldo sendiri`,
    );
  }
  player.sendMessage(
    `§7Catatan: Buka toko di mana saja dinonaktifkan (Ubah 'ALLOW_GLOBAL_SHOP_ACCESS' di scripts/config.js jika ingin mengaktifkannya).\n`,
  );
  player.playSound("random.orb");
}

// ==========================================
// 3. SIGN SHOP LISTENER (OPTIONAL WORLD SIGNS)
// ==========================================
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  try {
    handleShopSignInteract(ev);
  } catch (e) {
    console.warn(`[Sign Shop Error] ${e}`);
  }
});
