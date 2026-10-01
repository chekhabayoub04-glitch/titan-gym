'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const TOTAL_MEMBERS = 600;
const BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const PHONE_PREFIX = '077700';
const PHONE_START = 0;
const PHONE_END = TOTAL_MEMBERS - 1;

const firstNames = [
  'محمد', 'يوسف', 'أمين', 'حمزة', 'عبد الرحمن', 'إسلام', 'ياسين', 'سفيان', 'أيوب', 'بلال',
  'ريان', 'أنس', 'وليد', 'فارس', 'إبراهيم', 'مراد', 'نبيل', 'كريم', 'مالك', 'طارق',
  'هشام', 'جمال', 'سامي', 'مصطفى', 'نور الدين'
];

const familyNames = [
  'بن علي', 'براهيمي', 'قادري', 'سلطاني', 'منصوري', 'بوزيان', 'حمودي', 'شريف',
  'عمراني', 'بلقاسم', 'زروقي', 'دراجي', 'بوخاري', 'قاسمي', 'رحماني', 'مزيان',
  'لعروسي', 'تيجاني', 'غربي', 'مرابط', 'عباسي', 'بوشارب', 'خليف', 'بن عيسى'
];

const plans = [
  { name: 'اشتراك شهر', price: 3000, days: 30 },
  { name: 'اشتراك شهرين', price: 5500, days: 60 },
  { name: 'اشتراك 3 أشهر', price: 7500, days: 90 },
  { name: 'اشتراك 6 أشهر', price: 14000, days: 180 },
  { name: 'اشتراك سنة كاملة VIP', price: 25000, days: 365 }
];

const goals = [
  'تضخيم وبناء عضلات',
  'تنشيف وحرق دهون',
  'كاليسثينكس ولياقة',
  'قوة بدنية'
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dateString(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + (days * DAY_MS));
}

function getStatus(endDate, today) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const daysRemaining = Math.round((end.getTime() - today.getTime()) / DAY_MS);
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 7) return 'expiring_soon';
  return 'active';
}

function loadSupabaseCredentials() {
  const configPath = path.join(__dirname, 'supabase-config.js');
  const config = fs.readFileSync(configPath, 'utf8');
  const readConstant = name => {
    const match = config.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*(['\"])(.*?)\\1`));
    return match ? match[2] : '';
  };

  const url = process.env.SUPABASE_URL || readConstant('SUPABASE_URL');
  const key = process.env.SUPABASE_KEY || readConstant('SUPABASE_KEY');
  if (!url || !key || key.includes('PASTE_YOUR_')) {
    throw new Error('Supabase URL/key is missing. Set SUPABASE_URL and SUPABASE_KEY or configure supabase-config.js.');
  }
  if (key.startsWith('sb_secret_')) {
    throw new Error('Refusing to use an sb_secret key. Use the configured publishable/anon key.');
  }
  return { url, key };
}

function buildMember(index, cohort, today) {
  const plan = plans[randomInt(0, plans.length - 1)];
  const name = `${firstNames[index % firstNames.length]} ${familyNames[Math.floor(index / firstNames.length) % familyNames.length]}`;
  const phone = `${PHONE_PREFIX}${String(PHONE_START + index).padStart(4, '0')}`;
  let start;
  let end;

  if (cohort === 'expired') {
    end = addUtcDays(today, -randomInt(10, 90));
    start = addUtcDays(end, -(plan.days - 1));
  } else if (cohort === 'active') {
    start = addUtcDays(today, -randomInt(0, 15));
    end = addUtcDays(start, plan.days - 1);
  } else {
    end = addUtcDays(today, randomInt(1, 7));
    start = addUtcDays(end, -(plan.days - 1));
  }

  const created = addUtcDays(start, randomInt(0, Math.max(0, Math.floor((today.getTime() - start.getTime()) / DAY_MS))));
  created.setUTCHours(randomInt(7, 21), randomInt(0, 59), 0, 0);

  return {
    name,
    phone,
    plan: plan.name,
    price: plan.price,
    goal: goals[randomInt(0, goals.length - 1)],
    start_date: dateString(start),
    end_date: dateString(end),
    created_at: created.toISOString()
  };
}

async function main() {
  const { url, key } = loadSupabaseCredentials();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const cohorts = [
    ...Array.from({ length: 300 }, (_, index) => buildMember(index, 'expired', today)),
    ...Array.from({ length: 200 }, (_, index) => buildMember(index + 300, 'active', today)),
    ...Array.from({ length: 100 }, (_, index) => buildMember(index + 500, 'expiring', today))
  ];

  const expected = { expired: 300, active: 200, expiring_soon: 100 };
  const generatedCounts = cohorts.reduce((counts, member) => {
    const status = getStatus(member.end_date, today);
    counts[status] += 1;
    return counts;
  }, { expired: 0, active: 0, expiring_soon: 0 });
  if (JSON.stringify(generatedCounts) !== JSON.stringify(expected)) {
    throw new Error(`Generated status distribution is invalid: ${JSON.stringify(generatedCounts)}`);
  }

  const phones = cohorts.map(member => member.phone);
  const { data: existingPhones, error: preflightError } = await supabase
    .from('members')
    .select('phone')
    .in('phone', phones);
  if (preflightError) throw preflightError;
  if (existingPhones.length) {
    throw new Error(`Seeder phone range already exists (${existingPhones.length} rows). No records were inserted.`);
  }

  const insertedIds = [];
  try {
    for (let offset = 0; offset < cohorts.length; offset += BATCH_SIZE) {
      const batch = cohorts.slice(offset, offset + BATCH_SIZE);
      const { data, error } = await supabase
        .from('members')
        .insert(batch)
        .select('id');
      if (error) throw error;
      if (data.length !== BATCH_SIZE) throw new Error(`Expected ${BATCH_SIZE} inserted rows; received ${data.length}.`);
      insertedIds.push(...data.map(row => row.id));
      console.log(`Inserted batch ${Math.floor(offset / BATCH_SIZE) + 1}/6 (${data.length} rows).`);
    }
  } catch (error) {
    if (insertedIds.length) {
      const { error: rollbackError } = await supabase.from('members').delete().in('id', insertedIds);
      if (rollbackError) console.error('Rollback failed; inserted IDs may remain:', rollbackError.message);
    }
    throw error;
  }

  const { count, error: countError } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true });
  if (countError) throw countError;
  console.log(JSON.stringify({
    inserted: insertedIds.length,
    totalMembersAfterSeed: count,
    statusDistribution: generatedCounts,
    batches: cohorts.length / BATCH_SIZE
  }, null, 2));
}

main().catch(error => {
  console.error('Member seed failed:', error.message);
  process.exitCode = 1;
});