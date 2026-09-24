import { describe, expect, it } from "vitest";
import { parsePlainDate } from "@/domain/date";
import { db } from "@/server/db/client";
import { pantryItems, tasteFacts } from "@/server/db/schema";
import { createSlot, createUser } from "@/server/testing/db";
import { ServiceError } from "./errors";
import { markSlot } from "./meals";
import { getWeekContext } from "./week-context";

// 2026-09-24 22:30 in Toronto (EDT) is already 2026-09-25 in UTC.
const lateEveningToronto = new Date("2026-09-25T02:30:00.000Z");

const slotOf = (
  ctx: Awaited<ReturnType<typeof getWeekContext>>,
  date: string,
  slot: string,
) => ctx.days.find((d) => d.date === date)?.slots.find((s) => s.slot === slot);

describe("getWeekContext", () => {
  it("resolves today and the week in the user's time zone", async () => {
    const user = await createUser({ timezone: "America/Toronto" });
    const ctx = await getWeekContext(user.id, { now: lateEveningToronto });
    expect(ctx.today).toBe("2026-09-24");
    expect(ctx.week).toEqual({ start: "2026-09-21", end: "2026-09-28" });
    expect(ctx.days.map((d) => d.date)).toHaveLength(7);
  });

  it("reads another week when asked (e.g. planning next week)", async () => {
    const user = await createUser();
    await createSlot(
      user.id,
      parsePlainDate("2026-09-30"),
      "dinner",
      "planned",
    );
    const ctx = await getWeekContext(user.id, {
      now: lateEveningToronto,
      weekOf: "2026-09-30",
    });
    expect(ctx.today).toBe("2026-09-24");
    expect(ctx.week).toEqual({ start: "2026-09-28", end: "2026-10-05" });
    expect(slotOf(ctx, "2026-09-30", "dinner")?.state).toBe("planned");
    await expect(
      getWeekContext(user.id, { weekOf: "2026-02-30" }),
    ).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("honors a Sunday week start", async () => {
    const user = await createUser({ weekStartsOn: 0 });
    const ctx = await getWeekContext(user.id, { now: lateEveningToronto });
    expect(ctx.week.start).toBe("2026-09-20");
  });

  it("renders every slot with no record as unknown, never cooked", async () => {
    const user = await createUser();
    const ctx = await getWeekContext(user.id, { now: lateEveningToronto });
    const states = ctx.days.flatMap((d) => d.slots.map((s) => s.state));
    expect(states).toHaveLength(21);
    expect(new Set(states)).toEqual(new Set(["unknown"]));
  });

  it("returns stored slots with their dishes in order", async () => {
    const user = await createUser();
    await createSlot(
      user.id,
      parsePlainDate("2026-09-22"),
      "dinner",
      "cooked",
      [
        { dishName: "红烧肉", status: "eaten", rating: 5 },
        { dishName: "清炒菠菜", status: "not_eaten" },
      ],
    );
    const ctx = await getWeekContext(user.id, { now: lateEveningToronto });
    const dinner = slotOf(ctx, "2026-09-22", "dinner");
    expect(dinner?.state).toBe("cooked");
    expect(dinner?.dishes.map((d) => [d.dishName, d.status, d.rating])).toEqual(
      [
        ["红烧肉", "eaten", 5],
        ["清炒菠菜", "not_eaten", null],
      ],
    );
    expect(slotOf(ctx, "2026-09-22", "lunch")?.state).toBe("unknown");
  });

  it("includes pantry, restrictions (falling back to text), and preferences", async () => {
    const user = await createUser({ householdSize: 3 });
    await db.insert(pantryItems).values([
      { userId: user.id, rawName: "鸡蛋", ingredientKey: "egg" },
      {
        userId: user.id,
        rawName: "已用完",
        removedAt: new Date("2026-09-20T00:00:00Z"),
      },
    ]);
    await db.insert(tasteFacts).values([
      {
        userId: user.id,
        type: "restriction",
        content: "花生过敏",
        payload: { kind: "allergen", tag: "peanut" },
        source: "choice",
      },
      {
        userId: user.id,
        type: "restriction",
        content: "不吃榴莲",
        payload: { kind: "broken" },
        source: "stated",
      },
      {
        userId: user.id,
        type: "preference",
        content: "喜欢酸辣",
        source: "stated",
      },
      {
        userId: user.id,
        type: "restriction",
        content: "已撤回",
        payload: { kind: "term", text: "香菜" },
        source: "stated",
        deletedAt: new Date("2026-09-20T00:00:00Z"),
      },
    ]);

    const ctx = await getWeekContext(user.id, { now: lateEveningToronto });
    expect(ctx.user.dishesPerMeal).toBe(3);
    expect(ctx.pantry.map((p) => p.rawName)).toEqual(["鸡蛋"]);
    const [peanut, durian] = ctx.restrictions.map((r) => r.restrictions);
    // The stored payload comes first, then what the wording adds.
    expect(peanut?.[0]).toEqual({ kind: "allergen", tag: "peanut" });
    expect(peanut).toContainEqual({ kind: "term", text: "花生过敏" });
    expect(durian).toEqual([
      { kind: "term", text: "不吃榴莲" },
      { kind: "term", text: "榴莲" },
    ]);
    expect(ctx.preferences.map((p) => p.content)).toEqual(["喜欢酸辣"]);
  });

  it("fails with not_found for an unknown user", async () => {
    await expect(
      getWeekContext("00000000-0000-4000-8000-00000000dead"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      getWeekContext("00000000-0000-4000-8000-00000000dead"),
    ).rejects.toBeInstanceOf(ServiceError);
  });
});

describe("SPEC acceptance: calendar edits are visible to the next chat turn", () => {
  it("a slot marked through the service is what the next read returns", async () => {
    const user = await createUser();
    await createSlot(
      user.id,
      parsePlainDate("2026-09-23"),
      "dinner",
      "planned",
      [{ dishName: "红烧肉", status: "planned" }],
    );

    // The calendar marks the slot as eaten out...
    await markSlot(user.id, {
      date: "2026-09-23",
      slot: "dinner",
      action: "markAteOut",
      dishes: [{ name: "酸菜鱼" }],
    });

    // ...and the next chat turn's context read sees exactly that.
    const ctx = await getWeekContext(user.id, { now: lateEveningToronto });
    const dinner = slotOf(ctx, "2026-09-23", "dinner");
    expect(dinner?.state).toBe("ate_out");
    expect(dinner?.dishes.map((d) => [d.dishName, d.status])).toEqual([
      ["红烧肉", "not_eaten"],
      ["酸菜鱼", "eaten"],
    ]);
  });
});
