import { describe, expect, it } from "vitest";
import { defaultDishesPerMeal } from "./household";

describe("defaultDishesPerMeal", () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 4],
    [12, 4],
  ])("household of %i → %i dishes", (size, dishes) => {
    expect(defaultDishesPerMeal(size)).toBe(dishes);
  });

  it.each([0, -1, 2.5, Number.NaN])("rejects %s", (size) => {
    expect(() => defaultDishesPerMeal(size)).toThrow(RangeError);
  });
});
