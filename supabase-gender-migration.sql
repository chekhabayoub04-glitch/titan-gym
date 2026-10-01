alter table public.members
  add column if not exists gender text;

update public.members
set gender = case
  when phone ~ '^077700[0-9]{4}$'
    and right(phone, 4)::integer between 0 and 599 then
      case when (right(phone, 4)::integer % 20) < 7 then 'female' else 'male' end
  when lower(split_part(btrim(name), ' ', 1)) in (
    'آية', 'اية', 'سارة', 'مريم', 'فاطمة', 'خديجة', 'إيمان', 'ايمان',
    'نور', 'هدى', 'سلمى', 'ياسمين', 'ليلى', 'أمينة', 'امينة', 'حياة',
    'سمية', 'جميلة', 'نوال', 'رشيدة', 'لمياء', 'دنيا', 'صفاء', 'حنان',
    'ريم', 'آمال', 'امال', 'زينب', 'عائشة', 'عائشه', 'ملاك', 'إسراء', 'اسراء',
    'aya', 'sara', 'sarah', 'mariam', 'maryam', 'fatima', 'khadija', 'iman',
    'hoda', 'salma', 'yasmin', 'leila', 'amina', 'hayat', 'rim', 'zineb', 'asma'
  ) then 'female'
  else 'male'
end
where gender is null or gender not in ('male', 'female');

alter table public.members
  alter column gender set default 'male',
  alter column gender set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_gender_check'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_gender_check check (gender in ('male', 'female'));
  end if;
end
$$;
