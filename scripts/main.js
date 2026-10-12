import { world, system } from "@minecraft/server";
import { CONFIG } from "./config.js";
import {
  setupEconomy,
  initPlayerEconomy,
  handleBalance,
  handleAddMoney,
  handleSetMoney,
} from "./economy/economy.js";
import { handleSellHand, handlePriceCheck } from "./shop/shop.js";
import { handleShopSignInteract } from "./shop/sign_shop.js";
import { showMainShopMenu } from "./shop/shop_ui.js";
import { showRepairUI } from "./shop/repair.js";

// ==========================================
// INISIALISASI SAAT WORLD DIBUKA
// ==========================================
system.run(() => {
  setupEconomy();
  console.warn(
    ">> [Petek Economy & Shop SP] Addon successfully loaded (Sign Shop & /scriptevent Mode)!",
  );
});

// Listener Player Spawn (Modal awal & inisialisasi)
world.afterEvents.playerSpawn.subscribe((ev) => {
  system.run(() => {
    initPlayerEconomy(ev.player);
  });
});

// ==========================================
// 1. SIGN SHOP LISTENER (UTAMA - TOKO FISIK)
// ==========================================
// 100% Stable API: Menangkap klik kanan Sign [MARKET], [SELL], [SHOP]
// dan membatalkan aksi edit bawaan Minecraft.
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  try {
    handleShopSignInteract(ev);
  } catch (e) {
    console.warn(`[Sign Shop Error] ${e}`);
  }
});

// ==========================================
// 2. SCRIPTEVENT COMMAND LISTENER (100% STABLE NON-EXPERIMENTAL)
// ==========================================
// Contoh penggunaan di game:
//   /scriptevent shop:bal
//   /scriptevent shop:price
//   /scriptevent shop:help
//   /scriptevent shop:addmoney 500
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  const { id, message } = ev;
  const player = ev.initiator ?? ev.sourceEntity;

  // Pastikan perintah dijalankan oleh Player
  if (!player || player.typeId !== "minecraft:player") return;

  let command = "";
  let args = "";

  if (id.startsWith("shop:") || id.startsWith("eco:")) {
    // Format: /scriptevent shop:bal ATAU /scriptevent shop:addmoney 100
    command = id.split(":")[1].toLowerCase();
    args = (message || "").trim();
  } else if (id === "shop" || id === "eco") {
    // Format: /scriptevent shop bal ATAU /scriptevent shop addmoney 100
    const parts = (message || "").trim().split(" ");
    command = (parts[0] || "").toLowerCase();
    args = parts.slice(1).join(" ").trim();
  } else {
    return;
  }

  system.run(() => {
    switch (command) {
      case "bal":
      case "balance":
      case "money":
      case "uang":
        handleBalance(player);
        break;

      case "price":
      case "cek":
        handlePriceCheck(player);
        break;

      case "repair":
      case "fix":
        showRepairUI(player);
        break;

      case "shop":
      case "market":
      case "menu":
        if (CONFIG.ALLOW_GLOBAL_SHOP_ACCESS) {
          showMainShopMenu(player);
        } else {
          player.sendMessage("§c[Shop] Belanja di mana saja dinonaktifkan.");
          player.sendMessage(
            "§eSilakan kunjungi toko fisik dan klik Sign §b[MARKET] §eatau §b[SHOP]!",
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
            "§eSilakan kunjungi toko fisik dan klik Sign §6[SELL]!",
          );
          player.playSound("mob.villager.no");
        }
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
          `§c[Shop] Perintah '/scriptevent shop:${command}' tidak dikenal.`,
        );
        player.sendMessage(
          "§7Ketik '/scriptevent shop:help' untuk melihat daftar perintah.",
        );
        break;
    }
  });
});

// ==========================================
// 3. CHAT COMMAND FALLBACK (HANYA AKTIF JIKA BETA APIS DIAKTIFKAN)
// ==========================================
try {
  if (world.beforeEvents?.chatSend) {
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
                "§c[Shop] Belanja via chat di mana saja dinonaktifkan.",
              );
              player.sendMessage(
                "§eSilakan kunjungi toko fisik dan klik Sign §b[MARKET] §eatau §b[SHOP]!",
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
                "§eSilakan kunjungi toko fisik dan klik Sign §6[SELL]!",
              );
              player.playSound("mob.villager.no");
            }
            break;

          case "price":
          case "cek":
            handlePriceCheck(player);
            break;

          case "repair":
          case "fix":
            showRepairUI(player);
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
              `§c[Shop] Command '${CONFIG.CMD_PREFIX}${command}' tidak dikenal. Ketik '/scriptevent shop:help' untuk bantuan.`,
            );
            break;
        }
      });
    });
  }
} catch (_) {
  // Abaikan di mode Stable tanpa Beta APIs
}

function printHelp(player) {
  player.sendMessage("\n§l§2=== PETEK ECONOMY & SHOP (SIGN TOKO FISIK) ===");
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
  player.sendMessage(
    "§e 4. [REPAIR] §f-> Klik kanan untuk perbaiki alat di tangan (Blacksmith)",
  );
  player.sendMessage("\n§aCommand Resmi (/scriptevent):");
  player.sendMessage("§e /scriptevent shop:bal §f: Cek saldo uang saat ini");
  player.sendMessage(
    "§e /scriptevent shop:price §f: Cek harga jual item di tangan",
  );
  player.sendMessage("§e /scriptevent shop:repair §f: Reparasi alat di tangan");
  player.sendMessage("§e /scriptevent shop:help §f: Tampilkan panduan ini");
  if (CONFIG.ENABLE_CHEAT_COMMANDS) {
    player.sendMessage(
      "§e /scriptevent shop:addmoney <jumlah> §f: Tambah saldo sendiri (Cheat SP)",
    );
    player.sendMessage(
      "§e /scriptevent shop:setmoney <jumlah> §f: Setel saldo sendiri",
    );
  }
  player.sendMessage(
    "§7Catatan: Belanja hanya dapat dilakukan di toko fisik melalui Sign [MARKET] atau [SHOP].\n",
  );
  player.playSound("random.orb");
}
