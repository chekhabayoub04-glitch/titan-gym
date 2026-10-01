'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const TOTAL_MEMBERS = 600;
const BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const PHONE_PREFIX = '077700';

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

function makeMember(index, plan, startDate, cohort, today) {
  const endDate = addUtcDays(startDate, plan.days - 1);
  if (getStatus(dateString(endDate), today) !== cohort) {
    throw new Error(`Generated ${cohort} member has an invalid end date.`);
  }
  const name = `${firstNames[index % firstNames.length]} ${familyNames[Math.floor(index / firstNames.length) % familyNames.length]}`;
  const phone = `${PHONE_PREFIX}${String(index).padStart(4, '0')}`;
  const createdAt = new Date(startDate.getTime());
  createdAt.setUTCHours(10 + (index % 9), index % 60, 0, 0);

  return {
    name,
    phone,
    plan: plan.name,
    price: plan.price,
    goal: goals[index % goals.length],
    start_date: dateString(startDate),
    end_date: dateString(endDate),
    created_at: createdAt.toISOString()
  };
}

function buildDataset(today) {
  const year = today.getUTCFullYear();
  const rows = [];
  let index = 0;

  const expiredSchedule = [
    { planIndex: 0, month: 4, count: 10, minDay: 1, maxDay: 31 },
    { planIndex: 0, month: 5, count: 15, minDay: 1, maxDay: 30 },
    { planIndex: 0, month: 6, count: 25, minDay: 1, maxDay: 31 },
    { planIndex: 0, month: 7, count: 70, minDay: 1, maxDay: 31 },
    { planIndex: 1, month: 3, count: 10, minDay: 1, maxDay: 30 },
    { planIndex: 1, month: 4, count: 10, minDay: 1, maxDay: 31 },
    { planIndex: 1, month: 5, count: 20, minDay: 1, maxDay: 30 },
    { planIndex: 1, month: 6, count: 39, minDay: 1, maxDay: 31 },
    { planIndex: 1, month: 7, count: 1, minDay: 1, maxDay: 1 },
    { planIndex: 2, month: 3, count: 15, minDay: 1, maxDay: 30 },
    { planIndex: 2, month: 4, count: 15, minDay: 1, maxDay: 31 },
    { planIndex: 2, month: 5, count: 15, minDay: 1, maxDay: 30 },
    { planIndex: 2, month: 6, count: 15, minDay: 1, maxDay: 3 },
    { planIndex: 3, month: 3, count: 40, minDay: 1, maxDay: 3 }
  ];

  expiredSchedule.forEach(({ planIndex, month, count, minDay, maxDay }) => {
    for (let item = 0; item < count; item += 1) {
      const start = new Date(Date.UTC(year, month, randomInt(minDay, maxDay)));
      rows.push(makeMember(index++, plans[planIndex], start, 'expired', today));
    }
  });

  // Stagger upcoming renewals across April, July, August, and September signups.
  const expiringPlanIndexes = [0, 1, 2, 3];
  for (let item = 0; item < 100; item += 1) {
    const plan = plans[expiringPlanIndexes[item % expiringPlanIndexes.length]];
    const end = addUtcDays(today, (item % 7) + 1);
    const start = addUtcDays(end, -(plan.days - 1));
    rows.push(makeMember(index++, plan, start, 'expiring_soon', today));
  }

  // Concentrate new registrations in late September and early October.
  for (let item = 0; item < 200; item += 1) {
    const start = item < 130
      ? new Date(Date.UTC(year, 8, 16 + (item % 15)))
      : new Date(Date.UTC(year, 9, 1));
    rows.push(makeMember(index++, plans[item % plans.length], start, 'active', today));
  }

  if (rows.length !== TOTAL_MEMBERS) throw new Error(`Expected ${TOTAL_MEMBERS} rows; generated ${rows.length}.`);
  return rows;
}

function validateDataset(rows, today) {
  const expected = { expired: 300, active: 200, expiring_soon: 100 };
  const counts = { expired: 0, active: 0, expiring_soon: 0 };
  const phones = new Set();

  rows.forEach(member => {
    const status = getStatus(member.end_date, today);
    counts[status] += 1;
    if (!member.start_date.startsWith(`${today.getUTCFullYear()}-`)) throw new Error(`Non-${today.getUTCFullYear()} start date: ${member.start_date}.`);
    if (phones.has(member.phone)) throw new Error(`Duplicate generated phone: ${member.phone}.`);
    phones.add(member.phone);

    const plan = plans.find(candidate => candidate.name === member.plan);
    const expectedEnd = dateString(addUtcDays(new Date(`${member.start_date}T00:00:00.000Z`), plan.days - 1));
    if (member.price !== plan.price || member.end_date !== expectedEnd) {
      throw new Error(`Plan price or end date mismatch for ${member.phone}.`);
    }
  });

  if (JSON.stringify(counts) !== JSON.stringify(expected)) {
    throw new Error(`Generated status distribution is invalid: ${JSON.stringify(counts)}`);
  }
  return counts;
}

async function fetchSeedRows(supabase) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .gte('phone', `${PHONE_PREFIX}0000`)
    .lte('phone', `${PHONE_PREFIX}${String(TOTAL_MEMBERS - 1).padStart(4, '0')}`);
  if (error) throw error;
  if (data.length && (data.length !== TOTAL_MEMBERS || data.some(member => !new RegExp(`^${PHONE_PREFIX}\\d{4}$`).test(member.phone)))) {
    throw new Error(`Refusing to clear the seed range: found ${data.length} rows, expected either 0 or ${TOTAL_MEMBERS} known test rows.`);
  }
  return data;
}

async function deleteIdsInBatches(supabase, ids, deletedIds = []) {
  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    const batch = ids.slice(offset, offset + BATCH_SIZE);
    const { data, error } = await supabase.from('members').delete().in('id', batch).select('id');
    if (error) throw error;
    deletedIds.push(...data.map(row => row.id));
  }
  return deletedIds;
}

async function insertInBatches(supabase, rows) {
  const insertedIds = [];
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const { data, error } = await supabase.from('members').insert(batch).select('id');
    if (error) throw error;
    if (data.length !== BATCH_SIZE) throw new Error(`Expected ${BATCH_SIZE} inserted rows; received ${data.length}.`);
    insertedIds.push(...data.map(row => row.id));
    console.log(`Inserted batch ${Math.floor(offset / BATCH_SIZE) + 1}/6 (${data.length} rows).`);
  }
  return insertedIds;
}

async function restoreRows(supabase, rows) {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const { error } = await supabase.from('members').insert(rows.slice(offset, offset + BATCH_SIZE));
    if (error) throw error;
  }
}

async function main() {
  const { url, key } = loadSupabaseCredentials();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const rows = buildDataset(today);
  const statusDistribution = validateDataset(rows, today);
  const monthlyDistribution = rows.reduce((months, member) => {
    const month = member.start_date.slice(0, 7);
    months[month] = (months[month] || 0) + 1;
    return months;
  }, {});

  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({
      dryRun: true,
      generated: rows.length,
      statusDistribution,
      monthlySignupDistribution: monthlyDistribution,
      planDistribution: rows.reduce((counts, member) => {
        counts[member.plan] = (counts[member.plan] || 0) + 1;
        return counts;
      }, {})
    }, null, 2));
    return;
  }

  const previousSeedRows = await fetchSeedRows(supabase);
  const deletedOldIds = [];
  let insertedIds = [];

  try {
    if (previousSeedRows.length) {
      await deleteIdsInBatches(supabase, previousSeedRows.map(row => row.id), deletedOldIds);
      console.log(`Removed ${deletedOldIds.length} previous synthetic members from the dedicated seed range.`);
    }
    insertedIds = await insertInBatches(supabase, rows);
  } catch (error) {
    try {
      if (insertedIds.length) await deleteIdsInBatches(supabase, insertedIds);
      const deletedSet = new Set(deletedOldIds.map(String));
      const deletedBackup = previousSeedRows.filter(row => deletedSet.has(String(row.id)));
      if (deletedBackup.length) await restoreRows(supabase, deletedBackup);
    } catch (rollbackError) {
      console.error('Recovery failed; manual review may be required:', rollbackError.message);
    }
    throw error;
  }

  const { data: seededRows, error: verifyError } = await supabase
    .from('members')
    .select('phone, plan, price, start_date, end_date')
    .gte('phone', `${PHONE_PREFIX}0000`)
    .lte('phone', `${PHONE_PREFIX}${String(TOTAL_MEMBERS - 1).padStart(4, '0')}`);
  if (verifyError) throw verifyError;
  const verifiedDistribution = seededRows.reduce((counts, row) => {
    counts[getStatus(row.end_date, today)] += 1;
    return counts;
  }, { expired: 0, active: 0, expiring_soon: 0 });
  if (seededRows.length !== TOTAL_MEMBERS || JSON.stringify(verifiedDistribution) !== JSON.stringify(statusDistribution)) {
    throw new Error(`Post-insert verification failed: ${seededRows.length} rows, ${JSON.stringify(verifiedDistribution)}.`);
  }

  const { count, error: countError } = await supabase.from('members').select('id', { count: 'exact', head: true });
  if (countError) throw countError;
  const verifiedMonthlyDistribution = seededRows.reduce((months, row) => {
    const month = row.start_date.slice(0, 7);
    months[month] = (months[month] || 0) + 1;
    return months;
  }, {});

  console.log(JSON.stringify({
    replacedSyntheticMembers: previousSeedRows.length,
    inserted: seededRows.length,
    totalMembersAfterReseed: count,
    statusDistribution: verifiedDistribution,
    monthlySignupDistribution: Object.fromEntries(Object.entries(verifiedMonthlyDistribution).sort(([first], [second]) => first.localeCompare(second))),
    batches: seededRows.length / BATCH_SIZE
  }, null, 2));
}

main().catch(error => {
  console.error('Member seed failed:', error.message);
  process.exitCode = 1;
});