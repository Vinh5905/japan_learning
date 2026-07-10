import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const wantsHelp = process.argv.includes("--help") || process.argv.includes("-h");
const overwrite = process.argv.includes("--overwrite");
const dryRun = process.argv.includes("--dry-run");
const FALLBACK_HAN_VIET_BY_KANJI = {
  一: "NHẤT",
  下: "HẠ",
  不: "BẤT",
  主: "CHỦ",
  事: "SỰ",
  人: "NHÂN",
  亡: "VONG",
  介: "GIỚI",
  仏: "PHẬT",
  伝: "TRUYỀN",
  企: "XÍ",
  任: "NHẬM",
  保: "BẢO",
  候: "HẬU",
  健: "KIỆN",
  免: "MIỄN",
  入: "NHẬP",
  八: "BÁT",
  公: "CÔNG",
  円: "VIÊN",
  刀: "ĐAO",
  分: "PHÂN",
  則: "TẮC",
  券: "KHOÁN",
  刻: "KHẮC",
  剤: "TỄ",
  加: "GIA",
  勤: "CẦN",
  包: "BAO",
  化: "HÓA",
  占: "CHIẾM",
  交: "GIAO",
  収: "THU",
  受: "THỤ",
  口: "KHẨU",
  号: "HIỆU",
  合: "HỢP",
  告: "CÁO",
  呂: "LỮ",
  命: "MỆNH",
  和: "HÒA",
  国: "QUỐC",
  土: "THỔ",
  園: "VIÊN",
  域: "VỰC",
  売: "MẠI",
  変: "BIẾN",
  夜: "DẠ",
  外: "NGOẠI",
  大: "ĐẠI",
  天: "THIÊN",
  夫: "PHU",
  妊: "NHÂM",
  婚: "HÔN",
  定: "ĐỊNH",
  宮: "CUNG",
  宅: "TRẠCH",
  実: "THỰC",
  害: "HẠI",
  局: "CỤC",
  居: "CƯ",
  己: "KỶ",
  市: "THỊ",
  師: "SƯ",
  店: "ĐIẾM",
  座: "TỌA",
  庫: "KHỐ",
  引: "DẪN",
  張: "TRƯƠNG",
  強: "CƯỜNG",
  後: "HẬU",
  御: "NGỰ",
  徹: "TRIỆT",
  急: "CẤP",
  性: "TÍNH",
  悪: "ÁC",
  意: "Ý",
  態: "THÁI",
  懸: "HUYỀN",
  戦: "CHIẾN",
  戸: "HỘ",
  扁: "BIỂN",
  払: "PHẤT",
  投: "ĐẦU",
  抜: "BẠT",
  拳: "QUYỀN",
  指: "CHỈ",
  撃: "KÍCH",
  損: "TỔN",
  支: "CHI",
  放: "PHÓNG",
  教: "GIÁO",
  文: "VĂN",
  新: "TÂN",
  日: "NHẬT",
  明: "MINH",
  書: "THƯ",
  月: "NGUYỆT",
  毎: "MỖI",
  本: "BẢN",
  材: "TÀI",
  査: "TRA",
  棄: "KHÍ",
  業: "NGHIỆP",
  横: "HOÀNH",
  機: "CƠ",
  満: "MÃN",
  準: "CHUẨN",
  清: "THANH",
  水: "THỦY",
  治: "TRỊ",
  炎: "VIÊM",
  然: "NHIÊN",
  爆: "BẠO",
  玄: "HUYỀN",
  状: "TRẠNG",
  災: "TAI",
  疫: "DỊCH",
  病: "BỆNH",
  発: "PHÁT",
  白: "BẠCH",
  的: "ĐÍCH",
  目: "MỤC",
  盾: "THUẪN",
  省: "TỈNH",
  着: "TRỨ",
  知: "TRI",
  科: "KHOA",
  税: "THUẾ",
  稚: "TRĨ",
  窓: "SONG",
  立: "LẬP",
  童: "ĐỒNG",
  策: "SÁCH",
  算: "TOÁN",
  管: "QUẢN",
  米: "MỄ",
  範: "PHẠM",
  純: "THUẦN",
  組: "TỔ",
  結: "KẾT",
  絡: "LẠC",
  統: "THỐNG",
  群: "QUẦN",
  義: "NGHĨA",
  者: "GIẢ",
  育: "DỤC",
  腺: "TUYẾN",
  自: "TỰ",
  至: "CHÍ",
  脱: "THOÁT",
  興: "HƯNG",
  蔵: "TÀNG",
  薬: "DƯỢC",
  虚: "HƯ",
  衣: "Y",
  装: "TRANG",
  複: "PHỨC",
  覚: "GIÁC",
  観: "QUAN",
  考: "KHẢO",
  計: "KẾ",
  言: "NGÔN",
  診: "CHẨN",
  許: "HỨA",
  設: "THIẾT",
  語: "NGỮ",
  説: "THUYẾT",
  識: "THỨC",
  警: "CẢNH",
  譲: "NHƯỢNG",
  負: "PHỤ",
  貨: "HÓA",
  買: "MÃI",
  費: "PHÍ",
  資: "TƯ",
  走: "TẨU",
  足: "TÚC",
  身: "THÂN",
  軽: "KHINH",
  辛: "TÂN",
  先: "TIÊN",
  辺: "BIÊN",
  送: "TỐNG",
  通: "THÔNG",
  道: "ĐẠO",
  遺: "DI",
  遜: "TỐN",
  部: "BỘ",
  関: "QUAN",
  間: "GIAN",
  除: "TRỪ",
  電: "ĐIỆN",
  静: "TĨNH",
  革: "CÁCH",
  頓: "ĐỐN",
  題: "ĐỀ",
  風: "PHONG",
  凍: "ĐỐNG",
  到: "ĐÁO",
  力: "LỰC",
  労: "LAO",
  動: "ĐỘNG",
  名: "DANH",
  子: "TỬ",
  弾: "ĐẠN",
  成: "THÀNH",
  気: "KHÍ",
  法: "PHÁP",
  演: "DIỄN",
  理: "LÝ",
  用: "DỤNG",
  産: "SẢN",
  移: "DI",
  署: "THỰ",
  信: "TÍN",
  件: "KIỆN",
  利: "LỢI",
  欲: "DỤC",
  造: "TẠO",
  重: "TRỌNG",
  食: "THỰC",
  鉄: "THIẾT",
};

if (wantsHelp) {
  console.log(`Backfill vocabulary Han Viet values.

Usage:
  npm run db:backfill-vocab-han-viet
  npm run db:backfill-vocab-han-viet -- --dry-run
  npm run db:backfill-vocab-han-viet -- --overwrite

Options:
  --dry-run     Print the values that would be written without updating data.
  --overwrite   Recompute and replace existing vocabulary Han Viet values.
  --help        Show this help text.

Behavior:
  Reads existing kanji_items.han_viet values, derives each vocabulary word's
  Han Viet from the kanji characters in vocabulary_items.word, and updates only
  vocabulary_items.han_viet. It never clears groups, kanji, vocabulary, attempts,
  or column settings.`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const kanjiReadings = await loadKanjiReadings();
  const vocabularyRows = await loadVocabularyRows();
  const updates = [];
  const unresolved = [];
  const skippedExisting = [];
  const skippedNoKanji = [];

  for (const row of vocabularyRows) {
    if (!overwrite && row.han_viet.trim()) {
      skippedExisting.push(row);
      continue;
    }

    const result = deriveHanViet(row.word, kanjiReadings);

    if (!result.hasKanji) {
      skippedNoKanji.push(row);
      continue;
    }

    if (result.missing.length > 0) {
      unresolved.push({
        id: row.id,
        word: row.word,
        missing: result.missing,
      });
      continue;
    }

    updates.push({
      id: row.id,
      word: row.word,
      oldHanViet: row.han_viet,
      newHanViet: result.hanViet,
    });
  }

  if (!dryRun && updates.length > 0) {
    await pool.query("BEGIN");
    for (const update of updates) {
      await pool.query(
        'UPDATE "vocabulary_items" SET "han_viet" = $1, "updated_at" = NOW() WHERE "id" = $2',
        [update.newHanViet, update.id],
      );
    }
    await pool.query("COMMIT");
  }

  console.log(
    `${dryRun ? "Dry run" : "Backfill complete"}: ${updates.length} vocabulary row(s) ${dryRun ? "would be updated" : "updated"}.`,
  );
  console.log(`Skipped existing Han Viet: ${skippedExisting.length}`);
  console.log(`Skipped words without kanji: ${skippedNoKanji.length}`);
  console.log(`Unresolved words: ${unresolved.length}`);

  if (updates.length > 0) {
    console.log("Updates:");
    for (const update of updates) {
      console.log(
        `- ${update.word}: ${update.oldHanViet || "(empty)"} -> ${update.newHanViet}`,
      );
    }
  }

  if (unresolved.length > 0) {
    console.log("Unresolved details:");
    for (const item of unresolved) {
      console.log(`- ${item.word}: missing ${item.missing.join(", ")}`);
    }
    process.exitCode = 2;
  }
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  if (error?.code === "42703") {
    console.error(
      'Column "vocabulary_items"."han_viet" does not exist. Run Prisma migration first.',
    );
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function loadKanjiReadings() {
  const { rows } = await pool.query(
    'SELECT "kanji", "han_viet" FROM "kanji_items" ORDER BY "kanji"',
  );
  const readings = new Map(Object.entries(FALLBACK_HAN_VIET_BY_KANJI));

  for (const row of rows) {
    const kanji = String(row.kanji ?? "").trim();
    const hanViet = normalizeHanViet(row.han_viet);

    if (kanji && hanViet) {
      readings.set(kanji, hanViet);
    }
  }

  return readings;
}

async function loadVocabularyRows() {
  const where = overwrite ? "" : 'WHERE COALESCE("han_viet", \'\') = \'\'';
  const { rows } = await pool.query(`
    SELECT "id", "word", COALESCE("han_viet", '') AS "han_viet"
    FROM "vocabulary_items"
    ${where}
    ORDER BY "kanji_item_id", "order", "word"
  `);

  return rows.map((row) => ({
    id: String(row.id),
    word: String(row.word ?? ""),
    han_viet: String(row.han_viet ?? ""),
  }));
}

function deriveHanViet(word, kanjiReadings) {
  const readings = [];
  const missing = [];
  let hasKanji = false;

  for (const char of word) {
    if (!isHanCharacter(char)) {
      continue;
    }

    hasKanji = true;
    const reading = kanjiReadings.get(char);

    if (reading) {
      readings.push(reading);
    } else if (!missing.includes(char)) {
      missing.push(char);
    }
  }

  return {
    hasKanji,
    hanViet: readings.join(" "),
    missing,
  };
}

function normalizeHanViet(value) {
  return String(value ?? "")
    .split(/[,/;|\n]/u)[0]
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("vi-VN");
}

function isHanCharacter(char) {
  return /\p{Script=Han}/u.test(char);
}
