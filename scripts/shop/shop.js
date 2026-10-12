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
// SIGN SHOP INTERACTION (FORWARDED TO SIGN_SHOP.JS)
// ==========================================
export { handleShopSignInteract } from "./sign_shop.js";
