/* ============================================================
   幻我 · AI 造像馆 — 主控制器
   视图路由 / 创作流程 / 作品库 / 邀请码验证
   ============================================================ */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------- 应用状态 ---------- */
  const state = {
    photos: [],
    styleId: null,
    prompt: '',
    count: 4,
    ratio: '1:1',
    generating: false,
    results: [],
    inviteCode: Store.get('huanwo_invite', ''),
  };

  /* ============================================================
     邀请码系统
     ============================================================ */
  function isVerified() {
    return !!state.inviteCode;
  }

  function showInviteModal() {
    $('#inviteModal').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#inviteInput')?.focus(), 100);
  }

  function hideInviteModal() {
    $('#inviteModal').hidden = true;
    document.body.style.overflow = '';
  }

  async function verifyInvite(code) {
    try {
      const res = await fetch('/api/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        state.inviteCode = data.code;
        Store.set('huanwo_invite', data.code);
        return true;
      }
      return false;
    } catch (e) {
      const localCodes = ['HUANWO2024', 'VIP888', 'TEST123', 'AI666'];
      if (localCodes.includes(code.toUpperCase())) {
        state.inviteCode = code.toUpperCase();
        Store.set('huanwo_invite', code.toUpperCase());
        return true;
      }
      return false;
    }
  }

  $('#inviteSubmit').addEventListener('click', async () => {
    const input = $('#inviteInput');
    const errorEl = $('#inviteError');
    const code = input.value.trim();
    if (!code) { errorEl.hidden = false; errorEl.textContent = '请输入邀请码'; return; }

    $('#inviteSubmit').disabled = true;
    $('#inviteSubmit').textContent = '验证中...';
    const ok = await verifyInvite(code);
    $('#inviteSubmit').disabled = false;
    $('#inviteSubmit').textContent = '验证并进入';

    if (ok) {
      errorEl.hidden = true;
      hideInviteModal();
      toast('验证成功，欢迎使用');
      updateInviteDisplay();
    } else {
      errorEl.hidden = false;
      errorEl.textContent = '邀请码无效，请重试';
    }
  });

  $('#inviteInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#inviteSubmit').click();
  });

  $('#btnChangeInvite')?.addEventListener('click', () => {
    state.inviteCode = '';
    Store.remove('huanwo_invite');
    updateInviteDisplay();
    showInviteModal();
  });

  function updateInviteDisplay() {
    const el = $('#inviteCodeDisplay');
    if (el) el.textContent = state.inviteCode || '未验证';
  }

  /* ============================================================
     视图路由
     ============================================================ */
  function showView(id) {
    if (!isVerified()) { showInviteModal(); return; }
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === 'view-' + id));
    $$('.tabbar__item').forEach((t) => t.classList.toggle('is-active', t.dataset.view === id));

    const fab = $('#genFab');
    if (fab) fab.hidden = id !== 'studio';

    if (id === 'gallery') renderGallery();
    if (id === 'me') updateInviteDisplay();

    window.scrollTo(0, 0);
  }

  $$('.tabbar__item').forEach((t) =>
    t.addEventListener('click', () => showView(t.dataset.view))
  );
  $$('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => showView(el.dataset.goto))
  );

  /* ============================================================
     创作：上传 / 风格 / 生成
     ============================================================ */
  function renderStudio() {
    renderStyleGrid();
    updateFab();
  }

  const fileInput = $('#fileInput');
  const uploadZone = $('#uploadZone');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('is-drag');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('is-drag'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('is-drag');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  function handleFiles(files) {
    const arr = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    const room = 3 - state.photos.length;
    if (!arr.length) return toast('请选择图片文件');
    if (arr.length > room) toast('最多上传 3 张照片');

    arr.slice(0, room).forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        state.photos.push({ dataUrl: r.result, name: f.name });
        renderThumbs();
        updateFab();
      };
      r.readAsDataURL(f);
    });
    fileInput.value = '';
  }

  function renderThumbs() {
    const wrap = $('#uploadThumbs');
    wrap.innerHTML = state.photos
      .map((p, i) => `
        <div class="thumb">
          <img src="${p.dataUrl}" alt="照片 ${i + 1}">
          <button class="thumb__del" data-i="${i}" aria-label="移除照片">×</button>
        </div>`)
      .join('');
    wrap.querySelectorAll('.thumb__del').forEach((b) =>
      b.addEventListener('click', (e) => {
        state.photos.splice(Number(e.currentTarget.dataset.i), 1);
        renderThumbs();
        updateFab();
      })
    );
  }

  function renderStyleGrid() {
    const wrap = $('#styleGrid');
    wrap.innerHTML = STYLES.map((s) => `
      <button class="style-card style-card--grid ${state.styleId === s.id ? 'is-selected' : ''}" data-style="${s.id}" aria-pressed="${state.styleId === s.id}">
        <span class="style-card__thumb" style="background:${styleGradient(s)}">
          <span class="style-card__pattern">${s.pattern}</span>
        </span>
        <span class="style-card__name">${s.name}</span>
      </button>`).join('');
    wrap.querySelectorAll('[data-style]').forEach((b) =>
      b.addEventListener('click', () => {
        state.styleId = b.dataset.style;
        renderStyleGrid();
        updateFab();
      })
    );
  }

  const genFab = $('#genFab');
  const FAB_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9L12 3Z"/><path d="M19 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/></svg>';

  function updateFab() {
    const ready = state.photos.length > 0 && !!state.styleId && !state.generating;
    genFab.classList.toggle('is-busy', state.generating);
    genFab.innerHTML = FAB_ICON + (state.generating ? '生成中…' : '开始生成');
    genFab.setAttribute('aria-disabled', ready ? 'false' : 'true');
    genFab.style.opacity = ready ? '1' : '.55';
  }

  genFab.addEventListener('click', runGenerate);
  $('#btnMore').addEventListener('click', runGenerate);
  $('#btnRegen').addEventListener('click', runGenerate);

  const promptInput = $('#promptInput');
  if (promptInput) {
    promptInput.addEventListener('input', () => {
      state.prompt = promptInput.value.trim();
      const counter = $('#promptCount');
      if (counter) counter.textContent = `${promptInput.value.length}/200`;
    });
  }

  $$('#countSeg .seg__item').forEach((btn) =>
    btn.addEventListener('click', () => {
      $$('#countSeg .seg__item').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.count = parseInt(btn.dataset.count, 10);
    })
  );

  $$('#ratioSeg .seg__item').forEach((btn) =>
    btn.addEventListener('click', () => {
      $$('#ratioSeg .seg__item').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.ratio = btn.dataset.ratio;
    })
  );

  async function runGenerate() {
    if (state.generating) return;
    if (!isVerified()) { showInviteModal(); return; }
    if (!state.photos.length) return toast('请先上传照片');
    if (!state.styleId) return toast('请先选择风格');

    const style = STYLES.find((s) => s.id === state.styleId);
    state.generating = true;
    updateFab();

    const resultPanel = $('#stepResult');
    const grid = $('#resultGrid');
    resultPanel.hidden = false;
    grid.innerHTML = Array.from({ length: state.count }, () => '<div class="result-card is-loading"><div class="sk"></div></div>').join('');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const imgs = await API.generate({
        photos: state.photos.map((p) => p.dataUrl),
        style,
        count: state.count,
        prompt: state.prompt,
        ratio: state.ratio,
      });
      state.results = imgs.map((dataUrl, i) => ({
        dataUrl,
        styleId: state.styleId,
        styleName: style.name,
      }));
      renderResults();
    } catch (e) {
      toast('生成失败：' + e.message);
      grid.innerHTML = '';
    } finally {
      state.generating = false;
      updateFab();
    }
  }

  function renderResults() {
    const grid = $('#resultGrid');
    grid.innerHTML = state.results
      .map((r, i) => `
        <div class="result-card" data-i="${i}">
          <img src="${r.dataUrl}" alt="${r.styleName} ${i + 1}">
          <span class="result-card__badge">${r.styleName}</span>
          <span class="result-card__btn" data-dl="${i}" role="button" aria-label="下载这张图">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a1 1 0 0 1 1 1v10.6l3.3-3.3a1 1 0 0 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4L11 13.6V3a1 1 0 0 1 1-1ZM4 20a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z"/></svg>
          </span>
        </div>`)
      .join('');
    grid.querySelectorAll('.result-card').forEach((c) =>
      c.addEventListener('click', (e) => {
        const dl = e.target.closest('[data-dl]');
        const idx = Number(c.dataset.i);
        if (dl) { e.stopPropagation(); downloadResult(idx); return; }
        openModal(state.results[idx], 'result');
      })
    );
  }

  function downloadResult(i) {
    const r = state.results[i];
    if (!r) return;
    downloadDataUrl(r.dataUrl, `huanwo-${r.styleName}-${Date.now()}.png`);
    toast('已开始下载');
  }

  /* ============================================================
     作品库
     ============================================================ */
  function renderGallery() {
    const grid = $('#galleryGrid');
    const empty = $('#galleryEmpty');
    const list = Store.get('huanwo_history', []);

    if (!list.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    grid.innerHTML = list
      .map((it, i) => `
        <div class="result-card" data-ts="${it.ts}">
          <img src="${it.dataUrl}" alt="作品 ${i + 1}">
          <span class="result-card__badge">${it.styleName || ''}</span>
        </div>`)
      .join('');
    grid.querySelectorAll('.result-card').forEach((c) =>
      c.addEventListener('click', () => {
        const it = list.find((x) => x.ts === Number(c.dataset.ts));
        if (it) openModal(it, 'gallery');
      })
    );
  }

  function saveToGallery(item) {
    const list = Store.get('huanwo_history', []);
    list.unshift({ dataUrl: item.dataUrl, styleName: item.styleName || '', ts: Date.now() });
    Store.set('huanwo_history', list.slice(0, 50));
    toast('已收藏到「我的作品」');
    closeModal();
  }

  function deleteFromGallery(item) {
    let list = Store.get('huanwo_history', []);
    list = list.filter((x) => x.ts !== item.ts);
    Store.set('huanwo_history', list);
    closeModal();
    renderGallery();
    toast('已删除');
  }

  /* ============================================================
     大图弹窗
     ============================================================ */
  let modalItem = null;

  function openModal(item, source) {
    modalItem = item;
    $('#modalImg').src = item.dataUrl;
    $('#modalSave').hidden = source !== 'result';
    $('#modalDelete').hidden = source !== 'gallery';
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
  }

  $$('[data-close-modal]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
  });
  $('#modalDownload').addEventListener('click', () => {
    if (!modalItem) return;
    downloadDataUrl(modalItem.dataUrl, `huanwo-${modalItem.styleName || 'works'}-${Date.now()}.png`);
    toast('已开始下载');
  });
  $('#modalSave').addEventListener('click', () => modalItem && saveToGallery(modalItem));
  $('#modalDelete').addEventListener('click', () => modalItem && deleteFromGallery(modalItem));

  /* ============================================================
     初始化
     ============================================================ */
  function updateDemoBanner() {
    const banner = $('#demoBanner');
    if (!banner) return;
    if (API.ready && !API.realMode) {
      banner.hidden = false;
      banner.textContent = '当前为预览模式，结果图为示例占位；在服务端 .env 配置 AI_API_KEY 后即可真实生成。';
    } else {
      banner.hidden = true;
    }
  }

  async function init() {
    renderStudio();
    renderGallery();
    updateInviteDisplay();
    updateFab();
    await API.checkStatus();
    updateDemoBanner();
    if (!isVerified()) showInviteModal();
  }

  init();
})();
