/**
 * The ingredient dictionary (ADR-008): one reviewed list that allergy
 * filtering, dedupe, and the shopping list all normalize against.
 *
 * Rules for editing:
 * - `key` is English snake_case and never changes once used in data.
 * - An alias belongs to exactly one entry (enforced by a test and at load).
 * - Allergen tags are conservative: tag a compound ingredient with every
 *   allergen it commonly contains (e.g. soy sauce is soy + wheat). An
 *   ambiguous name is attached to the entry that carries allergens.
 */

import type { AllergenTag, IngredientCategory } from "./vocab";

export interface IngredientEntry {
  key: string;
  /** Canonical Simplified Chinese name. */
  name: string;
  aliases: readonly string[];
  category: IngredientCategory;
  allergens: readonly AllergenTag[];
}

// biome-ignore format: one entry per line keeps the dictionary reviewable.
export const INGREDIENTS = [
  // --- Pork ---
  // Bare 肉丝 / 肉丁 / 肉块 usually mean pork; per the stricter-entry rule they
  // map here rather than staying unmapped.
  { key: "pork", name: "猪肉", aliases: ["猪肉片", "肉片", "肉丝", "肉丁", "肉块", "猪肉丝"], category: "pork", allergens: [] },
  { key: "pork_belly", name: "五花肉", aliases: ["猪五花", "带皮五花肉", "五花"], category: "pork", allergens: [] },
  { key: "pork_ribs", name: "排骨", aliases: ["猪排骨", "猪肋排", "肋排", "小排"], category: "pork", allergens: [] },
  { key: "pork_tenderloin", name: "里脊肉", aliases: ["猪里脊", "里脊", "猪柳"], category: "pork", allergens: [] },
  { key: "pork_lean", name: "瘦肉", aliases: ["猪瘦肉"], category: "pork", allergens: [] },
  { key: "pork_shoulder", name: "梅花肉", aliases: ["前腿肉", "猪前腿肉", "梅头肉"], category: "pork", allergens: [] },
  { key: "ground_pork", name: "猪肉末", aliases: ["肉末", "猪肉馅", "肉馅", "猪绞肉"], category: "pork", allergens: [] },
  { key: "pork_trotter", name: "猪蹄", aliases: ["猪脚", "猪手"], category: "pork", allergens: [] },
  { key: "cured_pork", name: "腊肉", aliases: ["咸肉"], category: "pork", allergens: [] },
  // Cantonese sausage is cured with soy sauce, so it carries soy and wheat.
  { key: "chinese_sausage", name: "腊肠", aliases: ["广式腊肠", "香肠"], category: "pork", allergens: ["soy", "wheat"] },
  { key: "ham", name: "火腿", aliases: ["金华火腿"], category: "pork", allergens: [] },
  { key: "ham_sausage", name: "火腿肠", aliases: [], category: "pork", allergens: ["soy", "wheat"] },
  { key: "bacon", name: "培根", aliases: [], category: "pork", allergens: [] },
  { key: "char_siu", name: "叉烧", aliases: ["叉烧肉"], category: "pork", allergens: ["soy", "wheat"] },
  { key: "luncheon_meat", name: "午餐肉", aliases: [], category: "pork", allergens: ["soy", "wheat"] },
  // --- Beef and lamb ---
  { key: "beef", name: "牛肉", aliases: ["牛肉片"], category: "beef", allergens: [] },
  { key: "beef_brisket", name: "牛腩", aliases: [], category: "beef", allergens: [] },
  { key: "beef_shank", name: "牛腱子", aliases: ["牛腱", "牛展"], category: "beef", allergens: [] },
  { key: "beef_tenderloin", name: "牛里脊", aliases: ["牛柳"], category: "beef", allergens: [] },
  { key: "ground_beef", name: "牛肉末", aliases: ["牛肉馅"], category: "beef", allergens: [] },
  { key: "fatty_beef", name: "肥牛", aliases: ["肥牛卷", "肥牛片"], category: "beef", allergens: [] },
  { key: "beef_steak", name: "牛排", aliases: [], category: "beef", allergens: [] },
  { key: "beef_tripe", name: "毛肚", aliases: ["牛肚", "牛百叶"], category: "beef", allergens: [] },
  { key: "lamb", name: "羊肉", aliases: ["羊肉片", "羊肉卷"], category: "lamb", allergens: [] },
  { key: "lamb_chops", name: "羊排", aliases: [], category: "lamb", allergens: [] },
  // --- Poultry ---
  { key: "chicken", name: "鸡肉", aliases: ["鸡", "整鸡", "三黄鸡", "土鸡"], category: "poultry", allergens: [] },
  { key: "chicken_breast", name: "鸡胸肉", aliases: ["鸡胸", "鸡脯肉"], category: "poultry", allergens: [] },
  { key: "chicken_thigh", name: "鸡腿", aliases: ["鸡腿肉", "琵琶腿", "大鸡腿"], category: "poultry", allergens: [] },
  { key: "chicken_wing", name: "鸡翅", aliases: ["鸡翅中", "鸡中翅", "翅中", "鸡翅膀"], category: "poultry", allergens: [] },
  { key: "chicken_feet", name: "鸡爪", aliases: ["凤爪"], category: "poultry", allergens: [] },
  { key: "duck", name: "鸭肉", aliases: ["鸭", "鸭腿"], category: "poultry", allergens: [] },
  // --- Fish ---
  { key: "fish", name: "鱼", aliases: ["鱼肉", "鱼片"], category: "fish", allergens: ["fish"] },
  { key: "grass_carp", name: "草鱼", aliases: [], category: "fish", allergens: ["fish"] },
  { key: "sea_bass", name: "鲈鱼", aliases: [], category: "fish", allergens: ["fish"] },
  { key: "crucian_carp", name: "鲫鱼", aliases: [], category: "fish", allergens: ["fish"] },
  { key: "hairtail", name: "带鱼", aliases: [], category: "fish", allergens: ["fish"] },
  { key: "yellow_croaker", name: "黄鱼", aliases: ["小黄鱼", "大黄鱼"], category: "fish", allergens: ["fish"] },
  { key: "salmon", name: "三文鱼", aliases: ["鲑鱼"], category: "fish", allergens: ["fish"] },
  { key: "cod", name: "鳕鱼", aliases: [], category: "fish", allergens: ["fish"] },
  { key: "basa", name: "巴沙鱼", aliases: ["龙利鱼", "龙利鱼柳"], category: "fish", allergens: ["fish"] },
  { key: "tilapia", name: "罗非鱼", aliases: [], category: "fish", allergens: ["fish"] },
  // --- Shellfish ---
  { key: "shrimp", name: "虾", aliases: ["鲜虾", "大虾", "基围虾", "白虾", "对虾"], category: "shellfish", allergens: ["crustacean"] },
  { key: "peeled_shrimp", name: "虾仁", aliases: [], category: "shellfish", allergens: ["crustacean"] },
  { key: "dried_shrimp", name: "虾皮", aliases: ["虾米", "海米"], category: "shellfish", allergens: ["crustacean"] },
  { key: "crayfish", name: "小龙虾", aliases: [], category: "shellfish", allergens: ["crustacean"] },
  { key: "crab", name: "螃蟹", aliases: ["蟹", "大闸蟹"], category: "shellfish", allergens: ["crustacean"] },
  { key: "clam", name: "蛤蜊", aliases: ["花甲", "花蛤", "蚬子"], category: "shellfish", allergens: ["mollusc"] },
  { key: "squid", name: "鱿鱼", aliases: ["鱿鱼须"], category: "shellfish", allergens: ["mollusc"] },
  { key: "scallop", name: "扇贝", aliases: ["扇贝肉", "干贝"], category: "shellfish", allergens: ["mollusc"] },
  { key: "oyster", name: "生蚝", aliases: ["牡蛎", "蚝"], category: "shellfish", allergens: ["mollusc"] },
  { key: "mussel", name: "青口", aliases: ["贻贝", "淡菜"], category: "shellfish", allergens: ["mollusc"] },
  // --- Eggs ---
  { key: "egg", name: "鸡蛋", aliases: ["蛋", "土鸡蛋"], category: "egg", allergens: ["egg"] },
  { key: "duck_egg", name: "鸭蛋", aliases: [], category: "egg", allergens: ["egg"] },
  { key: "salted_duck_egg", name: "咸鸭蛋", aliases: ["咸蛋", "咸蛋黄"], category: "egg", allergens: ["egg"] },
  { key: "century_egg", name: "皮蛋", aliases: ["松花蛋"], category: "egg", allergens: ["egg"] },
  { key: "quail_egg", name: "鹌鹑蛋", aliases: [], category: "egg", allergens: ["egg"] },
  // --- Soy products ---
  { key: "tofu", name: "豆腐", aliases: ["嫩豆腐", "老豆腐", "北豆腐", "南豆腐"], category: "soy_product", allergens: ["soy"] },
  { key: "silken_tofu", name: "内酯豆腐", aliases: ["绢豆腐"], category: "soy_product", allergens: ["soy"] },
  { key: "dried_tofu", name: "豆腐干", aliases: ["豆干", "香干"], category: "soy_product", allergens: ["soy"] },
  { key: "tofu_skin", name: "千张", aliases: ["豆腐皮", "百叶"], category: "soy_product", allergens: ["soy"] },
  { key: "yuba", name: "腐竹", aliases: [], category: "soy_product", allergens: ["soy"] },
  { key: "fried_tofu", name: "油豆腐", aliases: ["豆泡", "豆腐泡"], category: "soy_product", allergens: ["soy"] },
  { key: "soy_milk", name: "豆浆", aliases: [], category: "soy_product", allergens: ["soy"] },
  { key: "soybean", name: "黄豆", aliases: [], category: "legume", allergens: ["soy"] },
  { key: "edamame", name: "毛豆", aliases: ["毛豆仁"], category: "legume", allergens: ["soy"] },
  // "豆芽" usually means mung bean sprouts, but it is attached here, to the
  // entry that carries the soy tag, so an ambiguous name errs toward safety.
  { key: "soybean_sprout", name: "黄豆芽", aliases: ["豆芽"], category: "vegetable", allergens: ["soy"] },
  // --- Vegetables ---
  { key: "mung_bean_sprout", name: "绿豆芽", aliases: [], category: "vegetable", allergens: [] },
  { key: "pickled_mustard_greens", name: "酸菜", aliases: ["老坛酸菜"], category: "vegetable", allergens: [] },
  { key: "napa_cabbage", name: "大白菜", aliases: ["白菜", "黄芽白"], category: "vegetable", allergens: [] },
  { key: "baby_napa", name: "娃娃菜", aliases: [], category: "vegetable", allergens: [] },
  { key: "bok_choy", name: "小白菜", aliases: ["青菜", "上海青", "油菜"], category: "vegetable", allergens: [] },
  { key: "spinach", name: "菠菜", aliases: [], category: "vegetable", allergens: [] },
  { key: "lettuce", name: "生菜", aliases: [], category: "vegetable", allergens: [] },
  { key: "a_choy", name: "油麦菜", aliases: [], category: "vegetable", allergens: [] },
  { key: "water_spinach", name: "空心菜", aliases: ["通菜", "蕹菜"], category: "vegetable", allergens: [] },
  { key: "chinese_broccoli", name: "芥蓝", aliases: [], category: "vegetable", allergens: [] },
  { key: "choy_sum", name: "菜心", aliases: [], category: "vegetable", allergens: [] },
  { key: "broccoli", name: "西兰花", aliases: ["西蓝花", "青花菜"], category: "vegetable", allergens: [] },
  { key: "cauliflower", name: "花菜", aliases: ["菜花", "花椰菜", "有机花菜"], category: "vegetable", allergens: [] },
  { key: "cabbage", name: "卷心菜", aliases: ["包菜", "圆白菜", "洋白菜", "甘蓝"], category: "vegetable", allergens: [] },
  { key: "celery", name: "芹菜", aliases: ["西芹"], category: "vegetable", allergens: [] },
  { key: "chinese_chives", name: "韭菜", aliases: [], category: "vegetable", allergens: [] },
  { key: "garlic_scape", name: "蒜苔", aliases: ["蒜薹"], category: "vegetable", allergens: [] },
  { key: "potato", name: "土豆", aliases: ["马铃薯", "洋芋"], category: "vegetable", allergens: [] },
  { key: "sweet_potato", name: "红薯", aliases: ["地瓜", "番薯"], category: "vegetable", allergens: [] },
  { key: "tomato", name: "番茄", aliases: ["西红柿"], category: "vegetable", allergens: [] },
  { key: "cucumber", name: "黄瓜", aliases: [], category: "vegetable", allergens: [] },
  { key: "eggplant", name: "茄子", aliases: ["长茄子", "圆茄子"], category: "vegetable", allergens: [] },
  { key: "green_pepper", name: "青椒", aliases: ["尖椒", "菜椒"], category: "vegetable", allergens: [] },
  { key: "bell_pepper", name: "彩椒", aliases: ["甜椒"], category: "vegetable", allergens: [] },
  { key: "carrot", name: "胡萝卜", aliases: [], category: "vegetable", allergens: [] },
  { key: "white_radish", name: "白萝卜", aliases: ["萝卜"], category: "vegetable", allergens: [] },
  { key: "onion", name: "洋葱", aliases: [], category: "vegetable", allergens: [] },
  { key: "green_bean", name: "四季豆", aliases: ["豆角", "芸豆角"], category: "vegetable", allergens: [] },
  { key: "long_bean", name: "豇豆", aliases: ["长豆角"], category: "vegetable", allergens: [] },
  { key: "snow_pea", name: "荷兰豆", aliases: [], category: "vegetable", allergens: [] },
  { key: "winter_melon", name: "冬瓜", aliases: [], category: "vegetable", allergens: [] },
  { key: "pumpkin", name: "南瓜", aliases: [], category: "vegetable", allergens: [] },
  { key: "zucchini", name: "西葫芦", aliases: [], category: "vegetable", allergens: [] },
  { key: "bitter_melon", name: "苦瓜", aliases: [], category: "vegetable", allergens: [] },
  { key: "loofah", name: "丝瓜", aliases: [], category: "vegetable", allergens: [] },
  { key: "lotus_root", name: "莲藕", aliases: ["藕"], category: "vegetable", allergens: [] },
  { key: "chinese_yam", name: "山药", aliases: ["铁棍山药"], category: "vegetable", allergens: [] },
  { key: "taro", name: "芋头", aliases: ["芋艿"], category: "vegetable", allergens: [] },
  { key: "corn", name: "玉米", aliases: ["玉米粒"], category: "vegetable", allergens: [] },
  { key: "okra", name: "秋葵", aliases: [], category: "vegetable", allergens: [] },
  { key: "asparagus", name: "芦笋", aliases: [], category: "vegetable", allergens: [] },
  { key: "bamboo_shoot", name: "竹笋", aliases: ["笋", "春笋", "冬笋"], category: "vegetable", allergens: [] },
  { key: "pea", name: "豌豆", aliases: ["青豆"], category: "legume", allergens: [] },
  // --- Fungi ---
  { key: "shiitake", name: "香菇", aliases: ["冬菇", "花菇"], category: "fungus", allergens: [] },
  { key: "enoki", name: "金针菇", aliases: [], category: "fungus", allergens: [] },
  { key: "wood_ear", name: "木耳", aliases: ["黑木耳"], category: "fungus", allergens: [] },
  { key: "oyster_mushroom", name: "平菇", aliases: [], category: "fungus", allergens: [] },
  { key: "king_oyster_mushroom", name: "杏鲍菇", aliases: [], category: "fungus", allergens: [] },
  { key: "white_mushroom", name: "口蘑", aliases: ["白蘑菇"], category: "fungus", allergens: [] },
  // --- Aromatics and whole spices ---
  { key: "scallion", name: "葱", aliases: ["小葱", "香葱", "葱花"], category: "aromatic", allergens: [] },
  { key: "leek_scallion", name: "大葱", aliases: ["京葱"], category: "aromatic", allergens: [] },
  { key: "ginger", name: "姜", aliases: ["生姜", "老姜", "姜片", "姜丝"], category: "aromatic", allergens: [] },
  { key: "garlic", name: "大蒜", aliases: ["蒜", "蒜头", "蒜瓣", "蒜末", "蒜蓉"], category: "aromatic", allergens: [] },
  { key: "cilantro", name: "香菜", aliases: ["芫荽"], category: "aromatic", allergens: [] },
  { key: "fresh_chili", name: "小米辣", aliases: ["小米椒", "红辣椒", "辣椒"], category: "aromatic", allergens: [] },
  { key: "dried_chili", name: "干辣椒", aliases: ["干红辣椒"], category: "aromatic", allergens: [] },
  { key: "sichuan_pepper", name: "花椒", aliases: ["麻椒"], category: "aromatic", allergens: [] },
  { key: "star_anise", name: "八角", aliases: ["大料"], category: "aromatic", allergens: [] },
  { key: "cinnamon", name: "桂皮", aliases: [], category: "aromatic", allergens: [] },
  { key: "bay_leaf", name: "香叶", aliases: [], category: "aromatic", allergens: [] },
  // --- Grains and staples ---
  { key: "rice", name: "大米", aliases: ["米", "米饭", "白米"], category: "grain", allergens: [] },
  { key: "glutinous_rice", name: "糯米", aliases: [], category: "grain", allergens: [] },
  { key: "noodles", name: "面条", aliases: ["挂面", "面"], category: "grain", allergens: ["wheat"] },
  { key: "flour", name: "面粉", aliases: ["中筋面粉", "普通面粉"], category: "grain", allergens: ["wheat"] },
  { key: "dumpling_wrapper", name: "饺子皮", aliases: [], category: "grain", allergens: ["wheat"] },
  { key: "wonton_wrapper", name: "馄饨皮", aliases: ["云吞皮"], category: "grain", allergens: ["wheat", "egg"] },
  { key: "mantou", name: "馒头", aliases: [], category: "grain", allergens: ["wheat"] },
  { key: "rice_noodles", name: "米粉", aliases: ["米线"], category: "grain", allergens: [] },
  { key: "glass_noodles", name: "粉丝", aliases: ["龙口粉丝", "绿豆粉丝"], category: "grain", allergens: [] },
  { key: "rice_cake", name: "年糕", aliases: [], category: "grain", allergens: [] },
  // --- Nuts and seeds ---
  { key: "peanut", name: "花生", aliases: ["花生米", "花生仁"], category: "nut_seed", allergens: ["peanut"] },
  { key: "cashew", name: "腰果", aliases: [], category: "nut_seed", allergens: ["tree_nut"] },
  { key: "walnut", name: "核桃", aliases: ["核桃仁"], category: "nut_seed", allergens: ["tree_nut"] },
  { key: "pine_nut", name: "松子", aliases: ["松仁"], category: "nut_seed", allergens: ["tree_nut"] },
  { key: "sesame_seed", name: "芝麻", aliases: ["白芝麻", "黑芝麻"], category: "nut_seed", allergens: ["sesame"] },
  // --- Dairy ---
  { key: "milk", name: "牛奶", aliases: ["纯牛奶"], category: "dairy", allergens: ["milk"] },
  { key: "butter", name: "黄油", aliases: [], category: "dairy", allergens: ["milk"] },
  { key: "cream", name: "淡奶油", aliases: ["奶油"], category: "dairy", allergens: ["milk"] },
  { key: "cheese", name: "奶酪", aliases: ["芝士"], category: "dairy", allergens: ["milk"] },
  // --- Condiments and sauces ---
  { key: "cooking_oil", name: "食用油", aliases: ["油", "植物油", "菜籽油", "玉米油", "色拉油"], category: "condiment", allergens: [] },
  { key: "peanut_oil", name: "花生油", aliases: [], category: "condiment", allergens: ["peanut"] },
  { key: "sesame_oil", name: "香油", aliases: ["芝麻油", "麻油"], category: "condiment", allergens: ["sesame"] },
  { key: "salt", name: "盐", aliases: ["食盐", "精盐"], category: "condiment", allergens: [] },
  { key: "sugar", name: "白糖", aliases: ["糖", "白砂糖", "绵白糖"], category: "condiment", allergens: [] },
  { key: "rock_sugar", name: "冰糖", aliases: [], category: "condiment", allergens: [] },
  { key: "light_soy_sauce", name: "生抽", aliases: ["酱油", "味极鲜"], category: "condiment", allergens: ["soy", "wheat"] },
  { key: "dark_soy_sauce", name: "老抽", aliases: [], category: "condiment", allergens: ["soy", "wheat"] },
  // Chinese black vinegars are brewed with wheat bran, so the shared entry is
  // tagged wheat even though plain white vinegar is not.
  { key: "vinegar", name: "醋", aliases: ["香醋", "陈醋", "米醋", "白醋"], category: "condiment", allergens: ["wheat"] },
  { key: "cooking_wine", name: "料酒", aliases: ["黄酒", "绍兴酒", "花雕"], category: "condiment", allergens: ["wheat"] },
  { key: "oyster_sauce", name: "蚝油", aliases: [], category: "condiment", allergens: ["mollusc", "wheat"] },
  { key: "fish_sauce", name: "鱼露", aliases: [], category: "condiment", allergens: ["fish"] },
  { key: "starch", name: "淀粉", aliases: ["玉米淀粉", "生粉", "土豆淀粉", "水淀粉"], category: "condiment", allergens: [] },
  { key: "white_pepper", name: "白胡椒粉", aliases: ["白胡椒", "胡椒粉"], category: "condiment", allergens: [] },
  // Common chicken bouillon brands list whole egg among the ingredients.
  { key: "chicken_bouillon", name: "鸡精", aliases: ["鸡粉"], category: "condiment", allergens: ["egg"] },
  { key: "msg", name: "味精", aliases: [], category: "condiment", allergens: [] },
  { key: "chili_bean_paste", name: "豆瓣酱", aliases: ["郫县豆瓣酱", "郫县豆瓣"], category: "condiment", allergens: ["soy", "wheat"] },
  { key: "sweet_bean_sauce", name: "甜面酱", aliases: [], category: "condiment", allergens: ["soy", "wheat"] },
  { key: "fermented_black_bean", name: "豆豉", aliases: [], category: "condiment", allergens: ["soy", "wheat"] },
  // Chili oil is often made with sesame seeds, and some versions with peanuts.
  { key: "chili_oil", name: "辣椒油", aliases: ["红油", "油泼辣子"], category: "condiment", allergens: ["sesame", "peanut"] },
  { key: "xo_sauce", name: "xo酱", aliases: [], category: "condiment", allergens: ["crustacean", "mollusc"] },
  { key: "five_spice", name: "五香粉", aliases: [], category: "condiment", allergens: [] },
  { key: "cumin", name: "孜然", aliases: ["孜然粉"], category: "condiment", allergens: [] },
  { key: "ketchup", name: "番茄酱", aliases: [], category: "condiment", allergens: [] },
  // --- Beverages used in cooking ---
  { key: "cola", name: "可乐", aliases: ["可口可乐"], category: "beverage", allergens: [] },
] as const satisfies readonly IngredientEntry[];

export type IngredientKey = (typeof INGREDIENTS)[number]["key"];
