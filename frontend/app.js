/* =============================================================
 * 码上知新 · 课程答疑 —— 前端逻辑
 *
 * 当前为「模拟模式」(USE_MOCK = true)，使用本地模拟数据，
 * 不会请求真实后端接口。
 *
 * 后端接口（暂未启用）：
 *   POST http://127.0.0.1:8080/api/ask
 *   请求体: { "course_id": "...", "question": "..." }
 *   响应体: { "answer": "...", "sources": [ {title, section, page} ] }
 *
 * 注意：请勿在本机直接请求 127.0.0.1:8080 —— 该地址指向「本机」，
 * 访问不到老师电脑上的后端。联调时请把 API_BASE_URL 改成后端电脑的
 * 实际地址，并把 USE_MOCK 设为 false。
 * ============================================================= */

const USE_MOCK = true;
const API_BASE_URL = 'http://127.0.0.1:8080'; // 联调时改成后端电脑的地址

const COURSE_NAMES = {
  'c-language': 'C 语言',
  'data-structure': '数据结构',
  'algorithm': '算法设计',
  'python': 'Python',
  'java': 'Java',
};

// ---- DOM ----
const els = {
  course: document.getElementById('course'),
  question: document.getElementById('question'),
  askBtn: document.getElementById('askBtn'),
  answerPanel: document.getElementById('answerPanel'),
  answerBody: document.getElementById('answerBody'),
  courseBadge: document.getElementById('courseBadge'),
  sourcesPanel: document.getElementById('sourcesPanel'),
  sourcesList: document.getElementById('sourcesList'),
  saveMistakeBtn: document.getElementById('saveMistakeBtn'),
  toast: document.getElementById('toast'),
};

let currentAnswer = null; // 最近一次的回答结果（用于加入错题集）

/* ---------------- 模拟数据 ---------------- */
function mockFetchAnswer(courseId, question) {
  const courseName = COURSE_NAMES[courseId] || courseId;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        answer:
          '指针是 C 语言中用来「存放内存地址」的变量。通过指针，程序可以直接访问和操作内存中的数据，' +
          '它是实现动态内存分配、数组遍历、函数传址调用以及链表等数据结构的基础。' +
          '例如 <code>int *p = &amp;a;</code> 表示 p 保存了变量 a 的地址，' +
          '<code>*p</code> 则解引用得到 a 的值。理解指针的关键，在于区分「指针本身的值（地址）」' +
          '与「指针所指向的值（解引用）」这两层含义。',
        sources: [
          { title: courseName + '课程讲义', section: '数组与指针', page: null },
          { title: '《C 程序设计》教材', section: '第 6 章 · 指针', page: 98 },
          { title: '码上知新 · 数据结构平台', section: '链表基础', page: null },
        ],
      });
    }, 900);
  });
}

/* ---------------- 请求（模拟 / 真实） ---------------- */
async function fetchAnswer(courseId, question) {
  if (USE_MOCK) {
    return mockFetchAnswer(courseId, question);
  }
  // 真实请求（联调时启用）
  const resp = await fetch(`${API_BASE_URL}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: courseId, question }),
  });
  if (!resp.ok) throw new Error('请求失败：HTTP ' + resp.status);
  return resp.json();
}

/* ---------------- 渲染 ---------------- */
function showLoading() {
  els.answerPanel.classList.remove('hidden');
  els.sourcesPanel.classList.add('hidden');
  els.saveMistakeBtn.disabled = true;
  els.answerBody.innerHTML =
    '<div class="loading"><span class="spinner"></span>正在回答</div>';
}

function renderAnswer(data) {
  els.courseBadge.textContent = COURSE_NAMES[els.course.value] || els.course.value;

  // 回答区域
  els.answerPanel.classList.remove('hidden');
  els.answerBody.innerHTML = `<p>${data.answer}</p>`;

  // 资料出处区域
  els.sourcesPanel.classList.remove('hidden');
  const items = (data.sources || []).map((s) => {
    const page = s.page != null ? `第 ${s.page} 页` : '在线资源';
    return (
      '<li class="source-item">' +
        '<span class="src-ico">&#128214;</span>' +
        '<div class="src-main">' +
          `<span class="src-title">${escapeHtml(s.title)}</span>` +
          `<span class="src-meta">${escapeHtml(s.section)} · ${escapeHtml(page)}</span>` +
        '</div>' +
      '</li>'
    );
  });
  els.sourcesList.innerHTML = items.join('') ||
    '<li class="src-meta">暂无资料出处</li>';

  currentAnswer = data;
  els.saveMistakeBtn.disabled = false;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------------- Toast ---------------- */
let toastTimer = null;
function showToast(msg, type = 'info') {
  els.toast.textContent = msg;
  els.toast.className = 'toast is-on ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('is-on');
  }, 2200);
}

/* ---------------- 提交问题 ---------------- */
async function handleAsk() {
  const question = els.question.value.trim();
  if (!question) {
    showToast('请输入问题', 'warn');
    els.question.focus();
    return;
  }

  showLoading();
  els.askBtn.disabled = true;
  els.askBtn.textContent = '回答中…';

  try {
    const data = await fetchAnswer(els.course.value, question);
    renderAnswer(data);
  } catch (err) {
    els.answerPanel.classList.add('hidden');
    showToast('回答失败，请稍后再试', 'error');
  } finally {
    els.askBtn.disabled = false;
    els.askBtn.textContent = '提交问题';
  }
}

/* ---------------- 加入错题集 ---------------- */
function handleSaveMistake() {
  if (!currentAnswer) {
    showToast('请先获取回答', 'warn');
    return;
  }
  // 模拟保存（后续可对接错题集后端接口）
  showToast('保存成功 · 已加入错题集', 'success');
}

/* ---------------- 事件绑定 ---------------- */
els.askBtn.addEventListener('click', handleAsk);
els.saveMistakeBtn.addEventListener('click', handleSaveMistake);

els.question.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleAsk();
});
