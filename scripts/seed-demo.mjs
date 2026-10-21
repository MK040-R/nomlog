/**
 * Demo seed script — fills 30 days of realistic data for the first Supabase user.
 * Run with: node scripts/seed-demo.mjs
 * Reads credentials from .env.local automatically.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env.local ──────────────────────────────────────────────────────────
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env.local'), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map((p, i) => (i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim())))
);

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

function randomBetween(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function jitter(base, pct = 0.15) {
  return Math.round(base * (1 + (Math.random() - 0.5) * pct * 2));
}

// ── Demo meal templates ──────────────────────────────────────────────────────
const BREAKFASTS = [
  {
    raw_input: 'two boiled eggs and brown toast with butter and a cup of chai',
    food_items: [
      { name: 'Boiled eggs', portion: '2 medium', calories_kcal: 140, protein_g: 12, carbs_g: 1, fat_g: 10, fiber_g: 0 },
      { name: 'Brown toast', portion: '2 slices', calories_kcal: 160, protein_g: 6, carbs_g: 30, fat_g: 2, fiber_g: 4 },
      { name: 'Butter', portion: '1 tsp', calories_kcal: 35, protein_g: 0, carbs_g: 0, fat_g: 4, fiber_g: 0 },
      { name: 'Masala chai with milk', portion: '250 ml', calories_kcal: 60, protein_g: 3, carbs_g: 8, fat_g: 2, fiber_g: 0 },
    ],
    total_calories: 395, total_protein_g: 21, total_carbs_g: 39, total_fat_g: 18, total_fiber_g: 4,
  },
  {
    raw_input: 'oats with banana and honey and a glass of milk',
    food_items: [
      { name: 'Rolled oats', portion: '60g', calories_kcal: 230, protein_g: 8, carbs_g: 40, fat_g: 4, fiber_g: 6 },
      { name: 'Banana', portion: '1 medium', calories_kcal: 90, protein_g: 1, carbs_g: 23, fat_g: 0, fiber_g: 3 },
      { name: 'Honey', portion: '1 tbsp', calories_kcal: 60, protein_g: 0, carbs_g: 17, fat_g: 0, fiber_g: 0 },
      { name: 'Full-fat milk', portion: '200 ml', calories_kcal: 130, protein_g: 7, carbs_g: 10, fat_g: 7, fiber_g: 0 },
    ],
    total_calories: 510, total_protein_g: 16, total_carbs_g: 90, total_fat_g: 11, total_fiber_g: 9,
  },
  {
    raw_input: 'greek yogurt with granola and mixed berries',
    food_items: [
      { name: 'Greek yogurt', portion: '200g', calories_kcal: 120, protein_g: 17, carbs_g: 8, fat_g: 1, fiber_g: 0 },
      { name: 'Granola', portion: '40g', calories_kcal: 180, protein_g: 4, carbs_g: 28, fat_g: 6, fiber_g: 2 },
      { name: 'Mixed berries', portion: '80g', calories_kcal: 45, protein_g: 1, carbs_g: 10, fat_g: 0, fiber_g: 3 },
    ],
    total_calories: 345, total_protein_g: 22, total_carbs_g: 46, total_fat_g: 7, total_fiber_g: 5,
  },
  {
    raw_input: 'paratha with curd and pickle',
    food_items: [
      { name: 'Whole wheat paratha', portion: '2 medium', calories_kcal: 280, protein_g: 8, carbs_g: 40, fat_g: 10, fiber_g: 4 },
      { name: 'Curd', portion: '100g', calories_kcal: 60, protein_g: 4, carbs_g: 6, fat_g: 2, fiber_g: 0 },
      { name: 'Mixed pickle', portion: '1 tbsp', calories_kcal: 20, protein_g: 0, carbs_g: 2, fat_g: 1, fiber_g: 0 },
    ],
    total_calories: 360, total_protein_g: 12, total_carbs_g: 48, total_fat_g: 13, total_fiber_g: 4,
  },
];

const LUNCHES = [
  {
    raw_input: 'dal rice with sabzi and salad',
    food_items: [
      { name: 'Cooked rice', portion: '200g', calories_kcal: 260, protein_g: 5, carbs_g: 57, fat_g: 0, fiber_g: 1 },
      { name: 'Toor dal', portion: '150g cooked', calories_kcal: 150, protein_g: 10, carbs_g: 24, fat_g: 1, fiber_g: 6 },
      { name: 'Mixed vegetable sabzi', portion: '100g', calories_kcal: 80, protein_g: 2, carbs_g: 10, fat_g: 4, fiber_g: 3 },
      { name: 'Cucumber tomato salad', portion: '80g', calories_kcal: 25, protein_g: 1, carbs_g: 5, fat_g: 0, fiber_g: 1 },
    ],
    total_calories: 515, total_protein_g: 18, total_carbs_g: 96, total_fat_g: 5, total_fiber_g: 11,
  },
  {
    raw_input: 'chicken biryani two cups',
    food_items: [
      { name: 'Chicken biryani', portion: '350g', calories_kcal: 560, protein_g: 32, carbs_g: 68, fat_g: 16, fiber_g: 2 },
      { name: 'Raita', portion: '100g', calories_kcal: 55, protein_g: 3, carbs_g: 6, fat_g: 2, fiber_g: 0 },
    ],
    total_calories: 615, total_protein_g: 35, total_carbs_g: 74, total_fat_g: 18, total_fiber_g: 2,
  },
  {
    raw_input: 'grilled chicken salad with olive oil dressing',
    food_items: [
      { name: 'Grilled chicken breast', portion: '150g', calories_kcal: 230, protein_g: 43, carbs_g: 0, fat_g: 5, fiber_g: 0 },
      { name: 'Mixed greens', portion: '80g', calories_kcal: 20, protein_g: 2, carbs_g: 3, fat_g: 0, fiber_g: 2 },
      { name: 'Cherry tomatoes', portion: '60g', calories_kcal: 20, protein_g: 1, carbs_g: 4, fat_g: 0, fiber_g: 1 },
      { name: 'Olive oil dressing', portion: '1 tbsp', calories_kcal: 120, protein_g: 0, carbs_g: 0, fat_g: 14, fiber_g: 0 },
    ],
    total_calories: 390, total_protein_g: 46, total_carbs_g: 7, total_fat_g: 19, total_fiber_g: 3,
  },
  {
    raw_input: 'paneer butter masala with two rotis',
    food_items: [
      { name: 'Paneer butter masala', portion: '200g', calories_kcal: 320, protein_g: 14, carbs_g: 14, fat_g: 24, fiber_g: 2 },
      { name: 'Roti', portion: '2 medium', calories_kcal: 180, protein_g: 6, carbs_g: 36, fat_g: 2, fiber_g: 4 },
    ],
    total_calories: 500, total_protein_g: 20, total_carbs_g: 50, total_fat_g: 26, total_fiber_g: 6,
  },
];

const DINNERS = [
  {
    raw_input: 'grilled salmon with steamed broccoli and quinoa',
    food_items: [
      { name: 'Grilled salmon', portion: '180g', calories_kcal: 370, protein_g: 40, carbs_g: 0, fat_g: 22, fiber_g: 0 },
      { name: 'Steamed broccoli', portion: '150g', calories_kcal: 50, protein_g: 4, carbs_g: 8, fat_g: 0, fiber_g: 5 },
      { name: 'Quinoa', portion: '150g cooked', calories_kcal: 180, protein_g: 7, carbs_g: 32, fat_g: 3, fiber_g: 3 },
    ],
    total_calories: 600, total_protein_g: 51, total_carbs_g: 40, total_fat_g: 25, total_fiber_g: 8,
  },
  {
    raw_input: 'chicken soup with bread',
    food_items: [
      { name: 'Chicken vegetable soup', portion: '400ml', calories_kcal: 200, protein_g: 20, carbs_g: 14, fat_g: 6, fiber_g: 3 },
      { name: 'Whole wheat bread', portion: '2 slices', calories_kcal: 160, protein_g: 6, carbs_g: 30, fat_g: 2, fiber_g: 4 },
    ],
    total_calories: 360, total_protein_g: 26, total_carbs_g: 44, total_fat_g: 8, total_fiber_g: 7,
  },
  {
    raw_input: 'rajma chawal',
    food_items: [
      { name: 'Rajma curry', portion: '200g', calories_kcal: 240, protein_g: 14, carbs_g: 36, fat_g: 5, fiber_g: 10 },
      { name: 'Steamed rice', portion: '180g', calories_kcal: 234, protein_g: 5, carbs_g: 52, fat_g: 0, fiber_g: 1 },
    ],
    total_calories: 474, total_protein_g: 19, total_carbs_g: 88, total_fat_g: 5, total_fiber_g: 11,
  },
  {
    raw_input: 'omelette with vegetables and two slices of toast',
    food_items: [
      { name: 'Masala omelette', portion: '3 eggs', calories_kcal: 260, protein_g: 19, carbs_g: 4, fat_g: 19, fiber_g: 1 },
      { name: 'Whole wheat toast', portion: '2 slices', calories_kcal: 160, protein_g: 6, carbs_g: 30, fat_g: 2, fiber_g: 4 },
    ],
    total_calories: 420, total_protein_g: 25, total_carbs_g: 34, total_fat_g: 21, total_fiber_g: 5,
  },
];

const SNACKS = [
  {
    raw_input: 'handful of mixed nuts',
    food_items: [
      { name: 'Mixed nuts', portion: '30g', calories_kcal: 180, protein_g: 5, carbs_g: 6, fat_g: 16, fiber_g: 2 },
    ],
    total_calories: 180, total_protein_g: 5, total_carbs_g: 6, total_fat_g: 16, total_fiber_g: 2,
  },
  {
    raw_input: 'banana and a glass of buttermilk',
    food_items: [
      { name: 'Banana', portion: '1 medium', calories_kcal: 90, protein_g: 1, carbs_g: 23, fat_g: 0, fiber_g: 3 },
      { name: 'Buttermilk', portion: '200ml', calories_kcal: 40, protein_g: 3, carbs_g: 5, fat_g: 1, fiber_g: 0 },
    ],
    total_calories: 130, total_protein_g: 4, total_carbs_g: 28, total_fat_g: 1, total_fiber_g: 3,
  },
  {
    raw_input: 'protein bar',
    food_items: [
      { name: 'Protein bar', portion: '60g', calories_kcal: 210, protein_g: 20, carbs_g: 22, fat_g: 6, fiber_g: 3 },
    ],
    total_calories: 210, total_protein_g: 20, total_carbs_g: 22, total_fat_g: 6, total_fiber_g: 3,
  },
  {
    raw_input: 'apple with peanut butter',
    food_items: [
      { name: 'Apple', portion: '1 medium', calories_kcal: 80, protein_g: 0, carbs_g: 21, fat_g: 0, fiber_g: 4 },
      { name: 'Peanut butter', portion: '1 tbsp', calories_kcal: 95, protein_g: 4, carbs_g: 3, fat_g: 8, fiber_g: 1 },
    ],
    total_calories: 175, total_protein_g: 4, total_carbs_g: 24, total_fat_g: 8, total_fiber_g: 5,
  },
];

const TIPS = [
  'Your protein intake has been solid this week. Try to spread it evenly across meals for better absorption.',
  'Great job hitting your fiber goal yesterday! Legumes and veggies are doing the heavy lifting.',
  'You logged water consistently — keep it up. Aim for 8 glasses on your workout days.',
  'Your lunch calories trend slightly high. A lighter dinner on those days helps balance things out.',
  'You\'re averaging 1,750 kcal this week — right on track for your goal. Keep the momentum.',
  'Consider adding a handful of nuts to your afternoon snack for sustained energy.',
  'Your carb intake spikes on weekends. Nothing wrong with that — just something to be aware of.',
];

const WEEKLY_RECAPS = [
  'Strong week overall. You logged meals on 6 of 7 days and averaged 1,780 calories — very close to your target. Protein was consistently above 80g, which is great for maintaining muscle. The one miss was Saturday dinner, but that\'s a blip, not a pattern. Heading into next week, try to keep Sunday lunches a bit lighter.',
  'This week you hit your calorie goal 5 days out of 7. Your best day nutritionally was Wednesday — balanced macros, high fiber, and 8 glasses of water. Weight is trending down by about 0.3 kg from last week\'s average. A small but real signal that the deficit is working.',
  'You logged every single day this week — that consistency is what makes progress visible. Calories averaged 1,820, slightly above target, driven by the biryani on Thursday. Still within a reasonable range. Weight stable this week, which after last week\'s drop likely means water retention. Stay the course.',
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  // 1. Find user by email
  const TARGET_EMAIL = process.env.SEED_EMAIL || 'your@email.com';
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (userErr) { console.error('Cannot list users:', userErr.message); process.exit(1); }
  const user = users?.users?.find(u => u.email === TARGET_EMAIL);
  if (!user) { console.error(`User ${TARGET_EMAIL} not found. Sign in once first.`); process.exit(1); }
  const uid  = user.id;
  console.log(`Seeding demo data for: ${user.email} (${uid})`);

  // 2. Upsert profile
  const { error: profErr } = await supabase.from('user_profiles').upsert({
    id: uid,
    name: 'Murali',
    age: 34,
    weight_kg: 82.5,
    height_cm: 176,
    goal_calories: 1800,
    goal_protein_g: 120,
    goal_carbs_g: 200,
    goal_fat_g: 60,
    goal_fiber_g: 30,
    goal_weight_kg: 76,
    goal_type: 'loss',
    goal_target_weeks: 16,
  }, { onConflict: 'id' });
  if (profErr) { console.error('Profile error:', profErr.message); process.exit(1); }
  console.log('✓ Profile');

  // 3. Meal logs — 30 days
  const meals = [];
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day = daysAgo(dayOffset);

    const breakfast = BREAKFASTS[dayOffset % BREAKFASTS.length];
    const lunch     = LUNCHES[dayOffset % LUNCHES.length];
    const dinner    = DINNERS[dayOffset % DINNERS.length];
    const snack     = SNACKS[dayOffset % SNACKS.length];

    const at = (h, m = 0) => {
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    meals.push({
      user_id: uid, meal_type: 'breakfast', logged_at: at(8, randomBetween(0, 30)),
      raw_input: breakfast.raw_input, food_items: breakfast.food_items,
      total_calories: jitter(breakfast.total_calories, 0.05),
      total_protein_g: jitter(breakfast.total_protein_g, 0.05),
      total_carbs_g:   jitter(breakfast.total_carbs_g, 0.05),
      total_fat_g:     jitter(breakfast.total_fat_g, 0.05),
      total_fiber_g:   jitter(breakfast.total_fiber_g, 0.05),
      confidence: 'high', input_source: 'voice',
    });
    meals.push({
      user_id: uid, meal_type: 'lunch', logged_at: at(13, randomBetween(0, 45)),
      raw_input: lunch.raw_input, food_items: lunch.food_items,
      total_calories: jitter(lunch.total_calories, 0.05),
      total_protein_g: jitter(lunch.total_protein_g, 0.05),
      total_carbs_g:   jitter(lunch.total_carbs_g, 0.05),
      total_fat_g:     jitter(lunch.total_fat_g, 0.05),
      total_fiber_g:   jitter(lunch.total_fiber_g, 0.05),
      confidence: 'high', input_source: dayOffset % 3 === 0 ? 'text' : 'voice',
    });
    // skip dinner on 2 days to look realistic
    if (dayOffset !== 5 && dayOffset !== 19) {
      meals.push({
        user_id: uid, meal_type: 'dinner', logged_at: at(20, randomBetween(0, 30)),
        raw_input: dinner.raw_input, food_items: dinner.food_items,
        total_calories: jitter(dinner.total_calories, 0.05),
        total_protein_g: jitter(dinner.total_protein_g, 0.05),
        total_carbs_g:   jitter(dinner.total_carbs_g, 0.05),
        total_fat_g:     jitter(dinner.total_fat_g, 0.05),
        total_fiber_g:   jitter(dinner.total_fiber_g, 0.05),
        confidence: 'high', input_source: 'voice',
      });
    }
    // snack only on 20 of 30 days
    if (dayOffset % 3 !== 2) {
      meals.push({
        user_id: uid, meal_type: 'snack', logged_at: at(16, randomBetween(0, 30)),
        raw_input: snack.raw_input, food_items: snack.food_items,
        total_calories: jitter(snack.total_calories, 0.05),
        total_protein_g: jitter(snack.total_protein_g, 0.05),
        total_carbs_g:   jitter(snack.total_carbs_g, 0.05),
        total_fat_g:     jitter(snack.total_fat_g, 0.05),
        total_fiber_g:   jitter(snack.total_fiber_g, 0.05),
        confidence: 'medium', input_source: 'text',
      });
    }
  }
  const { error: mealErr } = await supabase.from('meal_logs').insert(meals);
  if (mealErr) { console.error('Meal logs error:', mealErr.message); process.exit(1); }
  console.log(`✓ Meal logs (${meals.length} entries)`);

  // 4. Weight logs — gradual downward trend 84 → 81 kg over 30 days
  const weights = [];
  for (let i = 29; i >= 0; i--) {
    const startW = 84.2;
    const endW   = 81.4;
    const progress = (29 - i) / 29;
    const w = +(startW - (startW - endW) * progress + (Math.random() - 0.5) * 0.4).toFixed(1);
    weights.push({ user_id: uid, logged_on: dateStr(daysAgo(i)), weight_kg: w });
  }
  const { error: wErr } = await supabase.from('weight_logs')
    .upsert(weights, { onConflict: 'user_id,logged_on' });
  if (wErr) { console.error('Weight logs error:', wErr.message); process.exit(1); }
  console.log(`✓ Weight logs (${weights.length} entries)`);

  // 5. Water logs
  const water = [];
  for (let i = 29; i >= 0; i--) {
    water.push({ user_id: uid, logged_on: dateStr(daysAgo(i)), glasses: randomBetween(5, 9) });
  }
  const { error: waterErr } = await supabase.from('water_logs')
    .upsert(water, { onConflict: 'user_id,logged_on' });
  if (waterErr) { console.error('Water logs error:', waterErr.message); process.exit(1); }
  console.log(`✓ Water logs (${water.length} entries)`);

  // 6. Daily tips — last 7 days
  const tips = [];
  for (let i = 6; i >= 0; i--) {
    tips.push({ user_id: uid, tip_date: dateStr(daysAgo(i)), tip: TIPS[i % TIPS.length] });
  }
  const { error: tipErr } = await supabase.from('daily_tips')
    .upsert(tips, { onConflict: 'user_id,tip_date' });
  if (tipErr) { console.error('Daily tips error:', tipErr.message); process.exit(1); }
  console.log(`✓ Daily tips (${tips.length} entries)`);

  // 7. Weekly recaps — last 3 Mondays
  const recaps = [];
  for (let i = 0; i < 3; i++) {
    // find Monday i weeks ago
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1 - i * 7); // Monday
    recaps.push({ user_id: uid, week_start: dateStr(d), recap: WEEKLY_RECAPS[i] });
  }
  const { error: recapErr } = await supabase.from('weekly_recaps')
    .upsert(recaps, { onConflict: 'user_id,week_start' });
  if (recapErr) { console.error('Weekly recaps error:', recapErr.message); process.exit(1); }
  console.log(`✓ Weekly recaps (${recaps.length} entries)`);

  // 8. Favorite meals
  const favs = [
    {
      user_id: uid,
      sig: 'boiled eggs|brown toast|butter|masala chai',
      label: 'Egg & Toast Breakfast',
      items: BREAKFASTS[0].food_items,
    },
    {
      user_id: uid,
      sig: 'grilled chicken breast|mixed greens|cherry tomatoes|olive oil dressing',
      label: 'Chicken Salad',
      items: LUNCHES[2].food_items,
    },
    {
      user_id: uid,
      sig: 'mixed nuts',
      label: 'Afternoon Nuts',
      items: SNACKS[0].food_items,
    },
  ];
  const { error: favErr } = await supabase.from('favorite_meals')
    .upsert(favs, { onConflict: 'user_id,sig' });
  if (favErr) { console.error('Favorite meals error:', favErr.message); process.exit(1); }
  console.log(`✓ Favorite meals (${favs.length} entries)`);

  console.log('\n✅ Demo seed complete. Sign in to see your data.');
}

seed().catch(err => { console.error(err); process.exit(1); });
