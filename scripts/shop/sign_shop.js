import { system, ItemStack, SignSide } from "@minecraft/server";
import { addMoney, formatMoney, getBalance } from "../economy/economy.js";
import { showMainShopMenu, showShopUI, showSellMenu } from "./shop_ui.js";

/**
 * Membaca teks dan sisi aktif (Front / Back) dari Sign block
 */
function getSignTextAndSide(block) {
  const signComp = block.getComponent("minecraft:sign");
  if (!signComp) return null;

  // 1. Cek Front side dulu
  let frontText = "";
  try {
    frontText = signComp.getText(SignSide.Front) ?? "";
  } catch (_) {
    try {
      frontText = signComp.getText() ?? "";
    } catch (_) {}
  }

  if (frontText && frontText.trim().length > 0) {
    return { signComp, text: frontText, side: SignSide.Front };
  }

  // 2. Cek Back side jika depan kosong
  let backText = "";
  try {
    backText = signComp.getText(SignSide.Back) ?? "";
  } catch (_) {}

  if (backText && backText.trim().length > 0) {
    return { signComp, text: backText, side: SignSide.Back };
  }

  // 3. Cadangan getRawText
  try {
    const rawFront =
      signComp.getRawText(SignSide.Front) ?? signComp.getRawText();
    if (
      rawFront &&
      typeof rawFront.text === "string" &&
      rawFront.text.trim().length > 0
    ) {
      return { signComp, text: rawFront.text, side: SignSide.Front };
    }
  } catch (_) {}

  return { signComp, text: frontText || "", side: SignSide.Front };
}

/**
 * Listener klik kanan Sign toko fisik ([MARKET], [SELL], [SHOP])
 */
export function handleShopSignInteract(event) {
  const { block, player } = event;
  if (!block || !block.typeId.includes("sign")) return;

  const signData = getSignTextAndSide(block);
  if (!signData || !signData.text) return;

  const { signComp, text, side } = signData;
  const rawLines = text.split("\n");
  const cleanLines = text
    .replace(/§[0-9a-fk-or]/gi, "")
    .split("\n")
    .map((l) => l.trim());

  const header = (cleanLines[0] || "").toUpperCase();

  const isMarket = header === "[MARKET]";
  const isSell = header === "[SELL]";
  const isShop = header === "[SHOP]";

  // Jika bukan sign khusus shop, abaikan (pemain bisa edit sign biasa)
  if (!isMarket && !isSell && !isShop) return;

  // ==========================================
  // PENTING: BATALKAN INTERAKSI VANILLA!
  // Mencegah Minecraft membuka layar edit teks sign atau menaruh item di tangan.
  // ==========================================
  event.cancel = true;

  // ==========================================
  // 1. [MARKET] SIGN -> BUKA GUI SHOP
  // ==========================================
  if (isMarket) {
    system.run(() => {
      let cat = cleanLines[1] ? cleanLines[1].trim() : "All";
      if (!cat) cat = "All";

      // Jika belum diformat warna biru, beri format otomatis
      if (!rawLines[0].includes("§1")) {
        try {
          const formatted = `§1§l[MARKET]\n§0${cat}\n§8(Right Click)\n§7to Open`;
          try {
            signComp.setText(formatted, side);
          } catch (_) {
            signComp.setText(formatted);
          }
          player.sendMessage(
            `§a[Market Sign] Sign toko berhasil didaftarkan! Kategori: §e${cat}`,
          );
          player.playSound("random.levelup");
        } catch (e) {
          console.warn(`[Market Sign Error] ${e}`);
        }
      }

      // Buka GUI Shop
      if (cat.toLowerCase() === "all") {
        showMainShopMenu(player);
      } else {
        showShopUI(player, cat);
      }
    });
    return;
  }

  // ==========================================
  // 2. [SELL] SIGN -> BUKA MENU JUAL
  // ==========================================
  if (isSell) {
    system.run(() => {
      // Jika belum diformat oranye, beri format otomatis
      if (!rawLines[0].includes("§6")) {
        try {
          const formatted = `§6§l[SELL]\n§0All Items\n§8(Right Click)\n§7to Sell`;
          try {
            signComp.setText(formatted, side);
          } catch (_) {
            signComp.setText(formatted);
          }
          player.sendMessage(
            `§a[Sell Sign] Sign jual berhasil didaftarkan! Klik kanan untuk jual barang.`,
          );
          player.playSound("random.levelup");
        } catch (e) {
          console.warn(`[Sell Sign Error] ${e}`);
        }
      }

      // Buka Menu Jual
      showSellMenu(player);
    });
    return;
  }

  // ==========================================
  // 3. [SHOP] SIGN -> BELI INSTAN ITEM SPESIFIK
  // ==========================================
  if (isShop) {
    system.run(() => {
      const isVerified = rawLines[0].includes("§1");

      // Setup pertama kali jika sign baru dipasang
      if (!isVerified) {
        const priceInput = cleanLines[1] || "";
        const amountInput = cleanLines[2] || "1";
        let itemInput = cleanLines[3] || "";

        const price = parseInt(priceInput);
        if (isNaN(price) || price <= 0) {
          player.sendMessage(
            "§c[Error Sign] Baris 2 (Harga) harus angka positif.",
          );
          player.playSound("mob.villager.no");
          return;
        }

        let amount = parseInt(amountInput);
        if (isNaN(amount) || amount <= 0) amount = 1;

        if (!itemInput || itemInput.toLowerCase() === "hand") {
          const inv = player.getComponent("inventory");
          const held = inv?.container?.getItem(player.selectedSlotIndex);
          if (!held) {
            player.sendMessage(
              "§c[Error Sign] Pegang item di tangan utama untuk divalidasi.",
            );
            player.playSound("mob.villager.no");
            return;
          }
          itemInput = held.typeId;
        }

        if (!itemInput.includes(":")) itemInput = "minecraft:" + itemInput;
        const displayName = itemInput.replace("minecraft:", "");

        try {
          const formatted = `§1§l[SHOP]\n§2$ ${price}\n§0Qty: ${amount}\n§8${displayName}`;
          try {
            signComp.setText(formatted, side);
          } catch (_) {
            signComp.setText(formatted);
          }
          player.sendMessage(
            `§a[Shop Sign] Berhasil dibuat: §f${displayName} x${amount} §aseharga §e${formatMoney(price)}`,
          );
          player.playSound("random.levelup");
        } catch (e) {
          player.sendMessage(`§c[Error Sign] Gagal update sign: ${e}`);
        }
        return;
      }

      // Transaksi beli instan
      const price = parseInt(cleanLines[1].replace(/[^0-9]/g, ""));
      const amount = parseInt(cleanLines[2].replace(/[^0-9]/g, ""));
      let itemID = cleanLines[3].trim();

      if (!itemID || isNaN(price) || isNaN(amount)) {
        player.sendMessage("§c[Error Sign] Data toko di papan tidak terbaca.");
        player.playSound("mob.villager.no");
        return;
      }

      if (!itemID.includes(":")) itemID = "minecraft:" + itemID;
      const displayName = itemID.replace("minecraft:", "");

      const balance = getBalance(player);
      if (balance < price) {
        player.sendMessage(
          `§c[Shop] Saldo tidak cukup! Butuh: §e${formatMoney(price)}`,
        );
        player.playSound("mob.villager.no");
        return;
      }

      const inv = player.getComponent("inventory");
      if (!inv || !inv.container || inv.container.emptySlotsCount < 1) {
        player.sendMessage(
          "§c[Shop] Inventory penuh! Sisakan minimal 1 slot kosong.",
        );
        player.playSound("mob.villager.no");
        return;
      }

      addMoney(player, -price);
      try {
        inv.container.addItem(new ItemStack(itemID, amount));
      } catch (e) {
        try {
          player.runCommand(`give @s ${itemID} ${amount}`);
        } catch (err) {
          addMoney(player, price); // Refund jika gagal
          player.sendMessage(
            "§c[Error] Gagal memberikan item. Saldo dikembalikan.",
          );
          return;
        }
      }

      player.sendMessage(
        `§a[Beli Sukses] §f${amount}x ${displayName} §aseharga §e${formatMoney(price)} §7(Sisa: §e${formatMoney(getBalance(player))}§7)`,
      );
      player.playSound("random.orb");
    });
  }
}
