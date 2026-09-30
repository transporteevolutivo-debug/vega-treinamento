/* Treinamento Grupo Vega · app do motorista (login por celular + senha; conteúdo protegido no banco) */
(() => {
  const C = window.VEGA_CONFIG;
  const sb = supabase.createClient(C.supabaseUrl, C.supabaseKey);
  const $ = (s) => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const views = ["v-login", "v-home", "v-module", "v-quiz"];
  const show = (id) => { views.forEach(v => $("#" + v).classList.toggle("hidden", v !== id)); window.scrollTo(0, 0); };
  const loading = (on) => $("#loading").classList.toggle("hidden", !on);
  const S = { user: null, name: "", progress: {}, screens: [], slides: {}, mod: null, idx: 0, tick: null, enteredAt: 0, quiz: null, answers: {} };
  const isDesk = () => window.innerWidth >= 900 && window.innerHeight >= 500;   // computador: slide 16:9; celular: tela vertical
  const emailOf = (phone) => `${phone}@motoristas.vega`;
  const digits = (v) => (v || "").replace(/\D/g, "");

  // ---------- conteúdo protegido (telas do deck) ----------
  async function loadScreens() {
    if (S.screens.length) return true;
    const { data, error } = await sb.from("content").select("name,mime,data").not("name", "like", "slide/%");
    if (error || !data || !data.length) return false;
    const rows = Object.fromEntries(data.map(r => [r.name, r]));
    if (!document.getElementById("screens-css")) { const st = document.createElement("style"); st.id = "screens-css"; st.textContent = rows["screens.css"].data; document.head.appendChild(st); }
    let html = rows["screens.html"].data;
    html = html.replace(/src="(img\/[^"]+)"/g, (m, p) => rows[p] ? `src="data:${rows[p].mime};base64,${rows[p].data}"` : m);
    const m = $("#measure"); m.innerHTML = html;
    await document.fonts.ready;
    m.querySelectorAll(".screen").forEach(sc => {
      const body = sc.querySelector(".body"), foot = sc.querySelector("footer"); if (!body || !foot) return;
      const limit = () => foot.getBoundingClientRect().top - 6; let s = 1;
      if (body.getBoundingClientRect().bottom > limit()) sc.classList.add("compact");
      while (body.getBoundingClientRect().bottom > limit() && s > 0.6) { s -= 0.02; sc.style.setProperty("--s", s.toFixed(2)); }
    });
    S.screens = [...m.querySelectorAll(".screen")].map(el => ({ slide: +el.dataset.slide, el }));
    return true;
  }
  const screensOf = (mod) => S.screens.filter(s => s.slide >= mod.from && s.slide <= mod.to);

  // ---------- autenticação ----------
  async function login(e) {
    e && e.preventDefault();
    const phone = digits($("#l-phone").value), pass = $("#l-pass").value; const err = $("#login-err"); err.textContent = "";
    if (!/^\d{10,11}$/.test(phone)) return err.textContent = "Digite o celular com DDD (10 ou 11 números).";
    if (!pass) return err.textContent = "Digite a sua senha.";
    $("#b-login").disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: emailOf(phone), password: pass });
    $("#b-login").disabled = false;
    if (error) return err.textContent = "Celular ou senha incorretos. Se é o seu primeiro acesso, use a aba ao lado.";
    await enter();
  }
  async function register(e) {
    e && e.preventDefault();
    const name = $("#r-name").value.trim().replace(/\s+/g, " "), phone = digits($("#r-phone").value), p1 = $("#r-pass").value, p2 = $("#r-pass2").value;
    const err = $("#reg-err"); err.textContent = "";
    if (name.split(" ").length < 2 || name.length < 5) return err.textContent = "Informe nome e sobrenome.";
    if (!/^\d{10,11}$/.test(phone)) return err.textContent = "Digite o celular com DDD (10 ou 11 números).";
    if (p1.length < 6 || p1.length > 10) return err.textContent = "A senha deve ter de 6 a 10 caracteres (letras, números ou símbolos).";
    if (p1 !== p2) return err.textContent = "As senhas não conferem.";
    $("#b-reg").disabled = true;
    try {
      const r = await fetch(`${C.supabaseUrl}/functions/v1/cadastro`, { method: "POST", headers: { "Content-Type": "application/json", apikey: C.supabaseKey }, body: JSON.stringify({ name, phone, password: p1 }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { $("#b-reg").disabled = false; return err.textContent = j.error || "Não foi possível concluir o cadastro."; }
      const { error } = await sb.auth.signInWithPassword({ email: emailOf(phone), password: p1 });
      $("#b-reg").disabled = false;
      if (error) return err.textContent = "Cadastro feito, mas não foi possível entrar. Tente pela aba \"Já tenho cadastro\".";
      await enter();
    } catch { $("#b-reg").disabled = false; err.textContent = "Sem conexão. Tente de novo."; }
  }
  async function resetPassword(e) {
    e && e.preventDefault();
    const phone = digits($("#x-phone").value), code = digits($("#x-code").value), p1 = $("#x-pass").value, p2 = $("#x-pass2").value; const err = $("#reset-err"); err.textContent = "";
    if (!/^\d{10,11}$/.test(phone)) return err.textContent = "Digite o celular com DDD (10 ou 11 números).";
    if (!/^\d{6}$/.test(code)) return err.textContent = "Digite o código de 6 números enviado pelo administrador.";
    if (p1.length < 6 || p1.length > 10) return err.textContent = "A senha deve ter de 6 a 10 caracteres (letras, números ou símbolos).";
    if (p1 !== p2) return err.textContent = "As senhas não conferem.";
    $("#b-reset").disabled = true;
    try {
      const r = await fetch(`${C.supabaseUrl}/functions/v1/redefinir`, { method: "POST", headers: { "Content-Type": "application/json", apikey: C.supabaseKey }, body: JSON.stringify({ phone, code, password: p1 }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { $("#b-reset").disabled = false; return err.textContent = j.error || "Não foi possível redefinir a senha."; }
      const { error } = await sb.auth.signInWithPassword({ email: emailOf(phone), password: p1 });
      $("#b-reset").disabled = false;
      if (error) return err.textContent = "Senha salva, mas não foi possível entrar. Use \"Já tenho cadastro\".";
      toast("Nova senha salva."); await enter();
    } catch { $("#b-reset").disabled = false; err.textContent = "Sem conexão. Tente de novo."; }
  }
  async function logout() { await sb.auth.signOut(); S.user = null; S.screens = []; $("#measure").innerHTML = ""; show("v-login"); }

  async function enter() {
    loading(true);
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { loading(false); return show("v-login"); }
    S.user = user;
    const { data: d } = await sb.from("drivers").select("name").eq("id", user.id).maybeSingle();
    S.name = (d && d.name) || (user.user_metadata && user.user_metadata.name) || "motorista";
    const ok = await loadScreens();
    loading(false);
    if (!ok) { toast("Não foi possível carregar o conteúdo. Verifique a conexão."); return show("v-login"); }
    await home();
  }

  // ---------- início ----------
  async function home() {
    const { data, error } = await sb.from("module_progress").select("module_id,last_screen,max_screen,seconds,completed_at").eq("driver_id", S.user.id);
    if (error) { toast("Erro ao carregar o progresso."); return; }
    S.progress = {}; (data || []).forEach(r => S.progress[r.module_id] = { ...r, completed: !!r.completed_at });
    $("#h-name").textContent = S.name.split(" ")[0];
    const box = $("#mods"); box.innerHTML = ""; let unlocked = true;
    C.modules.forEach(m => {
      const scr = screensOf(m), p = S.progress[m.id], done = !!(p && p.completed), redo = !!(p && !p.completed && p.max_screen === 0 && p.seconds > 0);
      const pct = p ? Math.round(100 * Math.min(p.max_screen, scr.length) / scr.length) : 0, canOpen = done || unlocked;
      const b = document.createElement("button"); b.className = "mod" + (done ? " done" : "") + (redo ? " redo" : "") + (canOpen ? "" : " locked");
      b.innerHTML = `<div class="n">${done ? "✓" : m.id}</div><div class="b"><b>${esc(m.title)}</b><span>${esc(m.subtitle)}</span><div class="bar"><i style="width:${done ? 100 : pct}%"></i></div></div><div class="st">${done ? "Concluído" : redo ? "Refazer" : (p ? pct + "%" : scr.length + " telas")}</div>`;
      b.onclick = () => canOpen ? openModule(m) : toast("Conclua o módulo anterior primeiro.");
      box.appendChild(b); if (!done) unlocked = false;
    });
    const allDone = C.modules.every(m => S.progress[m.id] && S.progress[m.id].completed);
    const { data: att } = await sb.from("attempts").select("id,finished_at,score,total,passed,detail,reset_modules").eq("driver_id", S.user.id).not("finished_at", "is", null).order("finished_at", { ascending: false });
    const best = (att || []).find(a => a.passed), last = (att || [])[0]; const q = $("#quizcard");
    const modNames = ids => (ids || []).map(id => { const m = C.modules.find(x => x.id === id); return m ? m.id + ". " + m.title : id; }).join(", ");
    if (best) q.innerHTML = `<b>Prova concluída</b><p>Aprovado com ${best.score} de ${best.total} em ${new Date(best.finished_at).toLocaleDateString("pt-BR")}.</p><span class="pill ok">APROVADO</span>`;
    else if (allDone) q.innerHTML = `<b>Prova de conhecimento</b><p>Todos os módulos concluídos. ${last ? "Última tentativa: " + last.score + "/" + last.total + ". " : ""}São 15 questões, aprovação com 80%.</p><button class="btn sm" id="b-quiz">Fazer a prova</button>`;
    else if (last) q.innerHTML = `<b>Prova de conhecimento</b><p>Você fez ${last.score} de ${last.total} na última prova. Assista de novo: ${esc(modNames((last.reset_modules || []).filter(id => !(S.progress[id] && S.progress[id].completed))))}. Depois, faça uma nova prova completa.</p><span class="pill no">REFAZER MÓDULOS</span>`;
    else q.innerHTML = `<b>Prova de conhecimento</b><p>Libera quando os cinco módulos estiverem concluídos.</p><span class="pill">BLOQUEADA</span>`;
    const bq = $("#b-quiz"); if (bq) bq.onclick = () => { show("v-quiz"); $("#quiz-intro").classList.remove("hidden"); $("#quiz-body").classList.add("hidden"); $("#quiz-result").classList.add("hidden"); };
    renderHistory(att || []);
    show("v-home");
  }

  // ---------- histórico de provas (perfil do motorista) ----------
  const modOf = id => { const m = C.modules.find(x => x.id === id); return m ? "Módulo " + m.id + " · " + m.title : ""; };
  const reviewHtml = (detail) => (detail || []).map(d => `<div class="ri ${d.ok ? "ok" : "no"}"><div class="mk">${d.ok ? "✓" : "✗"}</div><div><div class="qq">${d.n}. ${esc(d.q)}</div><div class="aa">${d.ok ? "Acertou" : "Errou"} · sua resposta: ${esc(d.a ?? "(em branco)")}</div>${d.ok ? "" : `<div class="ee" style="color:var(--muted)">${esc(modOf(d.m))}</div>`}</div></div>`).join("");
  function renderHistory(att) {
    const h = $("#history"); if (!att.length) { h.innerHTML = ""; return; }
    h.innerHTML = `<div class="hist"><h2>Suas provas</h2>` + att.map((a, i) => `<div class="att"><button class="hd" data-i="${i}"><b>${a.score}/${a.total}</b><span class="d">${new Date(a.finished_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>${a.passed ? '<span class="pill ok">Aprovado</span>' : '<span class="pill no">Reprovado</span>'}<span class="ar">ver ▾</span></button><div class="rev hidden">${reviewHtml(a.detail) || '<div class="aa">Sem detalhe por questão.</div>'}</div></div>`).join("") + `</div>`;
    h.querySelectorAll(".hd").forEach(b => b.onclick = () => { const r = b.nextElementSibling; r.classList.toggle("hidden"); b.querySelector(".ar").textContent = r.classList.contains("hidden") ? "ver ▾" : "fechar ▴"; });
  }

  // ---------- leitura ----------
  function openModule(m) {
    S.mod = m; const scr = screensOf(m), p = S.progress[m.id];
    S.idx = p && !p.completed ? Math.min(p.last_screen, scr.length - 1) : 0;
    $("#m-title").textContent = ("MÓDULO " + m.id + " · " + m.title).toUpperCase(); $("#p-tot").textContent = scr.length;
    show("v-module"); render();
  }
  function fitStage() {
    const st = $("#stage"), desk = st.classList.contains("desk");
    const vw = desk ? Math.min(window.innerWidth - 48, 1400) : Math.min(window.innerWidth - 16, 520), vh = window.innerHeight - 150;
    const W = desk ? 1600 : (st.offsetWidth || 408), H = desk ? 900 : (st.offsetHeight || 726); const k = Math.min(vw / W, vh / H, desk ? 1 : 1.15);
    st.style.transform = `scale(${k})`; st.parentElement.style.height = (H * k + 20) + "px";
  }
  // imagem 16:9 do slide (carregada sob demanda e guardada na sessão)
  async function slideImg(no) {
    const key = "slide/" + String(no).padStart(2, "0") + ".jpg";
    if (!S.slides[key]) S.slides[key] = sb.from("content").select("mime,data").eq("name", key).maybeSingle().then(({ data }) => data ? `data:${data.mime};base64,${data.data}` : null).catch(() => null);
    return S.slides[key];
  }
  function render() {
    const scr = screensOf(S.mod), cur = scr[S.idx]; const st = $("#stage"); st.innerHTML = ""; st.classList.toggle("desk", isDesk());
    if (st.classList.contains("desk")) {
      const img = document.createElement("img"); img.alt = "Slide " + cur.slide; const ph = document.createElement("div"); ph.className = "ph"; ph.textContent = "Carregando…"; st.appendChild(ph);
      const want = S.idx;
      slideImg(cur.slide).then(src => { if (S.idx !== want || !st.classList.contains("desk")) return; if (src) { img.src = src; st.innerHTML = ""; st.appendChild(img); } else { st.classList.remove("desk"); st.innerHTML = ""; st.appendChild(cur.el.cloneNode(true)); fitStage(); } });
      if (scr[S.idx + 1]) slideImg(scr[S.idx + 1].slide);
    } else st.appendChild(cur.el.cloneNode(true));
    $("#p-cur").textContent = S.idx + 1; $("#b-prev").disabled = S.idx === 0;
    const last = S.idx === scr.length - 1; $("#b-next").textContent = last ? "Concluir módulo" : "Próxima";
    fitStage(); window.scrollTo(0, 0);
    clearInterval(S.tick); S.enteredAt = Date.now(); $("#b-next").disabled = true; $("#timer").style.width = "0";
    const seen = S.progress[S.mod.id] && S.progress[S.mod.id].max_screen > S.idx; const need = seen ? 0 : readSeconds(cur) * 1000;
    const label = $("#b-next").textContent;
    S.tick = setInterval(() => {
      const dt = Date.now() - S.enteredAt; $("#timer").style.width = Math.min(100, 100 * dt / Math.max(need, 1)) + "%";
      if (dt >= need) { $("#b-next").disabled = false; $("#b-next").textContent = label; clearInterval(S.tick); }
      else $("#b-next").textContent = `${label} · ${Math.ceil((need - dt) / 1000)} s`;
    }, 120);
  }
  // tempo mínimo de leitura de uma tela, pelo tamanho do texto (config.reading)
  function readSeconds(screen) {
    const R = C.reading || { baseSeconds: 0, wordsPerSecond: 1e9, minSeconds: C.minSecondsPerScreen || 4, maxSeconds: C.minSecondsPerScreen || 4 };
    const words = (screen.el.textContent || "").trim().split(/\s+/).filter(w => w.length > 1).length;
    return Math.min(R.maxSeconds, Math.max(R.minSeconds, Math.round(R.baseSeconds + words / R.wordsPerSecond)));
  }
  async function logAndMove(delta) {
    const scr = screensOf(S.mod), secs = Math.min(7200, Math.max(0, Math.round((Date.now() - S.enteredAt) / 1000)));
    const next = S.idx + delta, completing = delta > 0 && S.idx === scr.length - 1;
    const screenNo = Math.min(Math.max(next, 0), scr.length - 1);
    const args = { p_module: S.mod.id, p_screen: completing ? scr.length : screenNo, p_seconds: secs, p_completed: completing };
    const p = S.progress[S.mod.id] || (S.progress[S.mod.id] = { module_id: S.mod.id, last_screen: 0, max_screen: 0, seconds: 0, completed: false });
    p.max_screen = Math.max(p.max_screen, S.idx + 1); p.seconds += secs;
    if (!completing) {
      sb.rpc("log_progress", args).then(({ error }) => { if (error) { S.pending = (S.pending || []).concat([args]); toast("Sem conexão: o progresso será salvo na próxima tela."); } });
      S.idx = screenNo; return render();
    }
    // concluir: grava antes de voltar (com nova tentativa), para a lista já mostrar "Concluído"
    $("#b-next").disabled = true; $("#b-next").textContent = "Salvando…";
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) { const { error } = await sb.rpc("log_progress", args); ok = !error; if (!ok) await new Promise(r => setTimeout(r, 1200)); }
    if (!ok) { $("#b-next").disabled = false; $("#b-next").textContent = "Concluir módulo"; return toast("Sem conexão: não foi possível salvar a conclusão. Tente de novo."); }
    p.completed = true; toast("Módulo concluído!"); return home();
  }
  // reenvia registros que falharam (sem conexão) assim que outro registro passar
  const flushPending = async () => { const q = S.pending || []; S.pending = []; for (const a of q) { const { error } = await sb.rpc("log_progress", a); if (error) S.pending.push(a); } };
  setInterval(() => { if (S.user && (S.pending || []).length) flushPending(); }, 15000);

  // ---------- prova ----------
  async function startQuiz() {
    $("#quiz-err").textContent = ""; $("#b-start-quiz").disabled = true;
    const { data, error } = await sb.rpc("get_quiz"); $("#b-start-quiz").disabled = false;
    if (error) return $("#quiz-err").textContent = (error.message || "").includes("módulos") ? "Conclua todos os módulos antes da prova." : "Não foi possível carregar a prova.";
    S.quiz = data; S.answers = {}; const b = $("#quiz-body"); b.innerHTML = "";
    data.forEach((q, i) => {
      const d = document.createElement("div"); d.className = "q"; d.id = "q" + q.id;
      d.innerHTML = `<div class="qn">Questão ${i + 1} de ${data.length}</div><div class="qt">${esc(q.text)}</div>` + q.options.map((o, j) => `<button class="opt" data-q="${q.id}" data-k="${o.k}"><span class="l">${"ABCD"[j]}</span><span>${esc(o.text)}</span></button>`).join("");
      b.appendChild(d);
    });
    const send = document.createElement("button"); send.className = "btn"; send.id = "b-send"; send.textContent = "Entregar prova"; send.disabled = true; b.appendChild(send);
    const st = document.createElement("div"); st.className = "err"; st.id = "quiz-status"; b.appendChild(st);
    b.querySelectorAll(".opt").forEach(o => o.onclick = () => {
      const q = o.dataset.q; S.answers[q] = +o.dataset.k; b.querySelectorAll(`.opt[data-q="${q}"]`).forEach(x => x.classList.toggle("sel", x === o));
      const left = data.length - Object.keys(S.answers).length; send.disabled = left > 0; st.textContent = left ? `Faltam ${left} questões.` : "";
    });
    send.onclick = submitQuiz; $("#quiz-intro").classList.add("hidden"); b.classList.remove("hidden"); window.scrollTo(0, 0);
  }
  async function submitQuiz() {
    $("#b-send").disabled = true;
    const { data, error } = await sb.rpc("submit_attempt", { p_answers: S.answers });
    if (error) { $("#b-send").disabled = false; return $("#quiz-status").textContent = "Não foi possível enviar. Tente de novo."; }
    const r = data[0], pct = Math.round(100 * r.score / r.total), res = $("#quiz-result");
    const redo = (r.reset_modules || []).map(id => { const m = C.modules.find(x => x.id === id); return m ? `<li>${m.id}. ${esc(m.title)}</li>` : ""; }).join("");
    res.innerHTML = `<div class="result"><div class="score ${r.passed ? "" : "no"}">${r.score}<span style="font-size:28px;color:var(--muted)">/${r.total}</span></div><h2>${r.passed ? "Aprovado!" : "Ainda não foi desta vez"}</h2><p class="muted">${pct}% de acertos · mínimo ${C.passPercent}%</p></div>`
      + (r.passed ? `<div class="cert"><div class="k">Grupo Vega · Treinamento de motoristas</div><h3>${esc(S.name)}</h3><p>concluiu os cinco módulos e foi aprovado na prova de conhecimento</p><p><b>${r.score} de ${r.total}</b> · ${new Date().toLocaleDateString("pt-BR")}</p></div>`
                 : `<div class="quizcard"><b>Assista de novo os módulos em que houve erro</b><ul style="margin:0 0 10px 18px;padding:0;color:var(--goldl)">${redo}</ul><p>Eles voltaram ao zero. Depois de concluí-los, faça uma nova prova completa.</p></div>`)
      + `<div class="hist"><h2>Sua prova, questão por questão</h2><div class="sumline"><span class="pill ok">${r.score} certas</span><span class="pill no">${r.total - r.score} erradas</span></div><div class="att"><div class="rev" style="border:0;padding:0;margin:0">${reviewHtml(r.detail)}</div></div></div>`
      + `<button class="btn" id="b-back">Voltar aos módulos</button>`;
    $("#quiz-body").classList.add("hidden"); res.classList.remove("hidden"); window.scrollTo(0, 0);
    $("#b-back").onclick = home;
  }

  // ---------- util / eventos ----------
  let tt; function toast(msg) { let t = document.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); } t.textContent = msg; t.style.display = "block"; clearTimeout(tt); tt = setTimeout(() => t.style.display = "none", 2800); }
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => { document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t)); $("#f-login").classList.toggle("hidden", t.dataset.tab !== "login"); $("#f-reg").classList.toggle("hidden", t.dataset.tab !== "reg"); });
  $("#f-login").onsubmit = login; $("#f-reg").onsubmit = register; $("#f-reset").onsubmit = resetPassword;
  const showReset = (on) => { $("#f-reset").classList.toggle("hidden", !on); $("#f-login").classList.toggle("hidden", on); $("#f-reg").classList.add("hidden"); $(".tabs").classList.toggle("hidden", on); if (on) $("#x-phone").value = $("#l-phone").value; };
  $("#b-forgot").onclick = () => showReset(true); $("#b-forgot-back").onclick = () => { showReset(false); document.querySelector('.tab[data-tab="login"]').click(); };
  $("#b-logout").onclick = logout; $("#b-home").onclick = () => { clearInterval(S.tick); logAndMove(0); }; $("#b-home2").onclick = home;
  $("#b-prev").onclick = () => logAndMove(-1); $("#b-next").onclick = () => logAndMove(1); $("#b-start-quiz").onclick = startQuiz;
  window.addEventListener("resize", () => { if ($("#v-module").classList.contains("hidden")) return; if ($("#stage").classList.contains("desk") !== isDesk()) render(); else fitStage(); });
  document.addEventListener("keydown", e => { if ($("#v-module").classList.contains("hidden") || e.target.tagName === "INPUT") return; if (e.key === "ArrowRight" && !$("#b-next").disabled) logAndMove(1); else if (e.key === "ArrowLeft" && !$("#b-prev").disabled) logAndMove(-1); });

  (async () => { const { data: { session } } = await sb.auth.getSession(); if (session) await enter(); else { loading(false); show("v-login"); } })();
})();
