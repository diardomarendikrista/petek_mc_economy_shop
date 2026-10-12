import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";
import { addMoney, formatMoney, getBalance } from "../economy/economy.js";

// ==========================================
// MAPPING MATERIAL & HARGA DASAR RESEP
// ==========================================
const MATERIAL_TIERS = {
  netherite: { name: "Netherite", unitPrice: 1200 },
  diamond: { name: "Diamond", unitPrice: 128 },
  golden: { name: "Gold", unitPrice: 24 },
  gold: { name: "Gold", unitPrice: 24 },
  iron: { name: "Iron", unitPrice: 16 },
  chainmail: { name: "Chainmail", unitPrice: 20 },
  stone: { name: "Stone", unitPrice: 2 },
  wooden: { name: "Wood", unitPrice: 2 },
  wood: { name: "Wood", unitPrice: 2 },
  leather: { name: "Leather", unitPrice: 8 },
};

const ITEM_RECIPE_COUNTS = {
  helmet: 5,
  chestplate: 8,
  leggings: 7,
  boots: 4,
  sword: 2,
  pickaxe: 3,
  axe: 3,
  shovel: 1,
  hoe: 2,
  shears: 2,
  shield: 2,
};

const SPECIAL_ITEMS = {
  "minecraft:bow": { name: "Bow", unitPrice: 30, materialCount: 1 },
  "minecraft:crossbow": { name: "Crossbow", unitPrice: 45, materialCount: 1 },
  "minecraft:fishing_rod": { name: "Fishing Rod", unitPrice: 15, materialCount: 1 },
  "minecraft:trident": { name: "Trident", unitPrice: 350, materialCount: 1 },
  "minecraft:elytra": { name: "Elytra", unitPrice: 500, materialCount: 1 },
  "minecraft:mace": { name: "Mace", unitPrice: 800, materialCount: 1 },
  "minecraft:flint_and_steel": { name: "Flint and Steel", unitPrice: 20, materialCount: 1 },
  "minecraft:brush": { name: "Brush", unitPrice: 25, materialCount: 1 },
  "minecraft:carrot_on_a_stick": { name: "Carrot on a Stick", unitPrice: 20, materialCount: 1 },
  "minecraft:warped_fungus_on_a_stick": { name: "Fungus on a Stick", unitPrice: 20, materialCount: 1 },
};

/**
 * Mendeteksi material dan jumlah bahan dari typeId item
 */
function getItemMaterialInfo(typeId) {
  if (SPECIAL_ITEMS[typeId]) {
    return SPECIAL_ITEMS[typeId];
  }

  const cleanId = typeId.replace("minecraft:", "").toLowerCase();

  // Cari tier material
  let matchedTier = null;
  for (const [tierKey, tierData] of Object.entries(MATERIAL_TIERS)) {
    if (cleanId.startsWith(tierKey + "_")) {
      matchedTier = tierData;
      break;
    }
  }

  // Cari jenis alat / armor untuk mengetahui jumlah bahan
  let materialCount = 1;
  for (const [toolKey, count] of Object.entries(ITEM_RECIPE_COUNTS)) {
    if (cleanId.includes(toolKey)) {
      materialCount = count;
      break;
    }
  }

  if (matchedTier) {
    return {
      name: matchedTier.name,
      unitPrice: matchedTier.unitPrice,
      materialCount: materialCount,
    };
  }

  // Fallback untuk item ber-durability lainnya
  return {
    name: "Standard Material",
    unitPrice: 30,
    materialCount: 1,
  };
}

/**
 * Menghitung detail biaya reparasi item di tangan
 */
export function getHeldItemRepairInfo(player) {
  const inventory = player.getComponent("inventory");
  if (!inventory || !inventory.container) {
    return { error: "§cInventory tidak ditemukan." };
  }

  const container = inventory.container;
  const selectedSlot = player.selectedSlotIndex;
  const item = container.getItem(selectedSlot);

  if (!item) {
    return { error: "§cTangan kosong! Pegang alat atau armor yang ingin diperbaiki." };
  }

  const durability =
    item.getComponent("durability") ||
    item.getComponent("minecraft:durability");

  if (!durability) {
    return {
      error: `§cItem §f${item.typeId.replace("minecraft:", "")}§c tidak memiliki durability untuk diperbaiki.`,
    };
  }

  const currentDamage = durability.damage;
  const maxDurability = durability.maxDurability;

  // Jika barang masih 100% mulus
  if (currentDamage <= 0) {
    return {
      item,
      container,
      selectedSlot,
      durability,
      currentDamage: 0,
      maxDurability,
      currentHealth: maxDurability,
      damagePercent: 0,
      cost: 0,
      isPristine: true,
    };
  }

  const damageRatio = currentDamage / maxDurability;
  const damagePercent = Math.round(damageRatio * 100);
  const currentHealth = maxDurability - currentDamage;

  const matInfo = getItemMaterialInfo(item.typeId);
  const fullMaterialCost = matInfo.unitPrice * matInfo.materialCount;

  const discount = CONFIG.REPAIR_PRICE_DISCOUNT ?? 0.6;
  const serviceFee = CONFIG.REPAIR_SERVICE_FEE ?? 5;
  const minCost = CONFIG.MIN_REPAIR_COST ?? 1;

  // Formula dinamis pembulatan bersih integer
  const rawCost = fullMaterialCost * damageRatio * discount + serviceFee;
  const finalCost = Math.max(minCost, Math.round(rawCost));

  return {
    item,
    container,
    selectedSlot,
    durability,
    currentDamage,
    maxDurability,
    currentHealth,
    damagePercent,
    damageRatio,
    materialName: matInfo.name,
    materialCount: matInfo.materialCount,
    fullMaterialCost,
    cost: finalCost,
    isPristine: false,
  };
}

/**
 * Menampilkan GUI Konfirmasi Reparasi Tukang Besi
 */
export function showRepairUI(player) {
  if (!CONFIG.ENABLE_BLACKSMITH_REPAIR) {
    player.sendMessage("§c[Blacksmith] Layanan reparasi pandai besi sedang dinonaktifkan.");
    player.playSound("mob.villager.no");
    return;
  }

  const info = getHeldItemRepairInfo(player);

  if (info.error) {
    const errorForm = new ActionFormData()
      .title("§l§3BENGKEL PANDAI BESI")
      .body(`\n${info.error}\n\n§7Pegang alat atau armor di tangan utama, lalu coba lagi.`)
      .button("§l§c✖ TUTUP", "textures/ui/cancel");

    system.run(() => {
      errorForm.show(player);
    });
    return;
  }

  const displayName = info.item.nameTag || info.item.typeId.replace("minecraft:", "").replace(/_/g, " ").toUpperCase();

  if (info.isPristine) {
    const pristineForm = new ActionFormData()
      .title("§l§3BENGKEL PANDAI BESI")
      .body(
        `\nItem: §e§l${displayName}§r\n` +
          `Kondisi: §a§l${info.maxDurability} / ${info.maxDurability} (100% Prima)§r\n\n` +
          `§aAlat ini masih dalam kondisi mulus sempurna!\n§7Tidak memerlukan perbaikan apa pun.`,
      )
      .button("§l§a✔ SELESAI", "textures/ui/check");

    system.run(() => {
      pristineForm.show(player);
    });
    return;
  }

  const balance = getBalance(player);
  const form = new ActionFormData()
    .title("§l§3BENGKEL PANDAI BESI")
    .body(
      `Item: §e§l${displayName}§r\n` +
        `Kondisi: §c${info.currentHealth}§7 / §a${info.maxDurability} §7(Rusak §c${info.damagePercent}%§7)\n` +
        `Bahan Baku: §f${info.materialCount}x ${info.materialName}\n\n` +
        `Biaya Reparasi: §e§l${formatMoney(info.cost)}§r\n` +
        `Saldo Anda: §a${formatMoney(balance)}\n\n` +
        `§7Enchantment dan nama alat akan tetap utuh seutuhnya.`,
    )
    .button(`§l§a🔧 PERBAIKI SEKARANG\n§r§2Bayar ${formatMoney(info.cost)}`, "textures/ui/check")
    .button("§l§cBATAL", "textures/ui/cancel");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled || res.selection !== 0) return;

      executeRepair(player, info.cost);
    });
  });
}

/**
 * Eksekusi reparasi alat di tangan
 */
export function executeRepair(player, expectedCost = null) {
  if (!CONFIG.ENABLE_BLACKSMITH_REPAIR) {
    player.sendMessage("§c[Blacksmith] Layanan reparasi pandai besi sedang dinonaktifkan.");
    player.playSound("mob.villager.no");
    return false;
  }

  const info = getHeldItemRepairInfo(player);
  if (info.error) {
    player.sendMessage(info.error);
    player.playSound("mob.villager.no");
    return false;
  }

  if (info.isPristine) {
    player.sendMessage("§a[Blacksmith] Alat ini masih dalam kondisi prima (100%), tidak perlu diperbaiki!");
    player.playSound("random.orb");
    return false;
  }

  const cost = expectedCost !== null ? expectedCost : info.cost;
  const balance = getBalance(player);

  if (balance < cost) {
    player.sendMessage(`§c[Blacksmith] Saldo Anda tidak cukup! Butuh: §e${formatMoney(cost)}`);
    player.playSound("mob.villager.no");
    return false;
  }

  // Potong saldo
  addMoney(player, -cost);

  // Perbaiki item (damage disetel ke 0)
  info.durability.damage = 0;
  info.container.setItem(info.selectedSlot, info.item);

  const displayName = info.item.nameTag || info.item.typeId.replace("minecraft:", "").replace(/_/g, " ").toUpperCase();
  player.sendMessage(
    `§a[Blacksmith] Sukses memperbaiki §f${displayName} §ake kondisi prima (100%)!`,
  );
  player.sendMessage(
    `§aBiaya: §e${formatMoney(cost)} §7| Sisa Saldo: §e${formatMoney(getBalance(player))}`,
  );
  player.playSound("random.anvil_use");
  return true;
}
