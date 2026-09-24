/**
 * Data for scripts/seed.ts: a small hand-written recipe library and the demo
 * account's meal history. Recipe text is original, released as CC0-1.0.
 */

import type { RecipeFeatures } from "@/domain/features";
import type { RecipeIngredient } from "@/domain/recipe";

export const SEED_SOURCE = "fandan-seed";
export const SEED_LICENSE = "CC0-1.0";
export const SEED_TIMEZONE = "America/Toronto";

export const DEVELOPER_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000002";

export interface SeedRecipe {
  /** Stable slug, stored as `source_ref`. */
  ref: string;
  name: string;
  category: "荤菜" | "素菜" | "汤羹";
  ingredients: RecipeIngredient[];
  steps: string[];
  features: RecipeFeatures;
}

const main = (raw_name: string, key: string | null, amount?: string) =>
  ({ raw_name, key, amount, role: "main" }) as RecipeIngredient;
const side = (raw_name: string, key: string | null, amount?: string) =>
  ({ raw_name, key, amount, role: "supplementary" }) as RecipeIngredient;

export const SEED_RECIPES: SeedRecipe[] = [
  {
    ref: "hongshaorou",
    name: "红烧肉",
    category: "荤菜",
    ingredients: [
      main("五花肉", "pork_belly", "500g"),
      side("冰糖", "rock_sugar", "30g"),
      side("生抽", "light_soy_sauce", "2勺"),
      side("老抽", "dark_soy_sauce", "1勺"),
      side("料酒", "cooking_wine", "2勺"),
      side("葱", "scallion", "2根"),
      side("姜", "ginger", "3片"),
      side("八角", "star_anise", "2个"),
    ],
    steps: [
      "五花肉切块，冷水下锅焯水后捞出。",
      "少油小火炒冰糖至焦糖色，下肉块翻炒上色。",
      "加葱姜八角、料酒、生抽老抽和热水，小火炖一小时。",
      "大火收汁即可。",
    ],
    features: {
      role: "meat",
      cuisine: "home_style",
      method: "braise",
      flavor: "soy_braised",
      main_ingredient: "pork_belly",
      oil_level: "high",
    },
  },
  {
    ref: "fanqie-chaodan",
    name: "番茄炒蛋",
    category: "素菜",
    ingredients: [
      main("番茄", "tomato", "2个"),
      main("鸡蛋", "egg", "3个"),
      side("葱", "scallion", "1根"),
      side("盐", "salt"),
      side("糖", "sugar", "1小勺"),
      side("食用油", "cooking_oil"),
    ],
    steps: [
      "鸡蛋打散炒至凝固盛出。",
      "番茄切块炒出汁，加盐和糖。",
      "倒回鸡蛋翻匀，撒葱花出锅。",
    ],
    features: {
      role: "mixed",
      cuisine: "home_style",
      method: "stir_fry",
      flavor: "sweet_sour",
      main_ingredient: "egg",
      oil_level: "medium",
    },
  },
  {
    ref: "suanrong-bocai",
    name: "蒜蓉菠菜",
    category: "素菜",
    ingredients: [
      main("菠菜", "spinach", "1把"),
      side("蒜", "garlic", "4瓣"),
      side("盐", "salt"),
      side("食用油", "cooking_oil"),
    ],
    steps: ["菠菜洗净焯水去草酸。", "热油爆香蒜末，下菠菜大火快炒，加盐出锅。"],
    features: {
      role: "vegetable",
      cuisine: "home_style",
      method: "stir_fry",
      flavor: "garlicky",
      main_ingredient: "spinach",
      oil_level: "low",
    },
  },
  {
    ref: "mapo-doufu",
    name: "麻婆豆腐",
    category: "荤菜",
    ingredients: [
      main("豆腐", "tofu", "1块"),
      side("肉末", "ground_pork", "100g"),
      side("豆瓣酱", "chili_bean_paste", "1勺"),
      side("花椒", "sichuan_pepper"),
      side("淀粉", "starch"),
      side("葱", "scallion"),
      side("蒜", "garlic"),
    ],
    steps: [
      "豆腐切块，盐水焯一下。",
      "炒香肉末和豆瓣酱，加水烧开后下豆腐。",
      "小火煮五分钟，勾芡，撒花椒粉和葱花。",
    ],
    features: {
      role: "mixed",
      cuisine: "sichuan",
      method: "braise",
      flavor: "numbing_spicy",
      main_ingredient: "tofu",
      oil_level: "high",
    },
  },
  {
    ref: "tangcu-paigu",
    name: "糖醋排骨",
    category: "荤菜",
    ingredients: [
      main("排骨", "pork_ribs", "500g"),
      side("醋", "vinegar", "3勺"),
      side("糖", "sugar", "2勺"),
      side("生抽", "light_soy_sauce", "1勺"),
      side("料酒", "cooking_wine", "1勺"),
      side("姜", "ginger"),
      side("芝麻", "sesame_seed"),
    ],
    steps: [
      "排骨焯水后煎至两面金黄。",
      "加料酒、生抽、醋、糖和热水，小火炖二十分钟。",
      "大火收汁，撒芝麻。",
    ],
    features: {
      role: "meat",
      cuisine: "home_style",
      method: "braise",
      flavor: "sweet_sour",
      main_ingredient: "pork_ribs",
      oil_level: "high",
    },
  },
  {
    ref: "suanla-tudousi",
    name: "酸辣土豆丝",
    category: "素菜",
    ingredients: [
      main("土豆", "potato", "2个"),
      side("干辣椒", "dried_chili"),
      side("醋", "vinegar", "2勺"),
      side("蒜", "garlic"),
      side("盐", "salt"),
      side("食用油", "cooking_oil"),
    ],
    steps: [
      "土豆切丝泡水洗去淀粉。",
      "热油爆香干辣椒和蒜，下土豆丝大火快炒。",
      "沿锅边淋醋，加盐出锅。",
    ],
    features: {
      role: "vegetable",
      cuisine: "home_style",
      method: "stir_fry",
      flavor: "sour_spicy",
      main_ingredient: "potato",
      oil_level: "medium",
    },
  },
  {
    ref: "kele-jichi",
    name: "可乐鸡翅",
    category: "荤菜",
    ingredients: [
      main("鸡翅", "chicken_wing", "10个"),
      side("可乐", null, "1罐"),
      side("生抽", "light_soy_sauce", "2勺"),
      side("老抽", "dark_soy_sauce", "半勺"),
      side("姜", "ginger"),
      side("葱", "scallion"),
    ],
    steps: [
      "鸡翅两面划刀，焯水。",
      "煎至两面金黄，加姜葱、生抽老抽。",
      "倒入可乐没过鸡翅，小火炖十五分钟后收汁。",
    ],
    features: {
      role: "meat",
      cuisine: "home_style",
      method: "braise",
      flavor: "soy_braised",
      main_ingredient: "chicken_wing",
      oil_level: "medium",
    },
  },
  {
    ref: "haoyou-shengcai",
    name: "蚝油生菜",
    category: "素菜",
    ingredients: [
      main("生菜", "lettuce", "1颗"),
      side("蚝油", "oyster_sauce", "1勺"),
      side("蒜", "garlic"),
      side("生抽", "light_soy_sauce"),
      side("食用油", "cooking_oil"),
    ],
    steps: [
      "生菜焯水十秒摆盘。",
      "热油爆香蒜末，加蚝油生抽和少许水煮开，淋在生菜上。",
    ],
    features: {
      role: "vegetable",
      cuisine: "cantonese",
      method: "boil",
      flavor: "savory",
      main_ingredient: "lettuce",
      oil_level: "low",
    },
  },
  {
    ref: "donggua-paigu-tang",
    name: "冬瓜排骨汤",
    category: "汤羹",
    ingredients: [
      main("排骨", "pork_ribs", "300g"),
      main("冬瓜", "winter_melon", "500g"),
      side("姜", "ginger"),
      side("葱", "scallion"),
      side("盐", "salt"),
      side("白胡椒粉", "white_pepper"),
    ],
    steps: [
      "排骨焯水后与姜片加水炖四十分钟。",
      "加入冬瓜块再炖十五分钟。",
      "加盐和白胡椒粉，撒葱花。",
    ],
    features: {
      role: "soup",
      cuisine: "home_style",
      method: "stew",
      flavor: "light",
      main_ingredient: "pork_ribs",
      oil_level: "low",
    },
  },
  {
    ref: "gongbao-jiding",
    name: "宫保鸡丁",
    category: "荤菜",
    ingredients: [
      main("鸡胸肉", "chicken_breast", "300g"),
      side("花生米", "peanut", "50g"),
      side("干辣椒", "dried_chili"),
      side("花椒", "sichuan_pepper"),
      side("葱", "scallion"),
      side("姜", "ginger"),
      side("蒜", "garlic"),
      side("生抽", "light_soy_sauce"),
      side("醋", "vinegar"),
      side("糖", "sugar"),
      side("淀粉", "starch"),
    ],
    steps: [
      "鸡肉切丁，用生抽和淀粉腌十分钟。",
      "调碗汁：生抽、醋、糖、淀粉和水。",
      "炒香干辣椒花椒，下鸡丁炒熟，加葱姜蒜。",
      "倒入碗汁和花生米，翻匀出锅。",
    ],
    features: {
      role: "meat",
      cuisine: "sichuan",
      method: "stir_fry",
      flavor: "spicy",
      main_ingredient: "chicken_breast",
      oil_level: "medium",
    },
  },
];

/** One demo dinner, counted in days before today. No entry = unknown. */
export type DemoDinner =
  | {
      daysAgo: number;
      status: "cooked";
      dishes: { ref: string; eaten: boolean; rating: number | null }[];
    }
  | {
      daysAgo: number;
      status: "ate_out";
      dishName: string;
      features: RecipeFeatures | null;
    }
  | { daysAgo: number; status: "skipped" };

export const DEMO_DINNERS: DemoDinner[] = [
  {
    daysAgo: 1,
    status: "cooked",
    dishes: [
      { ref: "fanqie-chaodan", eaten: true, rating: 4 },
      { ref: "suanrong-bocai", eaten: true, rating: 3 },
    ],
  },
  {
    daysAgo: 2,
    status: "ate_out",
    dishName: "酸菜鱼",
    features: {
      role: "meat",
      cuisine: "sichuan",
      method: "boil",
      flavor: "sour_spicy",
      main_ingredient: "grass_carp",
      oil_level: "high",
    },
  },
  {
    daysAgo: 3,
    status: "cooked",
    dishes: [
      { ref: "hongshaorou", eaten: true, rating: 5 },
      { ref: "haoyou-shengcai", eaten: true, rating: 4 },
    ],
  },
  // 4 days ago: no record, so the calendar shows "unknown".
  {
    daysAgo: 5,
    status: "cooked",
    dishes: [
      { ref: "mapo-doufu", eaten: true, rating: 4 },
      { ref: "suanla-tudousi", eaten: false, rating: null },
    ],
  },
  { daysAgo: 6, status: "skipped" },
  {
    daysAgo: 7,
    status: "cooked",
    dishes: [
      { ref: "kele-jichi", eaten: true, rating: 5 },
      { ref: "suanrong-bocai", eaten: true, rating: 4 },
    ],
  },
  { daysAgo: 9, status: "ate_out", dishName: "麻辣香锅", features: null },
  {
    daysAgo: 10,
    status: "cooked",
    dishes: [
      { ref: "donggua-paigu-tang", eaten: true, rating: 3 },
      { ref: "fanqie-chaodan", eaten: true, rating: 4 },
    ],
  },
  {
    daysAgo: 12,
    status: "cooked",
    dishes: [
      { ref: "tangcu-paigu", eaten: true, rating: 4 },
      { ref: "haoyou-shengcai", eaten: true, rating: 3 },
    ],
  },
];

export const DEMO_PANTRY = ["鸡蛋", "番茄", "土豆", "姜", "泡椒"];
