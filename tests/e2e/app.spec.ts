import { expect, test } from "@playwright/test";

test.skip(
  process.env.ALLOW_DATABASE_RESET !== "true",
  "E2E tests reset database data. Set ALLOW_DATABASE_RESET=true only for disposable data.",
);

const sampleJson = JSON.stringify(
  [
    {
      kanji: "井",
      han_viet: "TỈNH",
      meaning: "cái giếng",
      kun: ["い"],
      on: ["ショウ"],
      vocabulary: [
        {
          word: "井戸",
          han_viet: "TỈNH HỘ",
          type: "danh từ",
          reading: "いど",
          meaning: "giếng nước",
          example: {
            japanese: [
              { text: "井戸", reading: "いど", is_target: true },
              { text: "水", reading: "みず" },
              { text: "を" },
              { text: "飲", reading: "の" },
              { text: "んだ" },
            ],
            vietnamese: "Tôi đã uống nước giếng",
          },
        },
      ],
    },
  ],
  null,
  2,
);

const moveJson = JSON.stringify([
  {
    kanji: "井",
    han_viet: "TỈNH",
    meaning: "cái giếng",
    kun: ["い"],
    on: ["ショウ"],
    vocabulary: [
      {
        word: "井戸",
        han_viet: "TỈNH HỘ",
        type: "danh từ",
        reading: "いど",
        meaning: "giếng nước",
        example: {
          japanese: [{ text: "井戸", reading: "いど", is_target: true }],
          vietnamese: "Nước giếng.",
        },
      },
    ],
  },
  {
    kanji: "日",
    han_viet: "NHẬT",
    meaning: "ngày",
    kun: ["ひ"],
    on: ["ニチ"],
    vocabulary: [
      {
        word: "日本",
        han_viet: "NHẬT BẢN",
        type: "danh từ",
        reading: "にほん",
        meaning: "Nhật Bản",
        example: {
          japanese: [{ text: "日本", reading: "にほん", is_target: true }],
          vietnamese: "Nhật Bản.",
        },
      },
      {
        word: "今日",
        han_viet: "KIM NHẬT",
        type: "danh từ",
        reading: "きょう",
        meaning: "hôm nay",
        example: {
          japanese: [{ text: "今日", reading: "きょう", is_target: true }],
          vietnamese: "Hôm nay.",
        },
      },
    ],
  },
]);

test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset", {
    headers: { "x-kanji-reset-confirm": "true" },
  });
});

test("imports JSON, studies, tests answers, and collapses a group", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add" }).click();
  await page.getByLabel("Paste JSON here").fill(sampleJson);
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("JSON is valid")).toBeVisible();
  await expect(page.getByText("New kanji: 1")).toBeVisible();
  await expect(
    page.locator(".review-table").getByRole("cell", { name: "井戸", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Import completed.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "井戸", exact: true })).toBeVisible();
  await expect(page.getByText("danh từ")).toBeVisible();
  await expect(page.locator("ruby rt").first()).toHaveText("いど");
  await expect(page.locator(".target-ruby").first()).toContainText("井戸");

  await page.getByRole("button", { name: "Reading Test" }).click();
  await page.getByLabel("Answer for 井戸").fill("wrong");
  await page.getByLabel("Answer for 井戸").press("Enter");
  await expect(page.locator(".answer-wrong")).toHaveCount(1);
  await page.getByTitle("Reveal row").click();
  await expect(page.locator(".example-vietnamese")).toHaveText(
    "Tôi đã uống nước giếng",
  );
  await page.getByTitle("Hide row").click();
  await expect(page.locator(".example-vietnamese")).toHaveCount(0);

  await page.getByLabel("Answer for 井戸").fill("いど");
  await page.getByLabel("Answer for 井戸").press("Enter");
  await expect(page.locator(".answer-correct")).toHaveCount(1);
  await expect(page.locator(".status-correct")).toHaveCount(1);
  await expect(page.locator(".example-vietnamese")).toHaveText(
    "Tôi đã uống nước giếng",
  );

  await page.reload();
  await page.getByRole("button", { name: "Reading Test" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("いど");
  await expect(page.locator(".answer-correct")).toHaveCount(1);

  await page.getByRole("button", { name: "Writing Test" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("");
  await expect(page.locator(".answer-correct")).toHaveCount(0);
  await page.getByLabel("Answer for 井戸").fill("井戸");
  await page.getByLabel("Answer for 井戸").press("Enter");
  await expect(page.locator(".answer-correct")).toHaveCount(1);

  await page.getByTitle("Collapse group").click();
  await expect(page.locator(".collapsed-row .group-number-cell")).toHaveText("1");
  await expect(page.locator(".collapsed-content").getByText("井", { exact: true })).toBeVisible();
});

test("moves kanji and vocabulary with up and down controls", async ({ page, request }) => {
  await request.post("/api/import/commit", {
    data: { raw: moveJson },
  });

  await page.goto("/");
  await expect(page.locator(".group-number-cell")).toHaveCount(2);

  await page.getByTitle("Move kanji 日 up").click();
  await expect(page.locator(".group-number-cell")).toHaveCount(1);

  await page.getByTitle("Move vocabulary 日本 down").click();
  await expect(
    page.locator("tbody tr").nth(1).getByRole("cell", { name: "今日", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("tbody tr").nth(2).getByRole("cell", { name: "日本", exact: true }),
  ).toBeVisible();
});

test("edits and deletes kanji or word with explicit confirmation", async ({ page, request }) => {
  await request.post("/api/import/commit", {
    data: { raw: sampleJson },
  });

  await page.goto("/");

  await page.getByTitle("Edit word 井戸").click();
  await page.getByLabel("Edit word meaning").fill("temporary meaning");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("cell", { name: "giếng nước", exact: true })).toBeVisible();
  await expect(page.getByText("temporary meaning")).toHaveCount(0);

  await page.getByTitle("Edit word 井戸").click();
  await page.getByLabel("Edit word type").click();
  await page.getByRole("option", { name: "tính từ na" }).click();
  await page.getByLabel("Edit reading").fill("いど");
  await page.getByLabel("Edit word meaning").fill("updated word meaning");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Word updated.")).toBeVisible();
  await expect(
    page.getByLabel("Kanji table").getByText("tính từ na", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "updated word meaning", exact: true }),
  ).toBeVisible();

  await page.getByTitle("Edit kanji 井").click();
  await page.getByLabel("Edit kanji meaning").fill("updated kanji meaning");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Kanji updated.")).toBeVisible();
  await expect(page.getByText("updated kanji meaning")).toBeVisible();

  await page.getByTitle("Delete word 井戸").click();
  await expect(page.getByText("Level: Word")).toBeVisible();
  await expect(page.getByText("Item: 井戸")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Word deleted.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "井戸", exact: true })).toHaveCount(0);

  await page.getByTitle("Delete kanji 井").click();
  await expect(page.getByText("Level: Kanji Details")).toBeVisible();
  await expect(page.getByText("Item: 井")).toBeVisible();
  await expect(
    page.getByText("Deleting this kanji also deletes all words inside it."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Kanji deleted.")).toBeVisible();
  await expect(page.getByText("No kanji imported yet.")).toBeVisible();
});

test("keeps reading and writing answer states separate and resets by status", async ({ page, request }) => {
  await request.post("/api/import/commit", {
    data: { raw: sampleJson },
  });

  await page.goto("/");

  await page.getByRole("button", { name: "Reading Test" }).click();
  await page.getByLabel("Answer for 井戸").fill("wrong");
  await page.getByLabel("Answer for 井戸").press("Enter");
  await expect(page.locator(".answer-wrong")).toHaveCount(1);
  await expect(page.locator(".status-wrong")).toHaveCount(1);

  await page.reload();
  await page.getByRole("button", { name: "Reading Test" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("wrong");
  await expect(page.locator(".answer-wrong")).toHaveCount(1);

  await page.getByRole("button", { name: "Reset Wrong" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("");
  await expect(page.locator(".answer-wrong")).toHaveCount(0);

  await page.getByLabel("Answer for 井戸").fill("いど");
  await page.getByLabel("Answer for 井戸").press("Enter");
  await expect(page.locator(".answer-correct")).toHaveCount(1);

  await page.getByRole("button", { name: "Writing Test" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("");
  await expect(page.locator(".answer-correct")).toHaveCount(0);
  await page.getByLabel("Answer for 井戸").fill("井戸");
  await page.getByLabel("Answer for 井戸").press("Enter");
  await expect(page.locator(".answer-correct")).toHaveCount(1);

  await page.getByRole("button", { name: "Reading Test" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("いど");
  await expect(page.locator(".answer-correct")).toHaveCount(1);
  await page.getByRole("button", { name: "Reset Correct" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("");

  await page.getByRole("button", { name: "Writing Test" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("井戸");
  await page.getByRole("button", { name: "Reset All" }).click();
  await expect(page.getByLabel("Answer for 井戸")).toHaveValue("");
});
