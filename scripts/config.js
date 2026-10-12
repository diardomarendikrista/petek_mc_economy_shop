// ==========================================
// CONFIGURATION: PETEK ECONOMY & SHOP (SP)
// ==========================================

export const CONFIG = {
  // Command Prefix di Chat (Contoh: "!shop", "!bal", "!sell")
  CMD_PREFIX: "!",

  // ==========================================
  // PENGATURAN AKSES TOKO FISIK (SIGN) VS GLOBAL
  // ==========================================
  // Jika false: Pemain WAJIB datang ke toko fisik dan klik Sign ([MARKET], [SHOP], [SELL]).
  // Jika true: Menu Shop bisa dibuka dari mana saja lewat item trigger / command !shop.
  ALLOW_GLOBAL_SHOP_ACCESS: false,

  // Jika false: Command !sell hanya bisa digunakan jika dekat/di toko fisik (atau via Sign [SELL]).
  ALLOW_GLOBAL_SELL_COMMAND: false,

  // Item yang bisa dipakai untuk klik kanan / tahan layar buka menu Shop (jika ALLOW_GLOBAL_SHOP_ACCESS = true)
  TRIGGER_ITEMS: ["minecraft:emerald", "minecraft:stick"],

  // Cooldown buka menu via item (milidetik) agar tidak klik ganda
  TRIGGER_COOLDOWN_MS: 1000,

  // Pengali harga jual dari harga beli (0.6 = 60% harga beli)
  SELL_PRICE_MULTIPLIER: 0.6,

  // Modal saldo awal saat pertama kali main di world
  ENABLE_STARTER_MONEY: true,
  STARTER_MONEY_AMOUNT: 100,

  // Izinkan cheat command untuk single player (!addmoney, !setmoney)
  ENABLE_CHEAT_COMMANDS: true,

  // Scoreboard Currency Info
  CURRENCY: "money",
  DISPLAY_NAME: "§a§lMONEY",
  CURRENCY_SYMBOL: "$",
};
