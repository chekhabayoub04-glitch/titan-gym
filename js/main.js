/* ============================================
   TITAN GYM - MAIN JAVASCRIPT
   ============================================ */

'use strict';

// ============ LOADER ============
window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 700);
    }
    AOS.init({ once: true, offset: 60, duration: 700, easing: 'ease-out-cubic' });
    startCounters();
  }, 2400);
});

// ============ CUSTOM CURSOR ============
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');

let mouseX = 0, mouseY = 0;
let outlineX = 0, outlineY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursorDot.style.left = mouseX + 'px';
  cursorDot.style.top = mouseY + 'px';
});

function animateCursor() {
  outlineX += (mouseX - outlineX) * 0.12;
  outlineY += (mouseY - outlineY) * 0.12;
  cursorOutline.style.left = outlineX + 'px';
  cursorOutline.style.top = outlineY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

document.querySelectorAll('a, button, .dose-card, .size-opt, .pc-btn, .sc-btn').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursorOutline.style.width = '56px';
    cursorOutline.style.height = '56px';
    cursorOutline.style.borderColor = 'var(--red)';
  });
  el.addEventListener('mouseleave', () => {
    cursorOutline.style.width = '36px';
    cursorOutline.style.height = '36px';
    cursorOutline.style.borderColor = 'rgba(230, 57, 70, 0.5)';
  });
});

// Hide cursor on mobile
if ('ontouchstart' in window) {
  cursorDot.style.display = 'none';
  cursorOutline.style.display = 'none';
}

// ============ NAVBAR SCROLL ============
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
  document.getElementById('backTop').classList.toggle('visible', window.scrollY > 400);
});

// ============ MOBILE MENU ============
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  mobileMenu.classList.toggle('open');
});

// Close on link click
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('open');
  });
});

const joinDialog = document.getElementById('joinDialog');
function openJoinDialog() {
  if (!joinDialog || joinDialog.open) return;
  joinDialog.showModal();
  document.getElementById('joinName').focus();
}

document.querySelectorAll('[data-open-join]').forEach(trigger => {
  trigger.addEventListener('click', event => {
    event.preventDefault();
    openJoinDialog();
  });
});

document.getElementById('closeJoinDialog')?.addEventListener('click', () => joinDialog.close());
joinDialog?.addEventListener('click', event => {
  if (event.target === joinDialog) joinDialog.close();
});

// ============ HERO 3D CANVAS (Three.js) ============
(function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, canvas.offsetWidth / canvas.offsetHeight, 0.1, 100);
  camera.position.z = 5;

  // Particles
  const particlesCount = 1800;
  const positions = new Float32Array(particlesCount * 3);
  const colors = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 15;

    // Mix of white and red particles
    const isRed = Math.random() > 0.7;
    colors[i * 3]     = isRed ? 0.9 : 0.8;
    colors[i * 3 + 1] = isRed ? 0.14 : 0.8;
    colors[i * 3 + 2] = isRed ? 0.18 : 0.8;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pMat = new THREE.PointsMaterial({
    size: 0.04,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true
  });

  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Floating torus rings
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.TorusGeometry(1.5 + i * 0.8, 0.015, 8, 60);
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xe63946 : 0x333333,
      transparent: true,
      opacity: 0.15 - i * 0.02
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.random() * Math.PI;
    ring.rotation.y = Math.random() * Math.PI;
    ring.position.x = (Math.random() - 0.5) * 4;
    ring.position.y = (Math.random() - 0.5) * 2;
    ring.position.z = -3 - i;
    rings.push(ring);
    scene.add(ring);
  }

  // Dumbbell-shaped geometry
  function createDumbbell() {
    const group = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 8);
    const rodMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.4 });
    group.add(new THREE.Mesh(rodGeo, rodMat));

    [-0.85, 0.85].forEach(x => {
      const wGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.25, 16);
      const wMat = new THREE.MeshBasicMaterial({ color: 0xe63946, transparent: true, opacity: 0.5 });
      const w = new THREE.Mesh(wGeo, wMat);
      w.position.y = x;
      group.add(w);
    });
    return group;
  }

  const dumbbells = [];
  for (let i = 0; i < 6; i++) {
    const d = createDumbbell();
    d.position.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 8 - 4
    );
    d.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dumbbells.push({ mesh: d, speed: Math.random() * 0.003 + 0.001, rotSpeed: Math.random() * 0.005 + 0.002 });
    scene.add(d);
  }

  // Mouse parallax
  let targetX = 0, targetY = 0;
  document.addEventListener('mousemove', (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * 0.5;
    targetY = (e.clientY / window.innerHeight - 0.5) * -0.3;
  });

  // Animate
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    particles.rotation.y += 0.0003;
    particles.rotation.x += 0.0001;

    rings.forEach((ring, i) => {
      ring.rotation.x += 0.002 + i * 0.001;
      ring.rotation.y += 0.001 + i * 0.0005;
    });

    dumbbells.forEach(({ mesh, speed, rotSpeed }) => {
      mesh.position.y += Math.sin(elapsed + mesh.position.x) * speed;
      mesh.rotation.x += rotSpeed * 0.5;
      mesh.rotation.z += rotSpeed;
    });

    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
})();

// ============ COUNTER ANIMATION ============
function startCounters() {
  const counters = document.querySelectorAll('.stat-num[data-target]');
  counters.forEach(counter => {
    const target = +counter.dataset.target;
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      counter.textContent = Math.floor(current);
    }, 16);
  });
}

// ============ DOSE SELECTOR ============
function selectDose(el, grams) {
  document.querySelectorAll('.dose-card').forEach(d => d.classList.remove('active'));
  el.classList.add('active');
  const label = document.getElementById('doseGrams');
  if (label) label.textContent = grams + ' جرام';
}

// ============ CONTACT FORM ============
const cfSubmit = document.querySelector('.cf-submit');
if (cfSubmit) {
  cfSubmit.addEventListener('click', () => {
    const inputs = document.querySelectorAll('.cf-input');
    let filled = true;
    inputs.forEach(inp => {
      if (!inp.value.trim()) {
        inp.style.borderColor = 'var(--red)';
        filled = false;
      } else {
        inp.style.borderColor = '';
      }
    });

    if (filled) {
      cfSubmit.innerHTML = '<i class="fas fa-check"></i> تم الإرسال!';
      cfSubmit.style.background = '#22c55e';
      inputs.forEach(inp => inp.value = '');
      setTimeout(() => {
        cfSubmit.innerHTML = '<i class="fas fa-paper-plane"></i> أرسل الآن';
        cfSubmit.style.background = '';
      }, 3000);
    }
  });
}

// ============ BACK TO TOP ============
document.getElementById('backTop')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============ SMOOTH SCROLL ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    if (this.hasAttribute('data-open-join')) {
      e.preventDefault();
      return;
    }
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ============ NAVBAR ACTIVE LINK ============
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    const top = sec.offsetTop - 120;
    if (window.scrollY >= top) current = sec.getAttribute('id');
  });

  navLinks.forEach(link => {
    link.style.color = '';
    if (link.getAttribute('href') === '#' + current) {
      link.style.color = 'var(--red)';
    }
  });
});

// ============ INTERSECTION OBSERVER for lazy sections ============
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

document.querySelectorAll('.price-card, .supp-card, .ci-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// ============ PARTICLE TRAIL on hero hover ============
const hero = document.querySelector('.hero');
if (hero) {
  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (Math.random() > 0.7) {
      const spark = document.createElement('div');
      spark.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 4px;
        height: 4px;
        background: var(--red);
        border-radius: 50%;
        pointer-events: none;
        z-index: 4;
        animation: sparkFade 0.8s ease forwards;
      `;
      hero.appendChild(spark);
      setTimeout(() => spark.remove(), 800);
    }
  });
}

// Inject spark keyframe
const style = document.createElement('style');
style.textContent = `
  @keyframes sparkFade {
    0% { opacity: 1; transform: scale(1) translateY(0); }
    100% { opacity: 0; transform: scale(0) translateY(-30px); }
  }
`;
document.head.appendChild(style);

// ============ FITNESS & CALORIE CALCULATOR ============
(() => {
  const form = document.getElementById('fitness-form');
  if (!form) return;

  const results = document.getElementById('fitnessResults');
  const formError = document.getElementById('fitnessFormError');
  const goalSelect = document.getElementById('fitnessGoal');
  const registrationGoal = document.getElementById('client-goal');
  const activityFactors = { sedentary: 1.2, light: 1.375, moderate: 1.55, intense: 1.725 };
  const goalAdjustments = { 'fat-loss': -500, 'muscle-gain': 300, maintenance: 0 };
  const registrationGoals = {
    'fat-loss': 'تنشيف وحرق دهون',
    'muscle-gain': 'بناء وتضخيم عضلات',
    maintenance: 'الحفاظ على الوزن'
  };

  function calculateMetrics({ gender, age, height, weight, activity, goal }) {
    const genderAdjustment = gender === 'male' ? 5 : -161;
    const bmr = (10 * weight) + (6.25 * height) - (5 * age) + genderAdjustment;
    const maintenance = Math.round(bmr * activityFactors[activity]);
    const target = Math.max(0, maintenance + goalAdjustments[goal]);
    const bmi = weight / ((height / 100) ** 2);
    const protein = Math.round(weight * (goal === 'maintenance' ? 1.6 : 2));
    const fats = Math.round(weight * 0.8);
    const carbs = Math.max(0, Math.round((target - (protein * 4) - (fats * 9)) / 4));
    return { maintenance, target, bmi, protein, carbs, fats };
  }

  function bmiCategory(bmi) {
    if (bmi < 18.5) return { label: 'نحافة', warning: true };
    if (bmi < 25) return { label: 'وزن مثالي', warning: false };
    return { label: 'زيادة وزن', warning: true };
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    formError.textContent = '';
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const values = {
      gender: formData.get('gender'),
      age: Number(formData.get('age')),
      height: Number(formData.get('height')),
      weight: Number(formData.get('weight')),
      activity: formData.get('activity'),
      goal: formData.get('goal')
    };

    if (!activityFactors[values.activity] || !Object.hasOwn(goalAdjustments, values.goal) || !['male', 'female'].includes(values.gender)) {
      formError.textContent = 'تحقق من مستوى نشاطك وهدفك ثم أعد المحاولة.';
      return;
    }

    const metrics = calculateMetrics(values);
    if (!Number.isFinite(metrics.bmi) || !Number.isFinite(metrics.target)) {
      formError.textContent = 'تعذر حساب النتائج من هذه البيانات. تحقق من القيم المدخلة.';
      return;
    }

    const category = bmiCategory(metrics.bmi);
    document.getElementById('maintenanceCalories').textContent = metrics.maintenance.toLocaleString('ar-DZ');
    document.getElementById('targetCalories').textContent = metrics.target.toLocaleString('ar-DZ');
    document.getElementById('bmiValue').textContent = metrics.bmi.toFixed(1);
    const bmiBadge = document.getElementById('bmiCategory');
    bmiBadge.textContent = category.label;
    bmiBadge.classList.toggle('is-warning', category.warning);
    document.getElementById('proteinGrams').textContent = metrics.protein.toLocaleString('ar-DZ');
    document.getElementById('carbsGrams').textContent = metrics.carbs.toLocaleString('ar-DZ');
    document.getElementById('fatsGrams').textContent = metrics.fats.toLocaleString('ar-DZ');

    results.hidden = false;
    results.classList.remove('is-visible');
    requestAnimationFrame(() => results.classList.add('is-visible'));
  });

  document.getElementById('fitnessJoinCta').addEventListener('click', () => {
    if (!registrationGoal) return;
    registrationGoal.value = registrationGoals[goalSelect.value];
    registrationGoal.removeAttribute('aria-invalid');
    registrationGoal.dispatchEvent(new Event('change', { bubbles: true }));
    openJoinDialog();
  });
})();

// ============ PUBLIC MEMBERSHIP REGISTRATION ============
(() => {
  const form = document.getElementById('public-join-form');
  if (!form) return;

  const nameInput = document.getElementById('joinName');
  const phoneInput = document.getElementById('joinPhone');
  const planSelect = document.getElementById('client-plan');
  const goalSelect = document.getElementById('client-goal');
  const feedback = document.getElementById('joinFeedback');
  const toast = document.getElementById('joinToast');
  let toastTimer;

  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function calculateEndDate(startDate, days) {
    const date = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(date.getTime()) || !Number.isInteger(days) || days < 1) return '';
    date.setDate(date.getDate() + days - 1);
    return formatLocalDate(date);
  }

  function showFeedback(message, type = 'error') {
    feedback.textContent = message;
    feedback.className = `join-feedback is-${type}`;
    if (type !== 'success' || !toast) return;

    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove('is-error');
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4200);
  }

  function clearInvalidState(input) {
    input.removeAttribute('aria-invalid');
  }

  [nameInput, phoneInput, planSelect, goalSelect].forEach(input => {
    input.addEventListener('input', () => clearInvalidState(input));
    input.addEventListener('change', () => clearInvalidState(input));
  });

  // Delegate submit handling so the form can be replaced without losing its behavior.
  document.addEventListener('submit', async event => {
    if (event.target !== form) return;
    event.preventDefault();
    feedback.textContent = '';
    feedback.className = 'join-feedback';

    const name = nameInput.value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    const phone = phoneInput.value.trim();
    const selectedPlan = planSelect.selectedOptions[0];
    const goal = goalSelect.value.trim();
    const plan = selectedPlan && selectedPlan.value ? selectedPlan.value.trim() : '';
    const price = Number(selectedPlan && selectedPlan.dataset.price);
    const days = Number(selectedPlan && selectedPlan.dataset.days);
    const phonePattern = /^0[567][0-9]{8}$/;
    let firstInvalid = null;

    const validations = [
      { input: nameInput, valid: name.length >= 2, message: 'أدخل الاسم الكامل (حرفان على الأقل).' },
      { input: phoneInput, valid: phonePattern.test(phone), message: 'أدخل رقم هاتف جزائري صحيحاً مثل 0550123456.' },
      { input: planSelect, valid: Boolean(plan) && Number.isFinite(price) && Number.isInteger(days) && days > 0, message: 'اختر خطة عضوية صالحة.' },
      { input: goalSelect, valid: Boolean(goal), message: 'اختر هدفك التدريبي.' }
    ];

    for (const validation of validations) {
      if (validation.valid) {
        validation.input.removeAttribute('aria-invalid');
        continue;
      }
      validation.input.setAttribute('aria-invalid', 'true');
      if (!firstInvalid) firstInvalid = { input: validation.input, message: validation.message };
    }

    if (firstInvalid) {
      showFeedback(firstInvalid.message);
      firstInvalid.input.focus();
      return;
    }

    const startDate = formatLocalDate(new Date());
    const endDate = calculateEndDate(startDate, days);
    if (!endDate) {
      showFeedback('تعذر حساب تاريخ نهاية الاشتراك. حاول مرة أخرى.');
      return;
    }

    const client = window.titanSupabase;
    if (!window.titanSupabaseConfigured || !client) {
      showFeedback('خدمة التسجيل السحابي غير مهيأة بعد. يرجى المحاولة لاحقاً.');
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      const { error } = await client.from('members').insert({
        name,
        phone,
        plan,
        price: Number(price),
        start_date: startDate,
        end_date: endDate,
        goal,
        created_at: new Date().toISOString()
      });
      if (error) throw error;

      form.reset();
      [nameInput, phoneInput, planSelect, goalSelect].forEach(input => input.removeAttribute('aria-invalid'));
      showFeedback('تم تسجيل طلب عضويتك بنجاح في Titan Gym!', 'success');
    } catch (error) {
      console.error('Titan Gym registration failed:', error);
      showFeedback('تعذر حفظ التسجيل في قاعدة البيانات. حاول مرة أخرى بعد قليل.');
    } finally {
      submitButton.disabled = false;
    }
  });

  // Verify cloud connectivity and the columns needed by both pages without inserting test members.
  async function runRegistrationSelfTest() {
    const client = window.titanSupabase;
    if (!window.titanSupabaseConfigured || !client) {
      const report = { configured: false, reachable: false, schemaReady: false };
      console.warn('[Titan Gym Supabase self-test]', report);
      return report;
    }

    try {
      const { error } = await client.from('members').select('id, plan, start_date, end_date').limit(1);
      if (error) throw error;
      const startDate = formatLocalDate(new Date());
      const expectedEndDate = calculateEndDate(startDate, 30);
      const report = { configured: true, reachable: true, schemaReady: Boolean(expectedEndDate) };
      console.info('[Titan Gym Supabase self-test]', report);
      return report;
    } catch (error) {
      console.error('[Titan Gym Supabase self-test] failed:', error);
      return { configured: true, reachable: false, schemaReady: false, error: error.message };
    }
  }

  window.titanRegistrationSelfTest = runRegistrationSelfTest;
  if (new URLSearchParams(window.location.search).has('supabase-self-test')) runRegistrationSelfTest();
})();

console.log('%c🏋️ TITAN GYM - Made with ❤️ by Ayoub Chekhab', 'color: #e63946; font-size: 14px; font-weight: bold;');
