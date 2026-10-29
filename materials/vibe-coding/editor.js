/* 강의안 편집 모드 — 글자 수정 · 그림 바꾸기 · 새 쪽 만들기/복제/삭제/순서 바꾸기
   저장하면 GitHub API로 main에 바로 커밋한다(관리 페이지와 같은 토큰, localStorage 'aiclass.ghtoken'). */
(function () {
  var deck = window.__deck;
  if (!deck) return;

  var KEY = 'aiclass.ghtoken', REPO = 'wonjongmin034-create/ai-classroom', BR = 'main';
  var BASE = 'materials/vibe-coding/', FILE = BASE + 'index.html', DECK_ID = 'vibe-coding';
  var editing = false, dirty = false, sel = null, editSha = null, pending = {}, bar = null, menu = null;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function getToken() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  /* ---------- 알림 ---------- */
  function toast(t, err) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:200;background:' + (err ? '#d30005' : '#1b2236') +
      ';color:#fff;border-radius:999px;padding:12px 20px;font:700 14px Pretendard,sans-serif;box-shadow:0 12px 30px rgba(27,34,54,.3);max-width:92vw;text-align:center';
    d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, err ? 7000 : 4000);
  }

  /* ---------- GitHub API ---------- */
  function hdr() { return { 'Authorization': 'Bearer ' + getToken(), 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }
  function url(path) { return 'https://api.github.com/repos/' + REPO + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }
  function b64enc(str) { var bytes = new TextEncoder().encode(str), s = ''; bytes.forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
  function b64dec(b) { var s = atob(b.replace(/\n/g, '')), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new TextDecoder().decode(a); }
  function ghGet(path) {
    return fetch(url(path) + '?ref=' + BR + '&t=' + Date.now(), { headers: hdr(), cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' 읽기 실패 (' + r.status + ') — 토큰을 확인해 주세요');
      return r.json();
    }).then(function (j) { return { sha: j.sha, text: b64dec(j.content) }; });
  }
  function ghPut(path, b64, msg, sha) {
    var body = { message: msg, content: b64, branch: BR }; if (sha) body.sha = sha;
    return fetch(url(path), { method: 'PUT', headers: hdr(), body: JSON.stringify(body) }).then(function (r) {
      if (r.ok) return r.json();
      return r.json().catch(function () { return {}; }).then(function (j) {
        throw new Error(r.status === 401 || r.status === 403 ? '토큰 권한을 확인해 주세요 (Contents: Read and write)' : (j.message || '저장 실패 ' + r.status));
      });
    });
  }

  /* ---------- 쪽 템플릿 ---------- */
  var PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="440" height="520"><rect width="100%" height="100%" fill="#eef1f7"/><text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#6f778c">그림을 눌러</text><text x="50%" y="56%" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#6f778c">바꾸세요</text></svg>');
  var TPL = [
    ['title', '제목 + 한 줄 설명', function (c) { return '<div class="pad center-v"><span class="rule" style="background:' + c + '"></span><h1 class="d-lg">제목을 입력하세요</h1><p class="sub">한 줄 설명을 입력하세요</p></div>'; }],
    ['bullets', '제목 + 목록', function (c) { return '<div class="pad vc"><span class="rule sm" style="background:' + c + '"></span><h2 class="d-md">제목을 입력하세요</h2><ul class="bl"><li>첫 번째 내용</li><li>두 번째 내용</li><li>세 번째 내용</li></ul></div>'; }],
    ['cards3', '카드 3개', function (c) { var k = function (t) { return '<div class="card"><span class="lab" style="background:' + c + '">' + t + '</span> <p>내용을 입력하세요</p></div>'; }; return '<div class="pad vc"><h2 class="d-md">제목을 입력하세요</h2><p class=\'lead\'>설명을 입력하세요</p><div class="grid3">' + k('항목 1') + k('항목 2') + k('항목 3') + '</div></div>'; }],
    ['cards2', '큰 카드 2개 (비교)', function (c) { var k = function (t) { return '<div class="card big"><span class="lab" style="background:' + c + '">' + t + '</span> <p>내용을 입력하세요</p></div>'; }; return '<div class="pad vc"><h2 class="d-md">제목을 입력하세요</h2><div class="grid2">' + k('왼쪽') + k('오른쪽') + '</div></div>'; }],
    ['chips', '칩(버튼 모양) 목록', function (c) { return '<div class="pad vc"><span class="rule sm" style="background:' + c + '"></span><h2 class="d-md">제목을 입력하세요</h2><p class=\'lead\'>설명을 입력하세요</p><div class="chips"><span class="chip">항목 1</span><span class="chip">항목 2</span><span class="chip">항목 3</span><span class="chip">항목 4</span></div></div>'; }],
    ['split', '그림 + 글', function (c) { return '<div class="pad split"><div class="col-copy"><span class="kick" style="color:' + c + '">소제목</span> <h2 class="d-md">제목을 입력하세요</h2> <ul class="bl"><li>설명 1</li><li>설명 2</li><li>설명 3</li></ul> </div><div class="figwrap col-img"><div class="panel" style="width:473px;height:545px"><img src="' + PH + '" alt="" /></div></div></div>'; }],
    ['section', '섹션 표지 (어두운 배경)', function () { return '__DARK__<div class="ghost">00</div> <div class="pad"> <span class="kick" style="color:#ffb703">SECTION</span> <h1 class="d-xl">섹션 제목</h1> <p class="lead-dk">한 줄 설명을 입력하세요.</p> </div>'; }]
  ];

  function accentOf(frame) {
    var el = frame && $('.rule,.lab,.tag,.sno', frame);
    var m = el && /background:\s*(#[0-9a-fA-F]{3,8})/.exec(el.getAttribute('style') || '');
    return m ? m[1] : '#ff6b4a';
  }
  function labelOf(frame) { var s = frame && $('.pnum span', frame); return s ? s.textContent : ''; }
  function newSid() { return 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  function makeFrame(tpl, accent, label) {
    var html = tpl[2](accent), dark = html.indexOf('__DARK__') === 0;
    html = html.replace('__DARK__', '');
    var f = document.createElement('div');
    f.className = 'frame'; f.dataset.sid = newSid();
    f.innerHTML = '<section class="slide' + (dark ? ' dark' : '') + '" id="p0">' + html + '<div class="pnum"><span>' + label + '</span><b>00</b></div></section>';
    return f;
  }

  /* ---------- 상태·번호 ---------- */
  function frames() { return $$('.frame'); }
  function markDirty() { dirty = true; if (bar) $('.ed-state', bar).textContent = '● 저장 안 함'; }
  function renumber() {
    frames().forEach(function (f, i) {
      f.dataset.i = i + 1;
      var s = f.firstElementChild; if (s) s.id = 'p' + (i + 1);
      var b = $('.pnum b', f); if (b) b.textContent = pad2(i + 1);
    });
    deck.refresh();
    frames().forEach(prepFrame);
  }
  var EDITABLE = '.pad h1,.pad h2,.pad h3,.pad h4,.pad p,.pad li,.pad .chip,.pad .pill,.pad .lab,.pad .tag,.pad .kick,.pad .sno,.pad .ghost,.pad figcaption,.pad em,.ghost';
  function makeEditable(root) { $$(EDITABLE, root).forEach(function (el) { el.contentEditable = 'true'; el.spellcheck = false; }); }
  function prepFrame(f) {
    if (!f.dataset.sid) f.dataset.sid = f.dataset.i;          // 기존 쪽: 지금 번호가 곧 고유 번호
    makeEditable(f);
  }
  function setSel(f) {
    frames().forEach(function (x) { x.classList.toggle('ed-sel', x === f); });
    sel = f; if (bar) $('.ed-where', bar).textContent = f ? (f.dataset.i + '쪽 선택됨') : '쪽을 눌러 선택하세요';
  }
  function nearestFrame() {
    var mid = innerHeight / 2, best = null, bd = 1e9;
    frames().forEach(function (f) { var r = f.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = f; } });
    return best;
  }

  /* ---------- 쪽 조작 ---------- */
  function insertAfter(ref, node) { ref.parentNode.insertBefore(node, ref.nextSibling); }
  function addSlide(key) {
    var tpl = TPL.filter(function (t) { return t[0] === key; })[0], ref = sel || frames().pop();
    var f = makeFrame(tpl, accentOf(ref), labelOf(ref));
    insertAfter(ref, f); renumber(); setSel(f); markDirty();
    f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast('새 쪽을 ' + f.dataset.i + '쪽에 넣었어요');
  }
  function dupSlide() {
    if (!sel) return toast('먼저 쪽을 눌러 선택하세요', true);
    var c = sel.cloneNode(true);
    c.classList.remove('on', 'ed-sel'); c.removeAttribute('style'); c.firstElementChild.removeAttribute('style');
    $$('.pdock', c).forEach(function (n) { n.remove(); });
    c.dataset.sid = newSid();
    insertAfter(sel, c); renumber(); setSel(c); markDirty(); c.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function delSlide() {
    if (!sel) return toast('먼저 쪽을 눌러 선택하세요', true);
    if (frames().length < 2) return toast('마지막 한 쪽은 지울 수 없어요', true);
    if (!confirm(sel.dataset.i + '쪽을 삭제할까요?\n(저장하기 전에는 새로고침하면 되돌릴 수 있어요)')) return;
    var next = sel.nextElementSibling || sel.previousElementSibling;
    sel.remove(); renumber(); setSel(next); markDirty();
  }
  function moveSlide(dir) {
    if (!sel) return toast('먼저 쪽을 눌러 선택하세요', true);
    var other = dir < 0 ? sel.previousElementSibling : sel.nextElementSibling;
    if (!other || !other.classList.contains('frame')) return;
    if (dir < 0) sel.parentNode.insertBefore(sel, other); else insertAfter(other, sel);
    renumber(); setSel(sel); markDirty(); sel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------- 그림 바꾸기 ---------- */
  var fileInput = null, targetImg = null;
  function pickImage(img) {
    targetImg = img;
    if (!fileInput) {
      fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
      fileInput.addEventListener('change', onFile); document.body.appendChild(fileInput);
    }
    fileInput.value = ''; fileInput.click();
  }
  function onFile() {
    var file = fileInput.files[0]; if (!file || !targetImg) return;
    var img = new Image(), u = URL.createObjectURL(file), tgt = targetImg;
    img.onload = function () {
      var max = 1600, s = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * s), h = Math.round(img.height * s);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
      var png = file.type === 'image/png' && file.size < 700000;
      var data = c.toDataURL(png ? 'image/png' : 'image/jpeg', .88);
      var rel = 'assets/uploads/img-' + Date.now().toString(36) + (png ? '.png' : '.jpg');
      pending[rel] = data.split(',')[1];
      tgt.setAttribute('src', data); tgt.dataset.newsrc = rel; markDirty();
      URL.revokeObjectURL(u);
    };
    img.onerror = function () { toast('이미지를 읽지 못했어요', true); };
    img.src = u;
  }

  /* ---------- 저장 ---------- */
  function serialize() {
    var out = [];
    frames().forEach(function (f, i) {
      var c = f.cloneNode(true), sec = c.firstElementChild;
      sec.removeAttribute('style');
      $$('.pdock', c).forEach(function (n) { n.remove(); });
      $$('[contenteditable],[spellcheck]', c).forEach(function (n) { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck'); });
      $$('img[data-newsrc]', c).forEach(function (im) { im.setAttribute('src', im.dataset.newsrc); im.removeAttribute('data-newsrc'); });
      sec.id = 'p' + (i + 1);
      out.push('<div class="frame" data-i="' + (i + 1) + '" data-sid="' + f.dataset.sid + '">' + sec.outerHTML + '</div>');
    });
    return out.join('\n');
  }
  function parseSids(html) {
    var re = /<div class="frame" data-i="(\d+)"(?: data-sid="([^"]+)")?>/g, m, a = [];
    while ((m = re.exec(html))) a.push(m[2] || m[1]);
    return a;
  }
  function save() {
    if (!dirty) return toast('바뀐 내용이 없어요');
    if (!getToken()) return toast('토큰이 없어요. 관리 페이지에서 연결해 주세요', true);
    var usedPh = frames().some(function (f) { return $$('img', f).some(function (im) { return (im.getAttribute('src') || '').indexOf('data:image/svg') === 0; }); });
    if (usedPh && !confirm('아직 "그림을 눌러 바꾸세요" 자리가 남아 있어요. 그대로 저장할까요?')) return;
    var btn = $('.ed-save', bar); btn.disabled = true; btn.textContent = '저장 중…';
    var newHtml = serialize(), count = frames().length, newOrder = frames().map(function (f) { return f.dataset.sid; });
    var oldOrder, newSha;
    ghGet(FILE).then(function (f) {
      if (editSha && f.sha !== editSha) throw new Error('다른 곳에서 이 강의안이 먼저 바뀌었어요. 새로고침한 뒤 다시 고쳐 주세요.');
      oldOrder = parseSids(f.text);
      var a = f.text.indexOf('<div class="frame"'), endTag = '</section></div>', b = f.text.lastIndexOf(endTag) + endTag.length;
      if (a < 0 || b < endTag.length) throw new Error('강의안 파일 구조를 찾지 못했어요');
      var next = f.text.slice(0, a) + newHtml + f.text.slice(b);
      next = next.replace(/(<span class="cnt" id="cnt">)\d+ \/ \d+/, function (_, a) { return a + '1 / ' + count; });
      // 1) 새로 올린 그림 → 2) 강의안 본문
      var keys = Object.keys(pending), p = Promise.resolve();
      keys.forEach(function (rel) { p = p.then(function () { return ghPut(BASE + rel, pending[rel], '강의안 그림 추가: ' + rel); }); });
      return p.then(function () { return ghPut(FILE, b64enc(next), '강의안 편집: ' + count + '쪽', f.sha); });
    }).then(function (res) {
      newSha = res && res.content && res.content.sha;
      var map = function (r) { var sid = oldOrder[r - 1]; var i = newOrder.indexOf(sid); return i < 0 ? null : i + 1; };
      // 쪽 번호가 바뀌었을 수 있으니 도구함·프롬프트 보관함의 연결 쪽수도 같이 고친다
      return mutateJson('materials.json', function (d) {
        d.materials.forEach(function (m) {
          if (m.id !== DECK_ID) return; m.pages = count;
          m.tools = (m.tools || []).map(function (t) { var n = map(t.slide); return n ? { id: t.id, slide: n } : null; }).filter(Boolean);
        });
      }).then(function () {
        return mutateJson('prompts.json', function (d) {
          d.forEach(function (p) { if (p.source === DECK_ID && p.slide) { var n = map(p.slide); p.slide = n || 1; } });
        });
      });
    }).then(function () {
      return ghGet(FILE).then(function (f) { editSha = f.sha; });
    }).then(function () {
      pending = {}; dirty = false; $('.ed-state', bar).textContent = '✓ 저장됨';
      btn.disabled = false; btn.textContent = '💾 저장';
      toast('저장했어요 · 1~2분 뒤 사이트에 반영돼요 (PDF 파일은 그대로예요)');
    }).catch(function (e) { btn.disabled = false; btn.textContent = '💾 저장'; toast(e.message, true); });
  }
  function mutateJson(path, fn) {
    return ghGet(path).then(function (f) {
      var d = JSON.parse(f.text); fn(d);
      return ghPut(path, b64enc(JSON.stringify(d, null, path === 'prompts.json' ? 1 : 2) + '\n'), '강의안 쪽수 연결 정리: ' + path, f.sha);
    });
  }

  /* ---------- 편집 모드 켜기/끄기 ---------- */
  function buildBar() {
    bar = document.createElement('div'); bar.className = 'edbar';
    bar.innerHTML = '<b class="ed-title">✏️ 편집 모드</b><span class="ed-where">쪽을 눌러 선택하세요</span>' +
      '<button data-a="add">＋ 새 쪽 ▾</button><button data-a="dup">⎘ 복제</button><button data-a="up">▲ 위로</button><button data-a="down">▼ 아래로</button><button data-a="del" class="ed-danger">🗑 삭제</button>' +
      '<span class="ed-state"></span><button data-a="save" class="ed-save">💾 저장</button><button data-a="exit">닫기</button>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return; var a = b.dataset.a;
      if (a === 'add') return toggleMenu(b);
      closeMenu();
      if (a === 'dup') dupSlide(); else if (a === 'up') moveSlide(-1); else if (a === 'down') moveSlide(1);
      else if (a === 'del') delSlide(); else if (a === 'save') save(); else if (a === 'exit') exit();
    });
  }
  function toggleMenu(anchor) {
    if (menu) return closeMenu();
    menu = document.createElement('div'); menu.className = 'ed-menu';
    menu.innerHTML = '<p>어떤 모양으로 만들까요? (선택한 쪽 다음에 들어가요)</p>' + TPL.map(function (t) { return '<button data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(r.left, innerWidth - 300)) + 'px';
    menu.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) { closeMenu(); addSlide(b.dataset.t); } });
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }

  function enter() {
    if (!getToken()) {
      var t = window.prompt('편집하려면 GitHub 토큰이 필요해요.\n관리 페이지(admin.html)에서 쓰는 것과 같은 토큰을 붙여넣어 주세요.\n(이 브라우저에만 저장돼요)');
      if (!t) return; try { localStorage.setItem(KEY, t.trim()); } catch (e) {}
    }
    if (deck.isPresent()) deck.setPresent(false);
    ghGet(FILE).then(function (f) {
      editSha = f.sha; editing = true; document.body.classList.add('editing');
      frames().forEach(prepFrame); buildBar(); setSel(nearestFrame()); deck.refresh();
      $('#edBtn').hidden = true;
      toast('글자를 눌러 고치고, 그림을 눌러 바꿀 수 있어요');
    }).catch(function (e) { toast(e.message, true); });
  }
  function exit() {
    if (dirty && !confirm('저장하지 않은 변경이 있어요. 닫으면 사라져요. 닫을까요?')) return;
    if (dirty) { dirty = false; location.reload(); return; }
    editing = false; document.body.classList.remove('editing');
    frames().forEach(function (f) { f.classList.remove('ed-sel'); $$('[contenteditable]', f).forEach(function (p) { p.removeAttribute('contenteditable'); p.removeAttribute('spellcheck'); }); });
    closeMenu(); if (bar) { bar.remove(); bar = null; } $('#edBtn').hidden = false; deck.refresh();
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('mousedown', function (e) {
    if (!editing) return;
    var f = e.target.closest && e.target.closest('.frame'); if (f) setSel(f);
    if (menu && !e.target.closest('.ed-menu') && !e.target.closest('[data-a="add"]')) closeMenu();
  });
  document.addEventListener('click', function (e) {
    if (!editing) return;
    var a = e.target.closest && e.target.closest('.slide a'); if (a) { e.preventDefault(); return; }
    var im = e.target.closest && e.target.closest('.slide img'); if (im) { e.preventDefault(); pickImage(im); }
  }, true);
  document.addEventListener('input', function (e) { if (editing && e.target.closest && e.target.closest('.slide')) markDirty(); });
  document.addEventListener('keydown', function (e) {
    if (!editing) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); return; }
    var el = e.target; if (!el || !el.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && /^[biu]$/i.test(e.key)) { e.preventDefault(); return; }
    var item = el.closest ? el.closest('li,.chip') : null;
    if (e.key === 'Enter' && item && item.isContentEditable) {
      e.preventDefault(); var n = item.cloneNode(false); n.textContent = '새 항목'; n.contentEditable = 'true'; n.removeAttribute('data-p'); n.classList.remove('has-p');
      item.parentNode.insertBefore(n, item.nextSibling); var r = document.createRange(); r.selectNodeContents(n); var s = getSelection(); s.removeAllRanges(); s.addRange(r); markDirty(); return;
    }
    if (e.key === 'Backspace' && item && item.isContentEditable && !item.textContent.trim() && item.parentNode.children.length > 1) {
      e.preventDefault(); var prev = item.previousElementSibling || item.nextElementSibling; item.remove(); if (prev) { var r2 = document.createRange(); r2.selectNodeContents(prev); r2.collapse(false); var s2 = getSelection(); s2.removeAllRanges(); s2.addRange(r2); } markDirty(); return;
    }
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
  }, true);
  document.addEventListener('paste', function (e) {
    if (!editing || !(e.target && e.target.isContentEditable)) return;
    e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t);
  }, true);
  document.addEventListener('dragstart', function (e) { if (editing) e.preventDefault(); });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- 진입 버튼: 토큰이 있거나 주소에 #edit 가 있을 때만 보인다 ---------- */
  var ui = $('.ui');
  if (ui) {
    var btn = document.createElement('button'); btn.id = 'edBtn'; btn.type = 'button'; btn.textContent = '✏️ 편집'; btn.title = '이 강의안을 직접 고치기';
    btn.hidden = !(getToken() || /edit/.test(location.hash + location.search));
    btn.addEventListener('click', enter);
    ui.insertBefore(btn, $('#mode'));
  }
  window.addEventListener('hashchange', function () { var b = $('#edBtn'); if (b && !editing && /edit/.test(location.hash)) b.hidden = false; });
})();
