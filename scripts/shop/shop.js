import { system } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { addMoney, formatMoney, getBalance } from "../economy/economy.js";
import { SERVER_SHOP_ITEMS } from "./shop_items.js";

// ==========================================
// HELPER: HARGA DAN TEXTURE
// ==========================================

export function getSellPrice(shopItem) {
  return Math.max(1, Math.floor(shopItem.price * CONFIG.SELL_PRICE_MULTIPLIER));
}

export function getTexture(item) {
  if (item.texture) return item.texture;
  const id = item.id.replace("minecraft:", "");
  if (
    id.includes("log") ||
    id.includes("stone") ||
    id.includes("dirt") ||
    id.includes("grass") ||
    id.includes("block") ||
    id.includes("deepslate")
  ) {
    return `textures/blocks/${id}`;
  }
  return `textures/items/${id}`;
}

// ==========================================
// SELL INFO HELPER (ITEM DI TANGAN)
// ==========================================

export function getHeldItemSellInfo(player) {
  const inventory = player.getComponent("inventory");
  if (!inventory || !inventory.container) {
    return { error: "§cInventory tidak ditemukan." };
  }

  const container = inventory.container;
  const selectedSlot = player.selectedSlotIndex;
  const item = container.getItem(selectedSlot);

  if (!item) {
    return { error: "§cTangan kosong! Pegang item yang ingin dijual/dicek." };
  }

  const shopItem = SERVER_SHOP_ITEMS.find((i) => i.id === item.typeId);
  if (!shopItem) {
    return {
      error: `§cItem §f${item.typeId.replace("minecraft:", "")}§c tidak ada dalam daftar jual.`,
    };
  }

  if (shopItem.allow_sell === false) {
    return { error: `§cItem: §f${shopItem.name}§c tidak dapat dijual.` };
  }

  const unitSellPrice = getSellPrice(shopItem);
  const totalSellPrice = unitSellPrice * item.amount;

  return {
    item,
    shopItem,
    unitSellPrice,
    totalSellPrice,
    amount: item.amount,
    container,
    selectedSlot,
  };
}

// Eksekusi jual item di tangan
export function handleSellHand(player, sellAmount = null) {
  const info = getHeldItemSellInfo(player);
  if (info.error) {
    player.sendMessage(info.error);
    player.playSound("mob.villager.no");
    return false;
  }

  const { item, shopItem, unitSellPrice, container, selectedSlot } = info;
  const currentAmount = item.amount;
  const amountToSell = sellAmount
    ? Math.min(sellAmount, currentAmount)
    : currentAmount;

  if (amountToSell <= 0) return false;

  const totalEarnings = unitSellPrice * amountToSell;

  if (amountToSell >= currentAmount) {
    container.setItem(selectedSlot, undefined);
  } else {
    item.amount = currentAmount - amountToSell;
    container.setItem(selectedSlot, item);
  }

  addMoney(player, totalEarnings);
  player.sendMessage(`§a[Terjual] §f${amountToSell}x ${shopItem.name}`);
  player.sendMessage(
    `§aPendapatan: §e${formatMoney(totalEarnings)} §7(${formatMoney(unitSellPrice)}/pcs) | Saldo: §e${formatMoney(getBalance(player))}`,
  );
  player.playSound("random.orb");
  return true;
}

// Cek harga item di tangan
export function handlePriceCheck(player) {
  const info = getHeldItemSellInfo(player);
  if (info.error) {
    player.sendMessage(info.error);
    player.playSound("mob.villager.no");
    return;
  }

  player.sendMessage(
    `§e[Info Item] §f${info.shopItem.name}\n` +
      `§7- Harga Beli: §c${formatMoney(info.shopItem.price)}\n` +
      `§7- Harga Jual: §a${formatMoney(info.unitSellPrice)} / pcs\n` +
      `§7- Total di Tangan (${info.amount}x): §e${formatMoney(info.totalSellPrice)}`,
  );
  player.playSound("random.orb");
}

// ==========================================
// INVENTORY SCANNER (UNTUK MENU JUAL GUI)
// ==========================================

export function getInventorySellableItems(player) {
  const inventory = player.getComponent("inventory");
  if (!inventory || !inventory.container) return [];

  const container = inventory.container;
  const grouped = new Map();

  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item) continue;

    const shopItem = SERVER_SHOP_ITEMS.find((i) => i.id === item.typeId);
    if (!shopItem || shopItem.allow_sell === false) continue;

    const unitPrice = getSellPrice(shopItem);

    if (grouped.has(item.typeId)) {
      const existing = grouped.get(item.typeId);
      existing.totalAmount += item.amount;
      existing.totalValue += unitPrice * item.amount;
      existing.slots.push({ slot, amount: item.amount });
    } else {
      grouped.set(item.typeId, {
        typeId: item.typeId,
        name: shopItem.name,
        shopItem: shopItem,
        unitPrice: unitPrice,
        totalAmount: item.amount,
        totalValue: unitPrice * item.amount,
        texture: getTexture(shopItem),
        slots: [{ slot, amount: item.amount }],
      });
    }
  }

  return Array.from(grouped.values());
}

// Eksekusi jual dari inventory
export function sellInventoryItem(player, typeId, sellAll = true) {
  const inventory = player.getComponent("inventory");
  if (!inventory || !inventory.container) return false;

  const container = inventory.container;
  const shopItem = SERVER_SHOP_ITEMS.find((i) => i.id === typeId);
  if (!shopItem) return false;

  const unitPrice = getSellPrice(shopItem);
  let totalSold = 0;

  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (!item || item.typeId !== typeId) continue;

    if (!sellAll && totalSold + item.amount > 64) {
      const needed = 64 - totalSold;
      item.amount -= needed;
      container.setItem(slot, item);
      totalSold += needed;
      break;
    } else {
      totalSold += item.amount;
      container.setItem(slot, undefined);
      if (!sellAll && totalSold >= 64) break;
    }
  }

  if (totalSold > 0) {
    const totalEarnings = unitPrice * totalSold;
    addMoney(player, totalEarnings);
    player.sendMessage(`§a[Terjual] §f${totalSold}x ${shopItem.name}`);
    player.sendMessage(
      `§aPendapatan: §e${formatMoney(totalEarnings)} | Saldo: §e${formatMoney(getBalance(player))}`,
    );
    player.playSound("random.orb");
    return true;
  }

  return false;
}

// ==========================================
// SIGN SHOP INTERACTION (OPTIONAL SP SUPPORT)
// ==========================================

export function handleShopSignInteract(event) {
  const { block, player } = event;
  if (!block.typeId.includes("sign")) return;

  const signComp = block.getComponent("minecraft:sign");
  if (!signComp) return;

  const rawText = signComp.getText();
  if (!rawText) return;

  const rawLines = rawText.split("\n");
  const cleanLines = rawText.replace(/§./g, "").split("\n");
  const header = cleanLines[0] ? cleanLines[0].trim().toUpperCase() : "";

  // === 1. [MARKET] SIGN (BUKA MENU UTAMA / KATALOG) ===
  if (header === "[MARKET]") {
    event.cancel = true;
    system.run(() => {
      let cat = cleanLines[1] ? cleanLines[1].trim() : "All";
      if (!cat) cat = "All";

      // Auto-validate jika belum berformat biru
      if (!rawLines[0].includes("§1")) {
        try {
          signComp.setText(
            `§1§l[MARKET]\n§0${cat}\n§8(Right Click)\n§7to Open`,
          );
          player.sendMessage(`§a[Market Sign] Berhasil dibuat! Kategori: ${cat}`);
          player.playSound("random.levelup");
        } catch (e) {}
      }

      import("./shop_ui.js").then((m) => {
        if (cat.toLowerCase() === "all") {
          m.showMainShopMenu(player);
        } else {
          m.showShopUI(player, cat);
        }
      });
    });
    return;
  }

  // === 2. [SELL] SIGN (BUKA MENU JUAL BARANG) ===
  if (header === "[SELL]") {
    event.cancel = true;
    system.run(() => {
      // Auto-validate jika belum berformat oranye
      if (!rawLines[0].includes("§6")) {
        try {
          signComp.setText(
            "§6§l[SELL]\n§0All Items\n§8(Right Click)\n§7to Sell",
          );
          player.sendMessage("§a[Sell Sign] Berhasil dibuat! Klik kanan untuk jual barang.");
          player.playSound("random.levelup");
        } catch (e) {}
      }

      import("./shop_ui.js").then((m) => {
        m.showSellMenu(player);
      });
    });
    return;
  }

  // === 3. [SHOP] SIGN (BELI ITEM SPESIFIK 1-KLIK) ===
  if (header !== "[SHOP]") return;

  const isVerified = rawLines[0].includes("§1");

  // Validasi otomatis sign shop
  if (!isVerified) {
    event.cancel = true;
    system.run(() => {
      const priceInput = cleanLines[1]?.trim() || "";
      const amountInput = cleanLines[2]?.trim() || "1";
      let itemInput = cleanLines[3]?.trim() || "";

      const price = parseInt(priceInput);
      if (isNaN(price) || price <= 0) {
        player.sendMessage("§c[Error] Baris 2 (Harga) harus angka positif.");
        return;
      }

      let amount = parseInt(amountInput);
      if (isNaN(amount) || amount <= 0) amount = 1;

      if (!itemInput || itemInput.toLowerCase() === "hand") {
        const inv = player.getComponent("inventory");
        const held = inv?.container?.getItem(player.selectedSlotIndex);
        if (!held) {
          player.sendMessage(
            "§c[Error] Pegang item di tangan untuk divalidasi.",
          );
          return;
        }
        itemInput = held.typeId;
      }

      if (!itemInput.includes(":")) itemInput = "minecraft:" + itemInput;
      const displayName = itemInput.replace("minecraft:", "");

      try {
        signComp.setText(
          `§1§l[SHOP]\n§2$ ${price}\n§0Qty: ${amount}\n§8${displayName}`,
        );
        player.sendMessage(
          `§a[SHOP] Toko Dibuat: ${displayName} x${amount} = ${formatMoney(price)}`,
        );
        player.playSound("random.levelup");
      } catch (e) {
        player.sendMessage("§c[Error] Gagal update sign.");
      }
    });
    return;
  }

  // Transaksi Beli via Sign
  event.cancel = true;
  system.run(() => {
    const price = parseInt(cleanLines[1].replace(/[^0-9]/g, ""));
    const amount = parseInt(cleanLines[2].replace(/[^0-9]/g, ""));
    let itemID = cleanLines[3].trim();

    if (!itemID || isNaN(price) || isNaN(amount)) {
      player.sendMessage("§c[Error] Data toko tidak terbaca.");
      return;
    }

    if (!itemID.includes(":")) itemID = "minecraft:" + itemID;

    const balance = getBalance(player);
    if (balance < price) {
      player.sendMessage(`§cUang tidak cukup! Butuh: §e${formatMoney(price)}`);
      player.playSound("mob.villager.no");
      return;
    }

    const inv = player.getComponent("inventory");
    if (inv?.container?.emptySlotsCount < 1) {
      player.sendMessage("§cInventory penuh! Sisakan 1 slot kosong.");
      return;
    }

    addMoney(player, -price);
    try {
      player.runCommandAsync(`give @s ${itemID} ${amount}`);
      player.sendMessage(
        `§aMembeli ${amount}x ${itemID.replace("minecraft:", "")} seharga §e${formatMoney(price)}`,
      );
      player.playSound("random.orb");
    } catch (e) {
      addMoney(player, price); // Refund
      player.sendMessage(
        "§c[Error] Gagal memberikan item. Saldo dikembalikan.",
      );
    }
  });
}
