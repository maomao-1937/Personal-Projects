const $ = id => document.getElementById(id);
const samplePortrait = 'assets/lifestyle-portrait.webp';
const sampleReference = 'assets/reference-photo.webp';
const icon = name => `<img class="icon" src="assets/icons/${name}.svg" alt="">`;
const escapeText = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sessions = [{id: 1, title: '生活写真', photo: sampleReference, sample: true, turns: [
  {role: 'user', text: '想要一张自然、松弛的生活写真。'},
  {role: 'assistant', text: '可以继续换背景，或调整衣服与光线。'}
]}];
let currentId = 1, nextId = 2, uploading = false, fileSessionId = null;
const current = () => sessions.find(s => s.id === currentId);
function toggleSessions(open) { $('session-menu').hidden = !open; $('session-toggle').setAttribute('aria-expanded', String(open)); }
function notify(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => $('toast').hidden = true, 3800); }
function updateSend() { $('send').disabled = uploading || !current().photo || !$('prompt').value.trim(); }
function renderSessions() {
  $('sessions').replaceChildren();
  for (const session of sessions) {
    const button = document.createElement('button');
    button.className = 'session' + (session.id === currentId ? ' active' : '');
    button.innerHTML = icon('message-circle') + '<span>' + escapeText(session.title) + '</span>';
    button.setAttribute('aria-current', session.id === currentId ? 'true' : 'false');
    button.onclick = () => { currentId = session.id; $('prompt').value = ''; toggleSessions(false); render(); };
    $('sessions').append(button);
  }
}
function render(scrollToEnd = false) {
  const session = current(); renderSessions();
  $('reference-row').hidden = !session.photo; $('upload-row').hidden = !!session.photo;
  if (session.photo) { $('reference-image').src = session.photo; $('reference-image').alt = session.sample ? '示例参考照片' : '已上传参考照片'; }
  $('prompt').placeholder = session.turns.length ? '接下来，想改哪里？' : '想拍一张怎样的写真？';
  $('image-open').hidden = !session.photo; $('gallery-empty').hidden = !!session.photo; $('image-actions').hidden = !session.sample;
  $('result-label').textContent = session.sample ? '当前写真 · 示例' : session.photo ? '原始参考 · 尚未生成' : '写真创作室';
  const result = session.sample ? samplePortrait : session.photo;
  if (result) { $('result-image').src = result; $('result-image').alt = session.sample ? '自然光生活写真示例' : '已上传的原始参考照片'; $('image-open').setAttribute('aria-label', session.sample ? '查看示例写真大图' : '查看原始参考照片大图'); }
  const modifications = session.turns.filter(turn => turn.demo).length;
  $('result-status').hidden = !modifications; $('result-status').textContent = '已记录 ' + modifications + ' 次要求';
  $('messages').replaceChildren();
  if (!session.turns.length) {
    const hint = document.createElement('p'); hint.className = 'chat-empty';
    hint.textContent = session.photo ? '照片已添加。描述你喜欢的服装、背景和氛围，开始这次创作。' : '上传一张清晰的自拍，或先用示例照片体验。';
    $('messages').append(hint);
    if (!session.photo) { const useSample = document.createElement('button'); useSample.className = 'text-action'; useSample.textContent = '先用示例照片体验'; useSample.onclick = () => { session.photo = sampleReference; session.sample = true; render(); $('prompt').focus(); }; $('messages').append(useSample); }
  }
  for (const turn of session.turns) {
    const row = document.createElement('div'); row.className = turn.role;
    if (turn.role === 'user') { row.innerHTML = '<div class="bubble">' + escapeText(turn.text) + '</div>'; const avatar = document.createElement('img'); avatar.className = 'user-avatar'; avatar.alt = ''; avatar.src = session.photo; row.append(avatar); }
    else { row.innerHTML = '<div class="assistant-avatar">' + icon('sparkles') + '</div><div class="assistant-body"><div class="assistant-name">AI 镜界</div><p>' + escapeText(turn.text) + '</p>' + (turn.demo ? '<div class="turn-note">界面演示 · 尚未接入真实生图</div>' : '') + '</div>'; }
    $('messages').append(row);
  }
  updateSend(); $('thread').scrollTop = scrollToEnd ? $('thread').scrollHeight : 0;
  if (scrollToEnd && matchMedia('(max-width: 760px)').matches) $('form').scrollIntoView({block: 'nearest'});
}
function newSession(photo = null) { const session = {id: nextId++, title: '新的写真对话', photo, sample: false, turns: []}; sessions.unshift(session); currentId = session.id; $('prompt').value = ''; toggleSessions(false); render(); return session; }
function pickFile() { if (uploading) return; fileSessionId = currentId; $('file').value = ''; $('file').click(); }
function openImage() { if (!current().photo) return; $('large-image').src = current().sample ? samplePortrait : current().photo; $('modal-caption').textContent = current().sample ? '示例写真' : '原始参考照片'; $('dialog').showModal(); }
$('new').onclick = () => newSession();
$('session-toggle').onclick = () => toggleSessions($('session-menu').hidden);
document.addEventListener('click', event => { if (!event.target.closest('.session-picker')) toggleSessions(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('session-menu').hidden) { toggleSessions(false); $('session-toggle').focus(); } });
$('change').onclick = pickFile; $('attach').onclick = pickFile; $('upload').onclick = pickFile;
$('image-open').onclick = openImage; $('view-image').onclick = openImage; $('close-modal').onclick = () => $('dialog').close();
$('dialog').onclick = event => { if (event.target === $('dialog')) { const box = $('dialog').getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) $('dialog').close(); } };
$('file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { notify('请上传 JPG、PNG 或 WebP 图片'); return; }
  if (file.size > 10 * 1024 * 1024) { notify('照片大小不能超过 10 MB'); return; }
  const target = sessions.find(s => s.id === fileSessionId); if (!target) return;
  uploading = true; updateSend();
  try {
    const data = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    await new Promise((resolve,reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = data; });
    if (target.turns.length) newSession(data); else { target.photo = data; target.sample = false; currentId = target.id; render(); }
    notify('照片已添加，仅用于本地预览');
  } catch { notify('无法读取这张照片，请换一张有效图片'); }
  finally { uploading = false; updateSend(); }
};
$('prompt').oninput = updateSend;
document.querySelectorAll('[data-prompt]').forEach(button => button.onclick = () => { $('prompt').value = button.dataset.prompt; updateSend(); $('prompt').focus(); });
$('prompt').onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!$('send').disabled) $('form').requestSubmit(); } };
$('form').onsubmit = event => {
  event.preventDefault(); const text = $('prompt').value.trim(); if (!text || !current().photo || uploading) return;
  const session = current(); if (!session.turns.length) session.title = text.slice(0, 16);
  session.turns.push({role: 'user', text}, {role: 'assistant', text: '已记录这次要求。接入生图后，会参考原照片和上一张结果继续调整。', demo: true});
  $('prompt').value = ''; render(true); $('prompt').focus();
};
render();
