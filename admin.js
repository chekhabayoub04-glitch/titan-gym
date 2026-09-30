'use strict';

(() => {
  // Browser-only demo authentication is not a security boundary; production access belongs on a server.
  const LEGACY_STORAGE_KEY = 'titan_members';
  const LEGACY_MIGRATION_KEY = 'titan_members_supabase_migration';
  const AUTH_KEY = 'titan_admin_authenticated';
  const ADMIN_PASSCODE = '1234';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const PLAN_CATALOG = [
    { id: 'one-month', name: 'اشتراك شهر', price: 3000, days: 30 },
    { id: 'two-months', name: 'اشتراك شهرين', price: 5500, days: 60 },
    { id: 'three-months', name: 'اشتراك 3 أشهر', price: 7500, days: 90 },
    { id: 'six-months', name: 'اشتراك 6 أشهر', price: 14000, days: 180 },
    { id: 'vip-year', name: 'اشتراك سنة كاملة VIP', price: 25000, days: 365 }
  ];

  const elements = {
    authGate: document.getElementById('authGate'),
    authForm: document.getElementById('authForm'),
    adminPasscode: document.getElementById('adminPasscode'),
    authError: document.getElementById('authError'),
    appShell: document.getElementById('appShell'),
    logoutButton: document.getElementById('logoutButton'),
    todayDate: document.getElementById('todayDate'),
    totalMembers: document.getElementById('totalMembers'),
    activeMembers: document.getElementById('activeMembers'),
    expiringMembers: document.getElementById('expiringMembers'),
    totalRevenue: document.getElementById('totalRevenue'),
    search: document.getElementById('memberSearch'),
    tableBody: document.getElementById('membersTableBody'),
    emptyState: document.getElementById('emptyState'),
    emptyTitle: document.getElementById('emptyTitle'),
    emptyMessage: document.getElementById('emptyMessage'),
    visibleCount: document.getElementById('visibleCount'),
    memberDialog: document.getElementById('memberDialog'),
    memberForm: document.getElementById('memberForm'),
    dialogTitle: document.getElementById('dialogTitle'),
    saveMemberButton: document.getElementById('saveMemberButton'),
    memberName: document.getElementById('memberName'),
    memberPhone: document.getElementById('memberPhone'),
    memberPlan: document.getElementById('member-plan'),
    startDate: document.getElementById('startDate'),
    planSummary: document.getElementById('planSummary'),
    memberFormError: document.getElementById('memberFormError'),
    toast: document.getElementById('toast'),
    sidebar: document.getElementById('sidebar'),
    menuToggle: document.getElementById('menuToggle')
  };

  let members = [];
  let toastTimer;
  let editingMemberId = null;
  let realtimeChannel = null;
  let realtimeFallbackTimer = null;
  let refreshPromise = null;

  const numberFormat = new Intl.NumberFormat('ar-DZ');
  const dateFormat = new Intl.DateTimeFormat('ar-DZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || '');
    if (!match) return null;
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
    return date;
  }

  function dateToDayNumber(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
  }

  function getMemberStatus(member, today = new Date()) {
    const startDate = parseLocalDate(member.startDate);
    const endDate = parseLocalDate(member.endDate);
    if (!startDate || !endDate) return { key: 'expired', label: 'منتهي', remaining: -1 };

    // Expiry is inclusive: the end date itself remains valid, then enters the 7-day warning window.
    const remaining = dateToDayNumber(endDate) - dateToDayNumber(today);
    if (remaining < 0) return { key: 'expired', label: 'منتهي', remaining };
    if (remaining <= 7) return { key: 'expiring', label: 'ينتهي قريباً', remaining };
    return { key: 'active', label: 'نشط', remaining };
  }

  function calculateEndDate(startDateString, durationDays) {
    const startDate = parseLocalDate(startDateString);
    if (!startDate || !Number.isInteger(durationDays) || durationDays < 1) return '';
    // Count the start date as day one so a 7-day plan ends six calendar days later.
    startDate.setDate(startDate.getDate() + durationDays - 1);
    return localDateString(startDate);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function normalizeMember(record) {
    if (!record || typeof record !== 'object') return null;
    const name = String(record.name || '').trim().slice(0, 80);
    const phone = String(record.phone || '').trim().slice(0, 24);
    const startDate = String(record.startDate || record.start_date || '');
    const endDate = String(record.endDate || record.end_date || '');
    const rawPlan = String(record.plan || record.planName || '').trim().slice(0, 40);
    const price = Number(record.price);
    const planMatch = PLAN_CATALOG.find(plan => plan.id === record.planId)
      || PLAN_CATALOG.find(plan => plan.name === rawPlan && plan.price === price);
    const planName = String(record.planName || planMatch?.name || rawPlan).trim().slice(0, 40);
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const calculatedDuration = start && end ? dateToDayNumber(end) - dateToDayNumber(start) + 1 : 0;
    const durationDays = Number(record.durationDays || planMatch?.days || calculatedDuration);
    if (!name || !phone || !parseLocalDate(startDate) || !parseLocalDate(endDate) || !planName || !Number.isFinite(price) || price < 0 || !Number.isInteger(durationDays) || durationDays < 1) return null;

    return {
      id: String(record.id || createId()),
      name,
      phone,
      plan: rawPlan || planName,
      planId: String(record.planId || planMatch?.id || ''),
      planName,
      price,
      durationDays,
      startDate,
      endDate,
      goal: String(record.goal || '').trim().slice(0, 100),
      createdAt: String(record.createdAt || record.created_at || new Date().toISOString())
    };
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return `member-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function loadMembers() {
    if (!window.titanSupabaseConfigured || !window.titanSupabase) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await window.titanSupabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(normalizeMember).filter(Boolean);
  }

  function toDatabaseMember(member) {
    const createdAt = new Date(member.createdAt);
    return {
      name: member.name,
      phone: member.phone,
      plan: member.planName,
      price: member.price,
      goal: member.goal || null,
      start_date: member.startDate,
      end_date: member.endDate,
      created_at: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString()
    };
  }

  function memberFingerprint(record) {
    const createdAt = new Date(record.created_at || record.createdAt || '');
    return JSON.stringify([
      String(record.name || '').trim(),
      String(record.phone || '').trim(),
      String(record.plan || record.planName || '').trim(),
      Number(record.price),
      String(record.start_date || record.startDate || ''),
      String(record.end_date || record.endDate || ''),
      Number.isNaN(createdAt.getTime()) ? '' : createdAt.toISOString()
    ]);
  }

  async function migrateLegacyMembers() {
    if (!window.titanSupabaseConfigured || !window.titanSupabase) return;

    let legacyJson;
    let lockValue;
    try {
      if (localStorage.getItem(LEGACY_MIGRATION_KEY) === 'complete') return;
      legacyJson = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyJson === null) return;

      const migrationState = localStorage.getItem(LEGACY_MIGRATION_KEY) || '';
      const lockTime = Number(migrationState.replace('running:', ''));
      if (migrationState.startsWith('running:') && Date.now() - lockTime < 120000) return;

      lockValue = `running:${Date.now()}`;
      localStorage.setItem(LEGACY_MIGRATION_KEY, lockValue);
    } catch (error) {
      throw new Error(`Unable to access legacy browser data: ${error.message}`);
    }

    try {
      const legacyRecords = JSON.parse(legacyJson);
      if (!Array.isArray(legacyRecords)) throw new Error('Legacy member data is not an array.');
      const normalized = legacyRecords.map(normalizeMember);
      if (normalized.some(member => !member)) throw new Error('Some legacy member records are invalid; source data was kept.');

      if (normalized.length) {
        const { data: cloudRecords, error: selectError } = await window.titanSupabase
          .from('members')
          .select('name, phone, plan, price, start_date, end_date, created_at');
        if (selectError) throw selectError;

        const knownFingerprints = new Set(cloudRecords.map(memberFingerprint));
        const recordsToInsert = [];
        normalized.forEach(member => {
          const databaseRecord = toDatabaseMember(member);
          const fingerprint = memberFingerprint(databaseRecord);
          if (knownFingerprints.has(fingerprint)) return;
          knownFingerprints.add(fingerprint);
          recordsToInsert.push(databaseRecord);
        });

        if (recordsToInsert.length) {
          const { error: insertError } = await window.titanSupabase.from('members').insert(recordsToInsert);
          if (insertError) throw insertError;
        }
      }

      localStorage.setItem(LEGACY_MIGRATION_KEY, 'complete');
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      try {
        if (localStorage.getItem(LEGACY_MIGRATION_KEY) === lockValue) localStorage.removeItem(LEGACY_MIGRATION_KEY);
      } catch (storageError) {
        console.warn('Could not release the local migration lock:', storageError);
      }
      throw error;
    }
  }

  async function refreshMembers(showUpdateMessage = false) {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        members = await loadMembers();
        renderAll();
        if (showUpdateMessage) showToast('تم تحديث بيانات المشتركين من قاعدة البيانات.');
      } catch (error) {
        console.error('Unable to refresh Titan Gym members:', error);
        showToast('تعذر تحديث البيانات من Supabase.', true);
      }
    })();

    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  function startRealtimeFallback() {
    if (realtimeFallbackTimer) return;
    console.warn('Supabase Realtime is unavailable; refreshing members every 15 seconds. Add public.members to supabase_realtime for instant updates.');
    realtimeFallbackTimer = window.setInterval(() => refreshMembers(false), 15000);
  }

  function stopRealtimeFallback() {
    if (!realtimeFallbackTimer) return;
    window.clearInterval(realtimeFallbackTimer);
    realtimeFallbackTimer = null;
  }

  function subscribeToMemberChanges() {
    if (!window.titanSupabaseConfigured || !window.titanSupabase) return;
    if (realtimeChannel) window.titanSupabase.removeChannel(realtimeChannel);

    realtimeChannel = window.titanSupabase
      .channel('titan-gym-members-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => refreshMembers(true))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          stopRealtimeFallback();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startRealtimeFallback();
        }
      });
  }

  function unsubscribeFromMemberChanges() {
    stopRealtimeFallback();
    if (!realtimeChannel || !window.titanSupabase) return;
    window.titanSupabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  function formatDate(dateString) {
    const date = parseLocalDate(dateString);
    return date ? dateFormat.format(date) : '—';
  }

  function getSearchableText(value) {
    return String(value).toLocaleLowerCase('ar-DZ').replace(/[\s()-]/g, '');
  }

  function getFilteredMembers() {
    const query = getSearchableText(elements.search.value.trim());
    if (!query) return members;
    return members.filter(member => getSearchableText(member.name).includes(query) || getSearchableText(member.phone).includes(query));
  }

  function renderStats() {
    const today = new Date();
    const statuses = members.map(member => getMemberStatus(member, today));
    const activeCount = statuses.filter(status => status.key !== 'expired').length;
    const expiringCount = statuses.filter(status => status.key === 'expiring').length;
    // This is the total value of all recorded plans, not verified cash received.
    const revenue = members.reduce((total, member) => total + member.price, 0);

    elements.totalMembers.textContent = numberFormat.format(members.length);
    elements.activeMembers.textContent = numberFormat.format(activeCount);
    elements.expiringMembers.textContent = numberFormat.format(expiringCount);
    elements.totalRevenue.innerHTML = `${numberFormat.format(revenue)} <small>دج</small>`;
  }

  function renderMembers() {
    const filteredMembers = getFilteredMembers();
    const today = new Date();

    elements.tableBody.innerHTML = filteredMembers.map(member => {
      const status = getMemberStatus(member, today);
      const initials = Array.from(member.name.trim())[0] || '؟';
      const safeName = escapeHtml(member.name);
      const safePhone = escapeHtml(member.phone);
      const safePlanName = escapeHtml(member.planName);
      const safeInitial = escapeHtml(initials);
      return `<tr>
        <td><div class="member-cell"><span class="member-avatar" aria-hidden="true">${safeInitial}</span><span class="member-name">${safeName}</span></div></td>
        <td class="phone-cell" dir="ltr">${safePhone}</td>
        <td>${safePlanName}<span class="plan-price">${numberFormat.format(member.price)} دج · ${numberFormat.format(member.durationDays)} يوم</span></td>
        <td>${formatDate(member.startDate)}</td>
        <td>${formatDate(member.endDate)}</td>
        <td><span class="status-badge status-${status.key}">${status.label}</span></td>
        <td><div class="row-actions">
          <button class="edit-button" type="button" data-edit-id="${escapeHtml(member.id)}" aria-label="تعديل اشتراك ${safeName}" title="تعديل المشترك"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button class="delete-button" type="button" data-delete-id="${escapeHtml(member.id)}" aria-label="حذف اشتراك ${safeName}" title="حذف المشترك"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div></td>
      </tr>`;
    }).join('');

    const hasMembers = members.length > 0;
    const hasResults = filteredMembers.length > 0;
    elements.emptyState.hidden = hasResults;
    elements.tableBody.hidden = !hasResults;
    elements.emptyTitle.textContent = hasMembers ? 'لا توجد نتائج مطابقة' : 'لا يوجد مشتركون بعد';
    elements.emptyMessage.textContent = hasMembers ? 'جرّب البحث باسم أو رقم هاتف مختلف.' : 'أضف أول مشترك لبدء إدارة سجلات الصالة.';
    document.getElementById('emptyAddButton').hidden = hasMembers;
    elements.visibleCount.textContent = `${numberFormat.format(filteredMembers.length)} من ${numberFormat.format(members.length)} مشترك`;
  }

  function renderAll() {
    renderStats();
    renderMembers();
  }

  function csvField(value) {
    let text = String(value ?? '');
    if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportMembersToCSV() {
    if (!members.length) {
      showToast('لا توجد بيانات مشتركين لتصديرها.', true);
      return;
    }

    try {
      const headers = ['الاسم', 'رقم الهاتف', 'الخطة', 'السعر (دج)', 'الهدف', 'تاريخ البدء', 'تاريخ الانتهاء', 'الحالة'];
      const today = new Date();
      const rows = members.map(member => {
        const status = getMemberStatus(member, today);
        return [
          member.name,
          member.phone,
          member.planName || member.plan,
          member.price,
          member.goal || '',
          member.startDate,
          member.endDate,
          status.key === 'expired' ? 'منتهي الصلاحية' : 'نشط'
        ];
      });
      const csv = `\uFEFF${[headers, ...rows].map(row => row.map(csvField).join(',')).join('\r\n')}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = objectUrl;
      downloadLink.download = `titan_members_${localDateString()}.csv`;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      showToast('تم تجهيز ملف CSV للتنزيل.');
    } catch (error) {
      console.error('Unable to export Titan Gym members:', error);
      showToast('تعذر إنشاء ملف التصدير.', true);
    }
  }

  function updatePlanSummary() {
    const selectedOption = elements.memberPlan.selectedOptions[0] || elements.memberPlan.options[elements.memberPlan.selectedIndex];
    if (!selectedOption) {
      elements.planSummary.textContent = '';
      return;
    }
    const days = Number(selectedOption.dataset.days);
    const price = Number(selectedOption.dataset.price);
    elements.planSummary.textContent = `مدة الاشتراك ${numberFormat.format(days)} يوماً · ${numberFormat.format(price)} دج`;
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle('is-error', isError);
    elements.toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 3200);
  }

  async function showDashboard() {
    elements.authGate.hidden = true;
    elements.appShell.hidden = false;
    elements.todayDate.textContent = new Intl.DateTimeFormat('ar-DZ', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date());
    elements.startDate.value = localDateString();
    try {
      await migrateLegacyMembers();
    } catch (error) {
      console.error('Legacy member migration failed:', error);
      showToast('تعذر نقل بعض البيانات المحلية القديمة. لم تُحذف البيانات الأصلية.', true);
    }

    try {
      members = await loadMembers();
      renderAll();
      subscribeToMemberChanges();
    } catch (error) {
      console.error('Unable to load Titan Gym members:', error);
      members = [];
      renderAll();
      showToast('تعذر الاتصال بقاعدة البيانات. تحقق من إعداد Supabase والاتصال.', true);
    }
  }

  function showLogin() {
    elements.appShell.hidden = true;
    elements.authGate.hidden = false;
    elements.adminPasscode.value = '';
    elements.authError.textContent = '';
    window.setTimeout(() => elements.adminPasscode.focus(), 0);
  }

  function openMemberDialog(member = null) {
    editingMemberId = member ? member.id : null;
    elements.memberForm.reset();
    elements.dialogTitle.textContent = member ? 'تعديل بيانات المشترك' : 'إضافة مشترك جديد';
    elements.saveMemberButton.innerHTML = member
      ? '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> حفظ التعديلات'
      : '<i class="fa-solid fa-user-plus" aria-hidden="true"></i> حفظ المشترك';
    if (member) {
      elements.memberName.value = member.name;
      elements.memberPhone.value = member.phone;
      elements.memberPlan.value = member.planId || 'one-month';
      if (elements.memberPlan.selectedIndex < 0) elements.memberPlan.value = 'one-month';
      elements.startDate.value = member.startDate;
    } else {
      elements.memberPlan.value = 'one-month';
      elements.startDate.value = localDateString();
    }
    elements.memberFormError.textContent = '';
    updatePlanSummary();
    elements.memberDialog.showModal();
    elements.memberName.focus();
  }

  elements.authForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (elements.adminPasscode.value !== ADMIN_PASSCODE) {
      elements.authError.textContent = 'رمز المرور غير صحيح. حاول مرة أخرى.';
      elements.adminPasscode.select();
      return;
    }

    try {
      sessionStorage.setItem(AUTH_KEY, 'true');
    } catch (error) {
      console.error('Unable to create admin session:', error);
    }
    elements.authError.textContent = '';
    await showDashboard();
    document.getElementById('mainContent').focus();
  });

  elements.logoutButton.addEventListener('click', () => {
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch (error) {
      console.error('Unable to end admin session:', error);
    }
    elements.sidebar.classList.remove('is-open');
    elements.menuToggle.setAttribute('aria-expanded', 'false');
    unsubscribeFromMemberChanges();
    showLogin();
  });

  document.getElementById('openMemberDialog').addEventListener('click', () => openMemberDialog());
  document.getElementById('emptyAddButton').addEventListener('click', () => openMemberDialog());
  window.exportMembersToCSV = exportMembersToCSV;
  document.getElementById('closeMemberDialog').addEventListener('click', () => elements.memberDialog.close());
  document.getElementById('cancelMemberDialog').addEventListener('click', () => elements.memberDialog.close());
  elements.memberPlan.addEventListener('change', updatePlanSummary);
  elements.search.addEventListener('input', renderMembers);

  elements.memberForm.addEventListener('submit', async event => {
    event.preventDefault();
    elements.memberFormError.textContent = '';
    if (!elements.memberForm.reportValidity()) return;

    const selectedOption = elements.memberPlan.selectedOptions[0];
    const durationDays = Number(selectedOption.dataset.days);
    const price = Number(selectedOption.dataset.price);
    const startDate = elements.startDate.value;
    const endDate = calculateEndDate(startDate, durationDays);
    if (!endDate) {
      elements.memberFormError.textContent = 'تاريخ البداية غير صالح. اختر تاريخاً صحيحاً.';
      return;
    }

    const existingMember = editingMemberId ? members.find(member => member.id === editingMemberId) : null;
    const savedMember = normalizeMember({
      id: existingMember ? existingMember.id : createId(),
      name: elements.memberName.value,
      phone: elements.memberPhone.value,
      planId: selectedOption.value,
      planName: selectedOption.textContent.split('—')[0].trim(),
      plan: selectedOption.textContent.split('—')[0].trim(),
      price,
      durationDays,
      startDate,
      endDate,
      goal: existingMember ? existingMember.goal : '',
      createdAt: existingMember ? existingMember.createdAt : new Date().toISOString()
    });

    if (!savedMember) {
      elements.memberFormError.textContent = 'تعذر التحقق من البيانات المدخلة. راجع الحقول وحاول مجدداً.';
      return;
    }

    if (!window.titanSupabaseConfigured || !window.titanSupabase) {
      elements.memberFormError.textContent = 'إعداد Supabase غير مكتمل. لا يمكن حفظ التغييرات حالياً.';
      return;
    }

    const submitButton = elements.memberForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const databaseRecord = toDatabaseMember({
      ...savedMember,
      createdAt: existingMember ? existingMember.createdAt : new Date().toISOString()
    });
    delete databaseRecord.created_at;

    try {
      const response = existingMember
        ? await window.titanSupabase.from('members').update(databaseRecord).eq('id', existingMember.id).select('*').single()
        : await window.titanSupabase.from('members').insert(databaseRecord).select('*').single();
      if (response.error) throw response.error;

      const persistedMember = normalizeMember(response.data);
      members = existingMember
        ? members.map(member => member.id === existingMember.id ? persistedMember : member)
        : [persistedMember, ...members];
      elements.memberDialog.close();
      elements.memberForm.reset();
      elements.startDate.value = localDateString();
      editingMemberId = null;
      renderAll();
      showToast(existingMember ? 'تم تحديث بيانات المشترك.' : 'تمت إضافة المشترك بنجاح.');
    } catch (error) {
      console.error('Unable to save Titan Gym member:', error);
      elements.memberFormError.textContent = 'تعذر حفظ بيانات المشترك في قاعدة البيانات.';
    } finally {
      submitButton.disabled = false;
    }
  });

  elements.tableBody.addEventListener('click', async event => {
    const editButton = event.target.closest('[data-edit-id]');
    if (editButton) {
      const memberToEdit = members.find(item => item.id === editButton.dataset.editId);
      if (memberToEdit) openMemberDialog(memberToEdit);
      return;
    }

    const deleteButton = event.target.closest('[data-delete-id]');
    if (!deleteButton) return;
    const member = members.find(item => item.id === deleteButton.dataset.deleteId);
    if (!member) return;

    const confirmed = window.confirm(`هل تريد حذف اشتراك ${member.name}؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;

    if (!window.titanSupabaseConfigured || !window.titanSupabase) {
      showToast('إعداد Supabase غير مكتمل. لا يمكن حذف المشترك.', true);
      return;
    }

    deleteButton.disabled = true;
    try {
      const { error } = await window.titanSupabase.from('members').delete().eq('id', member.id);
      if (error) throw error;
      members = members.filter(item => item.id !== member.id);
      renderAll();
      showToast('تم حذف المشترك.');
    } catch (error) {
      console.error('Unable to delete Titan Gym member:', error);
      showToast('تعذر حذف المشترك من قاعدة البيانات.', true);
      deleteButton.disabled = false;
    }
  });

  elements.menuToggle.addEventListener('click', () => {
    const isOpen = elements.sidebar.classList.toggle('is-open');
    elements.menuToggle.setAttribute('aria-expanded', String(isOpen));
    elements.menuToggle.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
  });

  elements.sidebar.querySelectorAll('.side-link[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      elements.sidebar.classList.remove('is-open');
      elements.menuToggle.setAttribute('aria-expanded', 'false');
      elements.menuToggle.setAttribute('aria-label', 'فتح القائمة');
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === '/' && !elements.appShell.hidden && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === 'Escape' && elements.sidebar.classList.contains('is-open')) {
      elements.sidebar.classList.remove('is-open');
      elements.menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  window.addEventListener('focus', () => {
    if (!elements.appShell.hidden) refreshMembers(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !elements.appShell.hidden) refreshMembers(false);
  });

  let wasAuthenticated = false;
  try {
    wasAuthenticated = sessionStorage.getItem(AUTH_KEY) === 'true';
  } catch (error) {
    console.error('Unable to read admin session:', error);
  }

  if (wasAuthenticated) showDashboard();
  else showLogin();
})();