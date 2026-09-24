import { describe, expect, it } from "vitest";
import { addDays, parsePlainDate } from "./date";
import { dedupeCandidates, type EatenDish, findRepeat } from "./dedupe";
import type { RecipeFeatures } from "./features";
import { defaultFeatures, recipe } from "./testing/fixtures";

const target = parsePlainDate("2026-09-30");
const N = 14;

function eaten(
  daysFromTarget: number,
  patch: Partial<EatenDish> = {},
): EatenDish {
  return {
    date: addDays(target, daysFromTarget),
    recipeId: null,
    dishName: null,
    features: null,
    rating: null,
    ...patch,
  };
}

const f = (patch: Partial<RecipeFeatures>): RecipeFeatures => ({
  ...defaultFeatures,
  ...patch,
});

const hongshaorou = recipe(
  "hongshaorou",
  "红烧肉",
  ["五花肉", "冰糖", "生抽"],
  {
    main_ingredient: "pork_belly",
    flavor: "soy_braised",
  },
);

describe("SPEC acceptance: recently eaten dishes never reappear", () => {
  it("excludes a dish eaten out in the window, matched by name", () => {
    const suancaiyu = recipe("scy", "酸菜鱼", ["草鱼", "酸菜"]);
    const history = [eaten(-3, { dishName: " 酸菜鱼 " })];
    expect(findRepeat(suancaiyu, target, history, N)).toEqual({
      reason: "same_dish",
      dish: history[0],
    });
  });

  it("excludes a dish cooked at home in the window, matched by recipe id", () => {
    const history = [eaten(-10, { recipeId: "hongshaorou" })];
    expect(findRepeat(hongshaorou, target, history, N)?.reason).toBe(
      "same_dish",
    );
  });

  it("excludes a different dish with the same main ingredient and flavor", () => {
    const history = [
      eaten(-5, {
        dishName: "东坡肉",
        features: f({ main_ingredient: "pork_belly", flavor: "soy_braised" }),
      }),
    ];
    expect(findRepeat(hongshaorou, target, history, N)?.reason).toBe(
      "same_main_and_flavor",
    );
  });

  it("allows the same main ingredient with a different flavor", () => {
    const history = [
      eaten(-5, {
        features: f({ main_ingredient: "pork_belly", flavor: "garlicky" }),
      }),
    ];
    expect(findRepeat(hongshaorou, target, history, N)).toBeNull();
  });

  it("treats specific ingredients as different (五花肉 vs 排骨)", () => {
    const history = [
      eaten(-5, {
        features: f({ main_ingredient: "pork_ribs", flavor: "soy_braised" }),
      }),
    ];
    expect(findRepeat(hongshaorou, target, history, N)).toBeNull();
  });

  it("counts a dish eaten after the target date (the window is two-sided)", () => {
    const history = [eaten(+2, { recipeId: "hongshaorou" })];
    expect(findRepeat(hongshaorou, target, history, N)?.reason).toBe(
      "same_dish",
    );
  });

  it("excludes at N-1 days and allows at exactly N days", () => {
    expect(
      findRepeat(
        hongshaorou,
        target,
        [eaten(-(N - 1), { recipeId: "hongshaorou" })],
        N,
      ),
    ).not.toBeNull();
    expect(
      findRepeat(
        hongshaorou,
        target,
        [eaten(-N, { recipeId: "hongshaorou" })],
        N,
      ),
    ).toBeNull();
  });

  it("with N = 1 only excludes a dish eaten on the same day", () => {
    const same = [eaten(0, { recipeId: "hongshaorou" })];
    const yesterday = [eaten(-1, { recipeId: "hongshaorou" })];
    expect(findRepeat(hongshaorou, target, same, 1)).not.toBeNull();
    expect(findRepeat(hongshaorou, target, yesterday, 1)).toBeNull();
  });

  it("with N = 0 disables dedupe", () => {
    const same = [eaten(0, { recipeId: "hongshaorou" })];
    expect(findRepeat(hongshaorou, target, same, 0)).toBeNull();
  });

  it("uses a whole week eaten out as history like any other", () => {
    const week = Array.from({ length: 7 }, (_, i) =>
      eaten(-7 + i, { dishName: `外卖${i}` }),
    );
    week.push(eaten(-1, { dishName: "红烧肉" }));
    expect(findRepeat(hongshaorou, target, week, N)?.dish.dishName).toBe(
      "红烧肉",
    );
  });
});

describe("findRepeat: edge cases", () => {
  it("never matches on an unknown flavor or main ingredient", () => {
    const other = recipe("x", "某菜", ["五花肉"], {
      main_ingredient: "pork_belly",
      flavor: "other",
    });
    const unlabeled = recipe("y", "某菜2", ["五花肉"], {
      main_ingredient: null,
    });
    const history = [
      eaten(-1, {
        features: f({ main_ingredient: "pork_belly", flavor: "other" }),
      }),
      eaten(-1, { features: f({ main_ingredient: null }) }),
    ];
    expect(findRepeat(other, target, history, N)).toBeNull();
    expect(findRepeat(unlabeled, target, history, N)).toBeNull();
  });

  it("reports a same-dish match ahead of a main-and-flavor match", () => {
    const history = [
      eaten(-2, {
        features: f({ main_ingredient: "pork_belly", flavor: "soy_braised" }),
      }),
      eaten(-9, { recipeId: "hongshaorou" }),
    ];
    expect(findRepeat(hongshaorou, target, history, N)?.reason).toBe(
      "same_dish",
    );
  });

  it("allows everything with no history", () => {
    expect(findRepeat(hongshaorou, target, [], N)).toBeNull();
  });

  it.each([-1, 1.5, Number.NaN])("rejects a window of %s", (w) => {
    expect(() => findRepeat(hongshaorou, target, [], w)).toThrow(RangeError);
  });
});

describe("dedupeCandidates", () => {
  it("splits candidates into allowed and excluded", () => {
    const spinach = recipe("spinach", "清炒菠菜", ["菠菜"]);
    const result = dedupeCandidates(
      [hongshaorou, spinach],
      target,
      [eaten(-1, { recipeId: "hongshaorou" })],
      N,
    );
    expect(result.allowed.map((r) => r.id)).toEqual(["spinach"]);
    expect(result.excluded.map((e) => [e.recipe.id, e.repeat.reason])).toEqual([
      ["hongshaorou", "same_dish"],
    ]);
  });

  it("validates the window even with no candidates", () => {
    expect(() => dedupeCandidates([], target, [], -1)).toThrow(RangeError);
    expect(dedupeCandidates([], target, [], 0)).toEqual({
      allowed: [],
      excluded: [],
    });
  });
});
