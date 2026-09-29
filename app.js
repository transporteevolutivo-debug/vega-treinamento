/* Treinamento Grupo Vega · app do motorista (login por celular + senha; conteúdo protegido no banco) */
(() => {
  const C = window.VEGA_CONFIG;
  const sb = supabase.createClient(C.supabaseUrl, C.supabaseKey);
  const $ = (s) => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const views = ["v-login", "v-home", "v-module", "v-quiz"];
  const show = (id) => { views.forEach(v => $("#" + v).classList.toggle("hidden", v !== id)); window.scrollTo(0, 0); };
  const loading = (on) => $("#loading").classList.toggle("hidden", !on);
  const S = { user: null, name: "", progress: {}, screens: [], mod: null, idx: 0, tick: null, enteredAt: 0, quiz: null, answers: {} };
  const emailOf = (phone) => `${phone}@motoristas.vega`;
  const digits = (v) => (v || "").replace(/\D/g, "");

  // ---------- conteúdo protegido (telas do deck) ----------
  async function loadScreens() {
    if (S.screens.length) return true;
    const { data, error } = await sb.from("content").select("name,mime,data");
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
    if (p1.length < 6) return err.textContent = "A senha precisa ter pelo menos 6 caracteres.";
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
      const scr = screensOf(m), p = S.progress[m.id], done = !!(p && p.completed), pct = p ? Math.round(100 * Math.min(p.max_screen, scr.length) / scr.length) : 0;
      const b = document.createElement("button"); b.className = "mod" + (done ? " done" : "") + (unlocked ? "" : " locked");
      b.innerHTML = `<div class="n">${done ? "✓" : m.id}</div><div class="b"><b>${esc(m.title)}</b><span>${esc(m.subtitle)}</span><div class="bar"><i style="width:${done ? 100 : pct}%"></i></div></div><div class="st">${done ? "Concluído" : (p ? pct + "%" : scr.length + " telas")}</div>`;
      const canOpen = unlocked; b.onclick = () => canOpen ? openModule(m) : toast("Conclua o módulo anterior primeiro.");
      box.appendChild(b); if (!done) unlocked = false;
    });
    const allDone = C.modules.every(m => S.progress[m.id] && S.progress[m.id].completed);
    const { data: att } = await sb.from("attempts").select("finished_at,score,total,passed").eq("driver_id", S.user.id).not("finished_at", "is", null).order("finished_at", { ascending: false });
    const best = (att || []).find(a => a.passed), last = (att || [])[0]; const q = $("#quizcard");
    if (best) q.innerHTML = `<b>Prova concluída</b><p>Aprovado com ${best.score} de ${best.total} em ${new Date(best.finished_at).toLocaleDateString("pt-BR")}.</p><span class="pill ok">APROVADO</span>`;
    else if (allDone) q.innerHTML = `<b>Prova de conhecimento</b><p>Todos os módulos concluídos. ${last ? "Última tentativa: " + last.score + "/" + last.total + ". " : ""}São 15 questões, aprovação com 80%.</p><button class="btn sm" id="b-quiz">Fazer a prova</button>`;
    else q.innerHTML = `<b>Prova de conhecimento</b><p>Libera quando os cinco módulos estiverem concluídos.</p><span class="pill">BLOQUEADA</span>`;
    const bq = $("#b-quiz"); if (bq) bq.onclick = () => { show("v-quiz"); $("#quiz-intro").classList.remove("hidden"); $("#quiz-body").classList.add("hidden"); $("#quiz-result").classList.add("hidden"); };
    show("v-home");
  }

  // ---------- leitura ----------
  function openModule(m) {
    S.mod = m; const scr = screensOf(m), p = S.progress[m.id];
    S.idx = p && !p.completed ? Math.min(p.last_screen, scr.length - 1) : 0;
    $("#m-title").textContent = ("MÓDULO " + m.id + " · " + m.title).toUpperCase(); $("#p-tot").textContent = scr.length;
    show("v-module"); render();
  }
  function fitStage() {
    const st = $("#stage"); const vw = Math.min(window.innerWidth - 16, 520), vh = window.innerHeight - 160;
    const W = st.offsetWidth || 408, H = st.offsetHeight || 726; const k = Math.min(vw / W, vh / H, 1.15);
    st.style.transform = `scale(${k})`; st.parentElement.style.height = (H * k + 20) + "px";
  }
  function render() {
    const scr = screensOf(S.mod), cur = scr[S.idx]; const st = $("#stage"); st.innerHTML = ""; st.appendChild(cur.el.cloneNode(true));
    $("#p-cur").textContent = S.idx + 1; $("#b-prev").disabled = S.idx === 0;
    const last = S.idx === scr.length - 1; $("#b-next").textContent = last ? "Concluir módulo" : "Próxima";
    fitStage(); window.scrollTo(0, 0);
    clearInterval(S.tick); S.enteredAt = Date.now(); $("#b-next").disabled = true; $("#timer").style.width = "0";
    const seen = S.progress[S.mod.id] && S.progress[S.mod.id].max_screen > S.idx; const need = seen ? 0 : C.minSecondsPerScreen * 1000;
    S.tick = setInterval(() => { const dt = Date.now() - S.enteredAt; $("#timer").style.width = Math.min(100, 100 * dt / Math.max(need, 1)) + "%"; if (dt >= need) { $("#b-next").disabled = false; clearInterval(S.tick); } }, 120);
  }
  async function logAndMove(delta) {
    const scr = screensOf(S.mod), secs = Math.round((Date.now() - S.enteredAt) / 1000);
    const next = S.idx + delta, completing = delta > 0 && S.idx === scr.length - 1;
    const screenNo = Math.min(Math.max(next, 0), scr.length - 1);
    sb.rpc("log_progress", { p_module: S.mod.id, p_screen: completing ? scr.length : screenNo, p_seconds: secs, p_completed: completing }).then(({ error }) => { if (error) toast("Sem conexão: o progresso não foi salvo."); });
    const p = S.progress[S.mod.id] || (S.progress[S.mod.id] = { module_id: S.mod.id, last_screen: 0, max_screen: 0, seconds: 0, completed: false });
    p.max_screen = Math.max(p.max_screen, S.idx + 1); p.seconds += secs;
    if (completing) { p.completed = true; toast("Módulo concluído!"); return home(); }
    S.idx = screenNo; render();
  }

  // ---------- prova ----------
  async function startQuiz() {
    $("#quiz-err").textContent = ""; $("#b-start-quiz").disabled = true;
    const { data, error } = await sb.rpc("get_quiz"); $("#b-start-quiz").disabled = false;
    if (error) return $("#quiz-err").textContent = (error.message || "").includes("módulos") ? "Conclua todos os módulos antes da prova." : "Não foi possível carregar a prova.";
    S.quiz = data; S.answers = {}; const b = $("#quiz-body"); b.innerHTML = "";
    data.forEach((q, i) => {
      const d = document.createElement("div"); d.className = "q"; d.id = "q" + q.id;
      d.innerHTML = `<div class="qn">Questão ${i + 1} de ${data.length}</div><div class="qt">${esc(q.text)}</div>` + q.options.map((o, j) => `<button class="opt" data-q="${q.id}" data-k="${o.k}"><span class="l">${"ABCDE"[j]}</span><span>${esc(o.text)}</span></button>`).join("");
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
    res.innerHTML = `<div class="result"><div class="score ${r.passed ? "" : "no"}">${r.score}<span style="font-size:28px;color:var(--muted)">/${r.total}</span></div><h2>${r.passed ? "Aprovado!" : "Ainda não foi desta vez"}</h2><p class="muted">${pct}% de acertos · mínimo ${C.passPercent}%</p></div>`
      + (r.passed ? `<div class="cert"><div class="k">Grupo Vega · Treinamento de motoristas</div><h3>${esc(S.name)}</h3><p>concluiu os cinco módulos e foi aprovado na prova de conhecimento</p><p><b>${r.score} de ${r.total}</b> · ${new Date().toLocaleDateString("pt-BR")}</p></div>`
                 : `<p class="muted">Questões erradas: ${r.wrong.map(id => S.quiz.findIndex(q => q.id === id) + 1).join(", ")}. Revise os módulos e tente de novo.</p>`)
      + `<button class="btn ghost" id="b-back">Voltar aos módulos</button>` + (r.passed ? "" : `<button class="btn" id="b-again">Tentar de novo</button>`);
    $("#quiz-body").classList.add("hidden"); res.classList.remove("hidden"); window.scrollTo(0, 0);
    $("#b-back").onclick = home; const ag = $("#b-again"); if (ag) ag.onclick = () => { res.classList.add("hidden"); startQuiz(); };
  }

  // ---------- util / eventos ----------
  let tt; function toast(msg) { let t = document.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); } t.textContent = msg; t.style.display = "block"; clearTimeout(tt); tt = setTimeout(() => t.style.display = "none", 2800); }
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => { document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t)); $("#f-login").classList.toggle("hidden", t.dataset.tab !== "login"); $("#f-reg").classList.toggle("hidden", t.dataset.tab !== "reg"); });
  $("#f-login").onsubmit = login; $("#f-reg").onsubmit = register;
  $("#b-logout").onclick = logout; $("#b-home").onclick = () => { clearInterval(S.tick); logAndMove(0); }; $("#b-home2").onclick = home;
  $("#b-prev").onclick = () => logAndMove(-1); $("#b-next").onclick = () => logAndMove(1); $("#b-start-quiz").onclick = startQuiz;
  window.addEventListener("resize", () => { if (!$("#v-module").classList.contains("hidden")) fitStage(); });

  (async () => { const { data: { session } } = await sb.auth.getSession(); if (session) await enter(); else { loading(false); show("v-login"); } })();
})();
