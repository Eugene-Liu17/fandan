import { describe, expect, it } from "vitest";
import { addDays, parsePlainDate } from "./date";
import type { EatenDish } from "./dedupe";
import type { RecipeCandidate } from "./recipe";
import {
  matchesCraving,
  pantryCoverage,
  type RankInput,
  rankCandidates,
  ratingSignal,
  SCORE_WEIGHTS,
} from "./scoring";
import { pantryIdentities } from "./shopping-list";
import { recipe } from "./testing/fixtures";

const target = parsePlainDate("2026-09-30");

const hongshaorou = recipe("hongshaorou", "红烧肉", ["五花肉", "冰糖", "生抽"]);
const tangcupaigu = recipe("tangcupaigu", "糖醋排骨", ["排骨", "醋", "糖"]);
const mapotofu = recipe("mapotofu", "麻婆豆腐", ["豆腐", "肉末", "豆瓣酱"]);
const spinach = recipe("spinach", "清炒菠菜", ["菠菜", "蒜"]);

function input(
  patch: Partial<RankInput<RecipeCandidate>> = {},
): RankInput<RecipeCandidate> {
  return {
    recipes: [hongshaorou, tangcupaigu, mapotofu, spinach],
    targetDate: target,
    restrictions: [],
    history: [],
    windowDays: 14,
    pantry: [],
    cravings: [],
    random: () => 0,
    ...patch,
  };
}

const ids = (r: { ranked: { recipe: { id: string } }[] }) =>
  r.ranked.map((c) => c.recipe.id);

function rated(recipeId: string, rating: number, daysAgo = 30): EatenDish {
  return {
    date: addDays(target, -daysAgo),
    recipeId,
    dishName: null,
    features: null,
    rating,
  };
}

describe("rankCandidates: hard filters first", () => {
  it("never ranks a recipe with a declared allergen, whatever its score", () => {
    const result = rankCandidates(
      input({
        restrictions: [{ kind: "allergen", tag: "soy" }],
        pantry: [{ ingredientKey: null, rawName: "豆腐" }],
        cravings: ["麻婆豆腐"],
        history: [rated("mapotofu", 5)],
      }),
    );
    expect(ids(result)).not.toContain("mapotofu");
    expect(ids(result)).not.toContain("hongshaorou"); // 生抽 is soy
    expect(result.excluded).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipe: mapotofu,
          reason: "restriction",
        }),
      ]),
    );
  });

  it("drops recently eaten dishes before scoring", () => {
    const result = rankCandidates(
      input({
        history: [{ ...rated("hongshaorou", 5, 3) }],
        cravings: ["红烧肉"],
      }),
    );
    expect(ids(result)).not.toContain("hongshaorou");
    expect(result.excluded).toEqual([
      expect.objectContaining({ recipe: hongshaorou, reason: "repeat" }),
    ]);
  });
});

describe("rankCandidates: scoring", () => {
  it("ranks recipes whose main ingredient is in the pantry first", () => {
    const result = rankCandidates(
      input({ pantry: [{ ingredientKey: null, rawName: "菠菜" }] }),
    );
    expect(ids(result)[0]).toBe("spinach");
    expect(result.ranked[0]?.breakdown.pantryCoverage).toBe(
      SCORE_WEIGHTS.pantryCoverage,
    );
  });

  it("ranks better-rated recipes higher", () => {
    const result = rankCandidates(
      input({
        history: [rated("tangcupaigu", 5), rated("mapotofu", 1)],
      }),
    );
    expect(ids(result)[0]).toBe("tangcupaigu");
    expect(ids(result).at(-1)).toBe("mapotofu");
  });

  it("boosts a stated craving", () => {
    const result = rankCandidates(input({ cravings: ["排骨"] }));
    expect(ids(result)[0]).toBe("tangcupaigu");
    expect(result.ranked[0]?.breakdown.craving).toBe(SCORE_WEIGHTS.craving);
  });

  it("breaks exact ties by recipe id", () => {
    expect(ids(rankCandidates(input()))).toEqual([
      "hongshaorou",
      "mapotofu",
      "spinach",
      "tangcupaigu",
    ]);
  });

  it("is reproducible for the same random source", () => {
    const seeded = () => {
      let s = 42;
      return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
    };
    const a = rankCandidates(input({ random: seeded() }));
    const b = rankCandidates(input({ random: seeded() }));
    expect(ids(a)).toEqual(ids(b));
    expect(a.ranked.map((c) => c.score)).toEqual(b.ranked.map((c) => c.score));
  });

  it("keeps jitter too small to overturn a real signal", () => {
    const result = rankCandidates(
      input({
        pantry: [{ ingredientKey: null, rawName: "菠菜" }],
        random: () => 0.9999,
      }),
    );
    expect(ids(result)[0]).toBe("spinach");
  });

  it("handles empty inputs", () => {
    expect(rankCandidates(input({ recipes: [] }))).toEqual({
      ranked: [],
      excluded: [],
    });
  });
});

describe("pantryCoverage", () => {
  it("counts only non-condiment main ingredients", () => {
    const dish = {
      ...recipe("x", "葱油拌面", []),
      ingredients: [
        { raw_name: "面条", key: null, role: "main" },
        { raw_name: "生抽", key: null, role: "main" },
        { raw_name: "葱", key: null, role: "supplementary" },
      ] as const,
    };
    const have = pantryIdentities([{ ingredientKey: null, rawName: "挂面" }]);
    expect(pantryCoverage(dish, have)).toBe(1);
  });

  it("is 0 for a recipe with no main ingredient", () => {
    expect(pantryCoverage(recipe("x", "空", []), new Set())).toBe(0);
  });
});

describe("ratingSignal", () => {
  it("maps the average rating to -1…1 and ignores unrated dishes", () => {
    expect(ratingSignal(hongshaorou, [rated("hongshaorou", 5)])).toBe(1);
    expect(ratingSignal(hongshaorou, [rated("hongshaorou", 1)])).toBe(-1);
    expect(
      ratingSignal(hongshaorou, [
        rated("hongshaorou", 4),
        rated("hongshaorou", 5),
        { ...rated("hongshaorou", 1), rating: null },
      ]),
    ).toBe(0.75);
    expect(ratingSignal(hongshaorou, [rated("other", 5)])).toBe(0);
  });
});

describe("matchesCraving", () => {
  it("matches the recipe name", () => {
    expect(matchesCraving(tangcupaigu, ["糖醋"])).toBe(true);
  });

  it("matches a main ingredient through its aliases", () => {
    expect(matchesCraving(hongshaorou, ["猪五花"])).toBe(true);
  });

  it("matches the labeled main ingredient", () => {
    const dish = recipe("x", "招牌菜", ["秘制配料"], {
      main_ingredient: "beef_brisket",
    });
    expect(matchesCraving(dish, ["牛腩"])).toBe(true);
  });

  it("ignores blank cravings and non-matches", () => {
    expect(matchesCraving(hongshaorou, ["  ", "排骨"])).toBe(false);
    expect(matchesCraving(hongshaorou, [])).toBe(false);
  });
});
