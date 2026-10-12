import { system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { addMoney, formatMoney, getBalance } from "../economy/economy.js";
import {
  getTexture,
  getSellPrice,
  getHeldItemSellInfo,
  handleSellHand,
  getInventorySellableItems,
  sellInventoryItem,
} from "./shop.js";
import { SERVER_SHOP_ITEMS, SHOP_CATEGORIES } from "./shop_items.js";

// ==========================================
// 1. MAIN SHOP MENU
// ==========================================
export function showMainShopMenu(player) {
  const balance = getBalance(player);
  const form = new ActionFormData()
    .title("§l§2ECONOMY & SHOP")
    .body(
      `§7Saldo Uang Anda:\n§a§l${formatMoney(balance)}\n\n§r§7Silakan pilih menu transaksi:`,
    )
    .button(
      "§l§2🛒 BELI BARANG\n§r§8Pilih dari katalog shop",
      "textures/ui/icon_recipe_item",
    )
    .button(
      "§l§6💰 JUAL ITEM DI TANGAN\n§r§8Jual item yang sedang dipegang",
      "textures/items/gold_ingot",
    )
    .button(
      "§l§e📦 JUAL DARI INVENTORY\n§r§8Pilih item dalam tas untuk dijual",
      "textures/ui/inventory_icon",
    )
    .button(
      "§l§bℹ️ CEK HARGA TANGAN\n§r§8Lihat nilai jual item di tangan",
      "textures/ui/magnifying_glass",
    )
    .button("§l§c✖ TUTUP", "textures/ui/cancel");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      switch (res.selection) {
        case 0:
          showCategoryPicker(player);
          break;
        case 1:
          showSellHandUI(player);
          break;
        case 2:
          showSellInventoryUI(player);
          break;
        case 3:
          showHeldItemPriceUI(player);
          break;
        default:
          break;
      }
    });
  });
}

// ==========================================
// 2. PILIH KATEGORI BELI
// ==========================================
export function showCategoryPicker(player) {
  const form = new ActionFormData()
    .title("§l§2KATALOG SHOP")
    .body(
      `Saldo Anda: §a${formatMoney(getBalance(player))}\n§7Pilih kategori barang:`,
    );

  for (const cat of SHOP_CATEGORIES) {
    form.button(`§l§8${cat.name}`, cat.icon);
  }
  form.button("§l§c⬅ KEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      if (res.selection === SHOP_CATEGORIES.length) {
        showMainShopMenu(player);
        return;
      }

      const selectedCat = SHOP_CATEGORIES[res.selection];
      showShopUI(player, selectedCat.id);
    });
  });
}

// ==========================================
// 3. DAFTAR BARANG DI KATEGORI
// ==========================================
export function showShopUI(player, category = "all") {
  const currentCat = SHOP_CATEGORIES.find(
    (c) => c.id.toLowerCase() === category.toLowerCase(),
  );
  const catTitle = currentCat ? currentCat.name.toUpperCase() : "SEMUA BARANG";

  const filteredItems = SERVER_SHOP_ITEMS.filter((item) => {
    if (category.toLowerCase() === "all") return true;
    return (
      item.category && item.category.toLowerCase() === category.toLowerCase()
    );
  });

  const form = new ActionFormData()
    .title(`§l§2SHOP: ${catTitle}`)
    .body(
      `Saldo: §a${formatMoney(getBalance(player))}\n§7Klik barang untuk membeli:`,
    );

  for (const item of filteredItems) {
    form.button(`${item.name}\n§e${formatMoney(item.price)}`, getTexture(item));
  }
  form.button("§l§c⬅ KEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      if (res.selection === filteredItems.length) {
        showCategoryPicker(player);
        return;
      }

      const selectedItem = filteredItems[res.selection];
      buyConfirmation(player, selectedItem, category);
    });
  });
}

// ==========================================
// 4. KONFIRMASI BELI
// ==========================================
function buyConfirmation(player, item, returnCategory) {
  const balance = getBalance(player);

  const form = new ModalFormData()
    .title(`Beli: ${item.name}`)
    .slider(
      `Jumlah (Harga: ${formatMoney(item.price)}/pcs)\nSaldo Anda: ${formatMoney(balance)}`,
      1,
      64,
      1,
      1,
    )
    .toggle("Konfirmasi Pembelian?", true);

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) {
        showShopUI(player, returnCategory);
        return;
      }

      const [amount, confirmed] = res.formValues;
      if (!confirmed) {
        showShopUI(player, returnCategory);
        return;
      }

      const totalPrice = item.price * amount;
      const currentBalance = getBalance(player);

      if (currentBalance < totalPrice) {
        player.sendMessage(
          `§c[Shop] Saldo tidak cukup! Butuh: ${formatMoney(totalPrice)}`,
        );
        player.playSound("mob.villager.no");
        showShopUI(player, returnCategory);
        return;
      }

      const inventory = player.getComponent("inventory");
      if (inventory?.container?.emptySlotsCount < 1) {
        player.sendMessage(
          "§c[Shop] Inventory penuh! Sisakan minimal 1 slot kosong.",
        );
        player.playSound("mob.villager.no");
        showShopUI(player, returnCategory);
        return;
      }

      addMoney(player, -totalPrice);
      try {
        inventory.container.addItem(new ItemStack(item.id, amount));
      } catch (e) {
        try {
          player.runCommand(`give @s ${item.id} ${amount}`);
        } catch (err) {
          addMoney(player, totalPrice);
          player.sendMessage(
            "§c[Error] Gagal memberikan item. Saldo dikembalikan.",
          );
          showShopUI(player, returnCategory);
          return;
        }
      }

      player.sendMessage(
        `§a[Sukses] Membeli §f${amount}x ${item.name} §aseharga §e${formatMoney(totalPrice)}§a.`,
      );
      player.sendMessage(`§aSisa Saldo: §e${formatMoney(getBalance(player))}`);
      player.playSound("random.orb");

      showShopUI(player, returnCategory);
    });
  });
}

// ==========================================
// 5. MENU JUAL LANGSUNG (UNTUK SIGN [SELL])
// ==========================================
export function showSellMenu(player) {
  const form = new ActionFormData()
    .title("§l§6MENU JUAL BARANG")
    .body(
      `Saldo Anda: §a${formatMoney(getBalance(player))}\n§7Pilih metode penjualan:`,
    )
    .button(
      "§l§6💰 JUAL ITEM DI TANGAN\n§r§8Jual item yang sedang dipegang",
      "textures/items/gold_ingot",
    )
    .button(
      "§l§e📦 JUAL DARI INVENTORY\n§r§8Pilih item dalam tas untuk dijual",
      "textures/ui/inventory_icon",
    )
    .button(
      "§l§bℹ️ CEK HARGA TANGAN\n§r§8Lihat nilai jual item di tangan",
      "textures/ui/magnifying_glass",
    )
    .button("§l§c✖ TUTUP", "textures/ui/cancel");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;
      if (res.selection === 0) showSellHandUI(player);
      else if (res.selection === 1) showSellInventoryUI(player);
      else if (res.selection === 2) showHeldItemPriceUI(player);
    });
  });
}

// ==========================================
// JUAL ITEM DI TANGAN (UI)
// ==========================================
export function showSellHandUI(player) {
  const info = getHeldItemSellInfo(player);

  if (info.error) {
    const errorForm = new ActionFormData()
      .title("§l§6JUAL ITEM DI TANGAN")
      .body(
        `\n${info.error}\n\n§7Pegang item yang ingin dijual di tangan utama terlebih dahulu.`,
      )
      .button("§l§c⬅ KEMBALI", "textures/ui/arrow_left");

    system.run(() => {
      errorForm.show(player).then(() => showMainShopMenu(player));
    });
    return;
  }

  const { item, shopItem, unitSellPrice, totalSellPrice, amount } = info;
  const form = new ActionFormData()
    .title("§l§6KONFIRMASI JUAL")
    .body(
      `Item: §e§l${shopItem.name}§r\n` +
        `Jumlah di Tangan: §f${amount}x\n` +
        `Harga Satuan: §a${formatMoney(unitSellPrice)}\n` +
        `Total Nilai: §e§l${formatMoney(totalSellPrice)}\n\n` +
        `§7Pilih aksi penjualan:`,
    )
    .button(
      `§l§aJUAL SEMUA (${amount}x)\n§r§2Dapat ${formatMoney(totalSellPrice)}`,
      "textures/ui/check",
    )
    .button(
      `§l§eJUAL 1 PCS\n§r§2Dapat ${formatMoney(unitSellPrice)}`,
      "textures/items/gold_nugget",
    )
    .button("§l§cBATAL / KEMBALI", "textures/ui/cancel");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled || res.selection === 2) {
        showMainShopMenu(player);
        return;
      }

      if (res.selection === 0) {
        handleSellHand(player, amount);
      } else if (res.selection === 1) {
        handleSellHand(player, 1);
      }

      showMainShopMenu(player);
    });
  });
}

// ==========================================
// 6. JUAL DARI INVENTORY (UI LIST)
// ==========================================
export function showSellInventoryUI(player) {
  const sellableList = getInventorySellableItems(player);

  if (sellableList.length === 0) {
    const emptyForm = new ActionFormData()
      .title("§l§eJUAL DARI INVENTORY")
      .body(
        "\n§cTidak ada barang yang laku dijual di dalam inventory Anda saat ini.\n",
      )
      .button("§l§c⬅ KEMBALI", "textures/ui/arrow_left");

    system.run(() => {
      emptyForm.show(player).then(() => showMainShopMenu(player));
    });
    return;
  }

  const form = new ActionFormData()
    .title("§l§ePILIH ITEM UNTUK DIJUAL")
    .body("§7Klik item dari tas Anda yang ingin dijual:");

  for (const item of sellableList) {
    form.button(
      `${item.name} (${item.totalAmount}x)\n§aTotal: ${formatMoney(item.totalValue)}`,
      item.texture,
    );
  }
  form.button("§l§c⬅ KEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled) return;

      if (res.selection === sellableList.length) {
        showMainShopMenu(player);
        return;
      }

      const selected = sellableList[res.selection];
      confirmSellInventoryItem(player, selected);
    });
  });
}

function confirmSellInventoryItem(player, itemInfo) {
  const form = new ActionFormData()
    .title(`Jual: ${itemInfo.name}`)
    .body(
      `Item: §e§l${itemInfo.name}§r\n` +
        `Total di Inventory: §f${itemInfo.totalAmount}x\n` +
        `Harga Satuan: §a${formatMoney(itemInfo.unitPrice)}\n` +
        `Total Nilai: §e§l${formatMoney(itemInfo.totalValue)}\n\n` +
        `§7Pilih kuantitas jual:`,
    )
    .button(
      `§l§aJUAL SEMUA (${itemInfo.totalAmount}x)\n§r§2Dapat ${formatMoney(itemInfo.totalValue)}`,
      "textures/ui/check",
    )
    .button(`§l§eJUAL 1 STACK (Max 64x)`, "textures/items/gold_ingot")
    .button("§l§cBATAL / KEMBALI", "textures/ui/cancel");

  system.run(() => {
    form.show(player).then((res) => {
      if (res.canceled || res.selection === 2) {
        showSellInventoryUI(player);
        return;
      }

      if (res.selection === 0) {
        sellInventoryItem(player, itemInfo.typeId, true);
      } else if (res.selection === 1) {
        sellInventoryItem(player, itemInfo.typeId, false);
      }

      showSellInventoryUI(player);
    });
  });
}

// ==========================================
// 7. CEK HARGA ITEM DI TANGAN (UI)
// ==========================================
export function showHeldItemPriceUI(player) {
  const info = getHeldItemSellInfo(player);

  let bodyText = "";
  if (info.error) {
    bodyText = `\n${info.error}\n\n§7Pegang item di tangan utama untuk melihat harga.`;
  } else {
    bodyText =
      `\nItem: §e§l${info.shopItem.name}§r\n` +
      `Kategori: §f${info.shopItem.category}\n` +
      `Harga Beli di Shop: §c${formatMoney(info.shopItem.price)}\n` +
      `Harga Jual: §a${formatMoney(info.unitSellPrice)} / pcs\n` +
      `Total Nilai di Tangan (${info.amount}x): §e§l${formatMoney(info.totalSellPrice)}§r\n`;
  }

  const form = new ActionFormData()
    .title("§l§bINFORMASI HARGA")
    .body(bodyText)
    .button("§l§c⬅ KEMBALI", "textures/ui/arrow_left");

  system.run(() => {
    form.show(player).then(() => showMainShopMenu(player));
  });
}
