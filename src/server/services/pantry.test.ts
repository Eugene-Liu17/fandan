import { describe, expect, it } from "vitest";
import { createUser, listEvents } from "@/server/testing/db";
import { addPantryItems, removePantryItem } from "./pantry";
import { getWeekContext } from "./week-context";

describe("addPantryItems", () => {
  it("normalizes names and logs what was added", async () => {
    const user = await createUser();
    const { added, skipped } = await addPantryItems(user.id, {
      names: ["五花肉", " 西红柿 ", "泡椒"],
      quantity: "some",
    });
    expect(added.map((p) => [p.rawName, p.ingredientKey, p.quantity])).toEqual([
      ["五花肉", "pork_belly", "some"],
      ["西红柿", "tomato", "some"],
      ["泡椒", null, "some"],
    ]);
    expect(skipped).toEqual([]);
    const [event] = await listEvents(user.id);
    expect(event).toMatchObject({
      type: "pantry_updated",
      payload: { added: ["五花肉", "西红柿", "泡椒"] },
    });
  });

  it("skips items already in the pantry, matching through aliases", async () => {
    const user = await createUser();
    await addPantryItems(user.id, { names: ["番茄", "泡椒"] });
    const { added, skipped } = await addPantryItems(user.id, {
      names: ["西红柿", "泡椒", "鸡蛋", "鸡蛋", "  "],
    });
    expect(added.map((p) => p.rawName)).toEqual(["鸡蛋"]);
    expect(skipped).toEqual(["西红柿", "泡椒", "鸡蛋"]);
  });

  it("writes no event when nothing was added", async () => {
    const user = await createUser();
    await addPantryItems(user.id, { names: ["鸡蛋"] });
    await addPantryItems(user.id, { names: ["鸡蛋"] });
    expect(await listEvents(user.id)).toHaveLength(1);
  });

  it("rejects an empty list", async () => {
    const user = await createUser();
    await expect(addPantryItems(user.id, { names: [] })).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});

describe("removePantryItem", () => {
  it("removes an item from the active pantry and logs it", async () => {
    const user = await createUser();
    const { added } = await addPantryItems(user.id, { names: ["鸡蛋", "姜"] });
    const egg = added[0];
    if (!egg) throw new Error("no item");

    await removePantryItem(user.id, egg.id);
    const ctx = await getWeekContext(user.id);
    expect(ctx.pantry.map((p) => p.rawName)).toEqual(["姜"]);
    expect((await listEvents(user.id)).at(-1)?.payload).toEqual({
      removed: ["鸡蛋"],
    });
  });

  it("fails for an item that is already removed", async () => {
    const user = await createUser();
    const { added } = await addPantryItems(user.id, { names: ["鸡蛋"] });
    const id = added[0]?.id ?? "";
    await removePantryItem(user.id, id);
    await expect(removePantryItem(user.id, id)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
