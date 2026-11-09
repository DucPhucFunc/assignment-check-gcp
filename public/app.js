import { firebaseConfig } from './firebase-config.js';

const $ = (id) => document.getElementById(id);
const configReady = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_') &&
  firebaseConfig.projectId && !firebaseConfig.projectId.startsWith('YOUR_') &&
  firebaseConfig.appId && !firebaseConfig.appId.startsWith('YOUR_');

let mode = 'demo';
let auth = null;
let db = null;
let currentUser = null;
let tasks = [];
let editingId = null;
let unsubscribeTasks = null;
let firebaseModules = null;
let reminderTimer = null;

const LOCAL_KEY = 'assignment-check-demo-tasks-v1';

function setMessage(id, text, type = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `message ${type}`.trim();
}
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => el.classList.remove('show'), 2600);
}
function showDashboard(userLabel) {
  $('auth-view').classList.add('hidden');
  $('dashboard-view').classList.remove('hidden');
  $('logout-btn').classList.remove('hidden');
  $('user-label').textContent = userLabel;
  $('mode-pill').textContent = mode === 'firebase' ? 'CLOUD MODE' : 'DEMO MODE';
  $('demo-notice').classList.toggle('hidden', mode !== 'demo');
  $('firebase-notice').classList.toggle('hidden', mode !== 'firebase');
}
function showAuth() {
  $('dashboard-view').classList.add('hidden');
  $('auth-view').classList.remove('hidden');
  $('logout-btn').classList.add('hidden');
  $('mode-pill').textContent = configReady ? 'FIREBASE READY' : 'LOCAL DEMO';
  stopTaskListener();
  if (reminderTimer) window.clearInterval(reminderTimer);
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function dateLabel(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '날짜 미정';
  return new Intl.DateTimeFormat('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(d);
}
function taskStatus(task) {
  if (task.done) return { label:'완료', className:'done' };
  const diff = new Date(task.dueAt).getTime() - Date.now();
  if (diff < 0) return { label:'마감 지남', className:'overdue' };
  if (diff <= 24 * 60 * 60 * 1000) return { label:'마감 임박', className:'soon' };
  return { label:'진행 중', className:'normal' };
}
function sortTasks(items) {
  return [...items].sort((a,b) => new Date(a.dueAt) - new Date(b.dueAt));
}
function render() {
  const filter = $('filter-select').value;
  const open = tasks.filter(t => !t.done);
  const soon = open.filter(t => {
    const diff = new Date(t.dueAt).getTime() - Date.now();
    return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
  });
  $('stat-total').textContent = tasks.length;
  $('stat-open').textContent = open.length;
  $('stat-soon').textContent = soon.length;
  $('stat-done').textContent = tasks.filter(t => t.done).length;

  let shown = sortTasks(tasks);
  if (filter === 'open') shown = shown.filter(t => !t.done);
  if (filter === 'done') shown = shown.filter(t => t.done);
  if (filter === 'overdue') shown = shown.filter(t => !t.done && new Date(t.dueAt).getTime() < Date.now());

  $('empty-state').classList.toggle('hidden', shown.length > 0);
  $('task-list').innerHTML = shown.map(task => {
    const status = taskStatus(task);
    return `<article class="task-card ${task.done ? 'is-done' : ''}">
      <div class="task-main">
        <div class="task-course">${escapeHtml(task.course)}</div>
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">마감일: ${escapeHtml(dateLabel(task.dueAt))}</div>
        ${task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : ''}
        <span class="status ${status.className}">${status.label}</span>
      </div>
      <div class="task-actions">
        <button class="tiny-button complete" data-action="toggle" data-id="${escapeHtml(task.id)}">${task.done ? '완료 취소' : '완료 처리'}</button>
        <button class="tiny-button" data-action="edit" data-id="${escapeHtml(task.id)}">수정</button>
        <button class="tiny-button delete" data-action="delete" data-id="${escapeHtml(task.id)}">삭제</button>
      </div>
    </article>`;
  }).join('');
}
function readLocalTasks() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch { return []; }
}
function writeLocalTasks() { localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks)); }
function startDemo() {
  mode = 'demo'; currentUser = { uid:'demo-user' };
  tasks = readLocalTasks();
  showDashboard('데모 사용자 · 브라우저 저장소 사용 중');
  render();
  startReminderMonitor();
}
async function loadFirebase() {
  const appMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
  const dbMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
  firebaseModules = { ...appMod, ...authMod, ...dbMod };
  const app = appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = dbMod.getFirestore(app);
}
function taskCollection() {
  return firebaseModules.collection(db, 'users', currentUser.uid, 'tasks');
}
function startTaskListener() {
  stopTaskListener();
  const q = firebaseModules.query(taskCollection(), firebaseModules.orderBy('dueAt', 'asc'));
  unsubscribeTasks = firebaseModules.onSnapshot(q, (snapshot) => {
    tasks = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data(), dueAt:doc.data().dueAt?.toDate ? doc.data().dueAt.toDate().toISOString() : doc.data().dueAt }));
    render();
  }, (error) => toast(`과제 데이터를 불러오지 못했습니다: ${error.message}`));
}
function stopTaskListener() {
  if (unsubscribeTasks) unsubscribeTasks();
  unsubscribeTasks = null;
}
async function saveTask(event) {
  event.preventDefault();
  const course = $('course-input').value.trim();
  const title = $('title-input').value.trim();
  const dueAtRaw = $('due-input').value;
  const note = $('note-input').value.trim();
  const dueDate = new Date(dueAtRaw);
  if (!course || !title || !dueAtRaw || Number.isNaN(dueDate.getTime())) {
    setMessage('task-message', '과목명, 과제명, 마감일을 확인해 주세요.', 'error'); return;
  }
  const data = { course, title, dueAt: dueDate.toISOString(), note, done:false, updatedAt:new Date().toISOString() };
  try {
    if (mode === 'demo') {
      if (editingId) tasks = tasks.map(t => t.id === editingId ? { ...t, ...data, done:t.done } : t);
      else tasks.push({ id:crypto.randomUUID(), ...data, createdAt:new Date().toISOString() });
      writeLocalTasks(); render();
    } else {
      const col = taskCollection();
      if (editingId) {
        await firebaseModules.updateDoc(firebaseModules.doc(col, editingId), { ...data, dueAt:firebaseModules.Timestamp.fromDate(dueDate) });
      } else {
        await firebaseModules.addDoc(col, { ...data, dueAt:firebaseModules.Timestamp.fromDate(dueDate), createdAt:firebaseModules.serverTimestamp() });
      }
    }
    resetTaskForm();
    setMessage('task-message', '과제가 저장되었습니다.', 'success');
  } catch (error) {
    setMessage('task-message', `저장하지 못했습니다: ${error.message}`, 'error');
  }
}
function resetTaskForm() {
  editingId = null;
  $('task-form').reset();
  $('form-title').textContent = '과제 추가하기';
  $('save-task-btn').textContent = '과제 저장';
  $('cancel-edit-btn').classList.add('hidden');
}
function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;
  $('course-input').value = task.course;
  $('title-input').value = task.title;
  const d = new Date(task.dueAt);
  const local = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  $('due-input').value = local;
  $('note-input').value = task.note || '';
  $('form-title').textContent = '과제 수정하기';
  $('save-task-btn').textContent = '변경사항 저장';
  $('cancel-edit-btn').classList.remove('hidden');
  $('course-input').focus();
}
async function taskAction(action, id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  try {
    if (action === 'edit') { editTask(id); return; }
    if (action === 'delete' && !confirm('이 과제를 삭제할까요?')) return;
    if (mode === 'demo') {
      if (action === 'delete') tasks = tasks.filter(t => t.id !== id);
      if (action === 'toggle') tasks = tasks.map(t => t.id === id ? { ...t, done:!t.done } : t);
      writeLocalTasks(); render();
    } else {
      const ref = firebaseModules.doc(taskCollection(), id);
      if (action === 'delete') await firebaseModules.deleteDoc(ref);
      if (action === 'toggle') await firebaseModules.updateDoc(ref, { done:!task.done, updatedAt:new Date().toISOString() });
    }
    toast(action === 'delete' ? '과제를 삭제했습니다.' : '과제 상태를 변경했습니다.');
  } catch (error) { toast(`처리하지 못했습니다: ${error.message}`); }
}
function startReminderMonitor() {
  if (reminderTimer) window.clearInterval(reminderTimer);
  const check = () => {
    const now = Date.now();
    tasks.filter(t => !t.done).forEach(task => {
      const due = new Date(task.dueAt).getTime();
      const timeLeft = due - now;
      if (timeLeft > 0 && timeLeft <= 24*60*60*1000) {
        const key = `assignment-check-reminded:${task.id}:${task.dueAt}`;
        if (!localStorage.getItem(key) && Notification.permission === 'granted') {
          new Notification('과제 마감 알림', { body:`${task.course} · ${task.title} 과제 마감이 24시간 이내입니다.` });
          localStorage.setItem(key, '1');
        }
      }
    });
  };
  check(); reminderTimer = window.setInterval(() => { check(); render(); }, 60*1000);
}
async function enableNotifications() {
  if (!('Notification' in window)) { toast('이 브라우저는 알림 기능을 지원하지 않습니다.'); return; }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') { toast('브라우저 알림이 켜졌습니다.'); startReminderMonitor(); }
  else toast('브라우저 설정에서 알림 권한을 허용해 주세요.');
}

$('demo-btn').addEventListener('click', startDemo);
$('task-form').addEventListener('submit', saveTask);
$('cancel-edit-btn').addEventListener('click', resetTaskForm);
$('filter-select').addEventListener('change', render);
$('notify-btn').addEventListener('click', enableNotifications);
$('task-list').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (button) taskAction(button.dataset.action, button.dataset.id);
});
$('logout-btn').addEventListener('click', async () => {
  if (mode === 'firebase' && auth) await firebaseModules.signOut(auth);
  mode = 'demo'; currentUser = null; tasks = []; resetTaskForm(); showAuth();
});
$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!configReady) { setMessage('auth-message', 'Firebase 설정 전입니다. 먼저 데모 모드를 사용하거나 firebase-config.js를 설정하세요.', 'error'); return; }
  try {
    const credential = await firebaseModules.signInWithEmailAndPassword(auth, $('email-input').value.trim(), $('password-input').value);
    mode = 'firebase'; currentUser = credential.user;
    showDashboard(credential.user.email || '로그인 사용자'); startTaskListener(); startReminderMonitor();
  } catch (error) { setMessage('auth-message', `로그인에 실패했습니다: ${error.message}`, 'error'); }
});
$('signup-btn').addEventListener('click', async () => {
  if (!configReady) { setMessage('auth-message', 'Firebase 설정 전입니다. 먼저 firebase-config.js를 설정하세요.', 'error'); return; }
  try {
    const credential = await firebaseModules.createUserWithEmailAndPassword(auth, $('email-input').value.trim(), $('password-input').value);
    mode = 'firebase'; currentUser = credential.user;
    showDashboard(credential.user.email || '새 사용자'); startTaskListener(); startReminderMonitor();
  } catch (error) { setMessage('auth-message', `회원가입에 실패했습니다: ${error.message}`, 'error'); }
});

if (configReady) {
  $('mode-pill').textContent = 'FIREBASE READY';
  loadFirebase().then(() => {
    firebaseModules.onAuthStateChanged(auth, (user) => {
      if (user) { mode='firebase'; currentUser=user; showDashboard(user.email || '로그인 사용자'); startTaskListener(); startReminderMonitor(); }
      else if (!currentUser) showAuth();
    });
  }).catch((error) => {
    $('mode-pill').textContent = 'CONFIG ERROR';
    setMessage('auth-message', `Firebase 초기화 오류: ${error.message}`, 'error');
  });
} else {
  $('mode-pill').textContent = 'LOCAL DEMO';
}
