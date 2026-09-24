import { describe, expect, it } from "vitest";
import {
  applyDishAction,
  applySlotAction,
  slotStateOf,
  validateRating,
} from "./meal-state";

describe("slotStateOf", () => {
  it("treats a missing row as unknown, never cooked", () => {
    expect(slotStateOf(undefined)).toBe("unknown");
  });

  it("returns the stored status when a row exists", () => {
    expect(slotStateOf({ status: "planned" })).toBe("planned");
  });
});

describe("applySlotAction: drafts", () => {
  it("creates a draft on an unknown slot", () => {
    expect(applySlotAction("unknown", [], "generateDraft")).toEqual({
      ok: true,
      slot: "draft",
      dishes: [],
    });
  });

  it("replaces the dishes of an existing draft or plan", () => {
    expect(
      applySlotAction("draft", ["draft", "draft"], "generateDraft"),
    ).toEqual({ ok: true, slot: "draft", dishes: ["remove", "remove"] });
    expect(applySlotAction("planned", ["planned"], "generateDraft")).toEqual({
      ok: true,
      slot: "draft",
      dishes: ["remove"],
    });
  });

  it.each([
    "cooked",
    "skipped",
    "ate_out",
  ] as const)("refuses to draft over a recorded %s slot", (state) => {
    expect(applySlotAction(state, ["eaten"], "generateDraft")).toEqual({
      ok: false,
      reason: "slot_already_recorded",
    });
  });

  it("confirms a draft into a plan", () => {
    expect(
      applySlotAction("draft", ["draft", "draft", "draft"], "confirmDraft"),
    ).toEqual({
      ok: true,
      slot: "planned",
      dishes: ["planned", "planned", "planned"],
    });
  });

  it("only confirms a draft", () => {
    expect(applySlotAction("planned", ["planned"], "confirmDraft")).toEqual({
      ok: false,
      reason: "no_draft_to_confirm",
    });
  });

  it("discards a draft back to unknown", () => {
    expect(applySlotAction("draft", ["draft"], "discardDraft")).toEqual({
      ok: true,
      slot: "unknown",
      dishes: ["remove"],
    });
    expect(applySlotAction("unknown", [], "discardDraft")).toEqual({
      ok: false,
      reason: "no_draft_to_discard",
    });
  });
});

describe("applySlotAction: marks", () => {
  it("marking ate_out sets planned dishes to not_eaten (ADR-006)", () => {
    expect(
      applySlotAction("planned", ["planned", "planned"], "markAteOut"),
    ).toEqual({
      ok: true,
      slot: "ate_out",
      dishes: ["not_eaten", "not_eaten"],
    });
  });

  it("marking skipped sets planned dishes to not_eaten", () => {
    expect(applySlotAction("planned", ["planned"], "markSkipped")).toEqual({
      ok: true,
      slot: "skipped",
      dishes: ["not_eaten"],
    });
  });

  it("marking cooked never assumes a planned dish was eaten", () => {
    expect(
      applySlotAction("planned", ["planned", "planned"], "markCooked"),
    ).toEqual({ ok: true, slot: "cooked", dishes: ["planned", "planned"] });
  });

  it("can mark a slot with no row", () => {
    expect(applySlotAction("unknown", [], "markAteOut")).toEqual({
      ok: true,
      slot: "ate_out",
      dishes: [],
    });
  });

  it("removes draft dishes when a draft slot is marked", () => {
    expect(applySlotAction("draft", ["draft", "draft"], "markCooked")).toEqual({
      ok: true,
      slot: "cooked",
      dishes: ["remove", "remove"],
    });
  });

  it("marking skipped means nothing in the slot was eaten", () => {
    expect(
      applySlotAction(
        "cooked",
        ["eaten", "not_eaten", "planned"],
        "markSkipped",
      ),
    ).toEqual({
      ok: true,
      slot: "skipped",
      dishes: ["not_eaten", "not_eaten", "not_eaten"],
    });
  });

  it("leaves per-dish answers alone when correcting the slot", () => {
    expect(
      applySlotAction("cooked", ["eaten", "not_eaten"], "markAteOut"),
    ).toEqual({ ok: true, slot: "ate_out", dishes: ["eaten", "not_eaten"] });
  });

  it("re-marking the same state keeps existing dishes (e.g. a second dish eaten out)", () => {
    expect(applySlotAction("ate_out", ["eaten"], "markAteOut")).toEqual({
      ok: true,
      slot: "ate_out",
      dishes: ["eaten"],
    });
  });

  it("handles a whole week eaten out", () => {
    const week = Array.from({ length: 7 }, () =>
      applySlotAction("planned", ["planned", "planned"], "markAteOut"),
    );
    for (const t of week) {
      expect(t).toEqual({
        ok: true,
        slot: "ate_out",
        dishes: ["not_eaten", "not_eaten"],
      });
    }
  });
});

describe("applyDishAction", () => {
  it.each([
    "planned",
    "eaten",
    "not_eaten",
  ] as const)("marks a %s dish eaten or not eaten", (status) => {
    expect(applyDishAction("cooked", status, "markEaten")).toEqual({
      ok: true,
      status: "eaten",
    });
    expect(applyDishAction("cooked", status, "markNotEaten")).toEqual({
      ok: true,
      status: "not_eaten",
    });
  });

  it("refuses to mark an unconfirmed draft dish", () => {
    expect(applyDishAction("draft", "draft", "markEaten")).toEqual({
      ok: false,
      reason: "dish_is_draft",
    });
  });

  it("refuses to mark a dish eaten in a skipped slot, but allows not eaten", () => {
    expect(applyDishAction("skipped", "not_eaten", "markEaten")).toEqual({
      ok: false,
      reason: "slot_skipped",
    });
    expect(applyDishAction("skipped", "planned", "markNotEaten")).toEqual({
      ok: true,
      status: "not_eaten",
    });
  });
});

describe("validateRating", () => {
  it("accepts 1 to 5 on an eaten dish", () => {
    expect(validateRating("eaten", 1)).toEqual({ ok: true, rating: 1 });
    expect(validateRating("eaten", 5)).toEqual({ ok: true, rating: 5 });
  });

  it.each([0, 6, 3.5, Number.NaN])("rejects rating %s", (rating) => {
    expect(validateRating("eaten", rating)).toEqual({
      ok: false,
      reason: "rating_out_of_range",
    });
  });

  it.each([
    "draft",
    "planned",
    "not_eaten",
  ] as const)("rejects rating a %s dish", (status) => {
    expect(validateRating(status, 4)).toEqual({
      ok: false,
      reason: "dish_not_eaten",
    });
  });
});
