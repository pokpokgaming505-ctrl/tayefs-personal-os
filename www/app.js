const STORAGE_KEY = "northstar-life-os-v1";
const views = { dashboard: "Dashboard", health: "Health & fitness", study: "Study room", build: "Build & create", library: "Ideas & library", review: "Weekly review" };
const themeClasses = ["theme-focus", "theme-simple", "theme-creator"];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const nowDateKey = localDateKey();
const starterData = () => ({
  version: 1,
  settings: { theme: "focus" },
  tasks: [
    { id: uid(), title: "Finish one science lesson", area: "STUDY", date: nowDateKey, done: false, starter: true },
    { id: uid(), title: "Move your body", area: "HEALTH", date: nowDateKey, done: false, starter: true },
    { id: uid(), title: "Build a small tech idea", area: "CREATE", date: nowDateKey, done: false, starter: true }
  ],
  health: [], study: [],
  projects: [],
  books: [
    { id: uid(), title: "Atomic Habits", author: "James Clear", status: "Queue", starter: true },
    { id: uid(), title: "The 48 Laws of Power", author: "Robert Greene", status: "Queue", starter: true }
  ],
  notes: [], reviews: {}
});
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === 1) return { ...starterData(), ...saved, settings: { theme: "focus", ...saved.settings } };
  } catch (error) { console.warn("Could not read saved Northstar data.", error); }
  return starterData();
}
let state = loadState();
let activeView = "dashboard";
let timerSeconds = 25 * 60;
let timerInterval = null;
let installPrompt = null;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { toast("Could not save. Export a backup and check browser storage.", true); }
}
function esc(value = "") { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]); }
function fmtDate(key) {
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en", { month:"short", day:"numeric" });
}
function bookMark(title) { return String(title).split(/\s+/).slice(0,3).map(esc).join("<br>"); }
function weekStartKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(d);
}
function daysBetween(startKey, count = 7) {
  const [y,m,d] = startKey.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => { const day = new Date(y,m-1,d+i); return { key: localDateKey(day), label: day.toLocaleDateString("en", { weekday:"short" }).slice(0,1) }; });
}
function todayEntries(list) { return list.filter(item => item.date === nowDateKey); }
function totalMinutes(list) { return list.reduce((sum,item) => sum + (Number(item.minutes)||0), 0); }
function minsLabel(value) { const h = Math.floor(value/60), m = value%60; return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m} min`; }
function pageHeading(eyebrow, title, description, meta = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div>${meta ? `<div class="heading-meta">${meta}</div>` : ""}</div>`;
}
function cardHead(title, sub = "", action = "") {
  return `<div class="card-head"><div><div class="card-title">${title}</div>${sub ? `<div class="card-sub" style="margin-top:4px">${sub}</div>` : ""}</div>${action}</div>`;
}
function emptyState(title, copy) { return `<div class="empty-state"><strong>${title}</strong>${copy}</div>`; }
function blankButton(label, action, style = "") { return `<button class="button ${style}" data-action="${action}">${label}</button>`; }
function taskRows(tasks, includeDate = false) {
  if (!tasks.length) return emptyState("Nothing on your list yet", "Add one small next step and start there.");
  return `<div class="mission-list">${tasks.map(task => `<label class="mission ${task.done ? "done" : ""}"><input class="check" type="checkbox" data-task="${esc(task.id)}" ${task.done ? "checked" : ""} aria-label="Mark ${esc(task.title)} complete"><span class="mission-copy"><strong>${esc(task.title)}</strong><small>${task.starter ? "Suggested starter · edit or remove anytime" : esc(task.area || "PERSONAL")}${includeDate ? ` · ${fmtDate(task.date)}` : ""}</small></span><span class="mission-area">${esc(task.area || "PERSONAL")}</span><button type="button" class="icon-action" data-delete-task="${esc(task.id)}" aria-label="Remove task" title="Remove task">×</button></label>`).join("")}</div>`;
}
function miniWeekBars(list, property = "minutes") {
  const days = daysBetween(weekStartKey());
  const values = days.map(d => list.filter(x => x.date === d.key).reduce((n,x) => n + (Number(x[property])||0), 0));
  const max = Math.max(1, ...values);
  return `<div class="week-bars">${days.map((d,i) => `<div class="bar-col"><div class="bar ${values[i] ? "active" : ""}" style="height:${Math.max(values[i] ? 12 : 2, values[i]/max*73)}%" title="${values[i]}"></div><span>${d.label}</span></div>`).join("")}</div>`;
}
function dashboardView() {
  const tasks = state.tasks.filter(t => t.date === nowDateKey);
  const todayHealth = todayEntries(state.health);
  const movement = totalMinutes(todayHealth.filter(x => x.kind === "movement"));
  const studyMinutes = totalMinutes(todayEntries(state.study));
  const activeProjects = state.projects.filter(p => p.status !== "Done").length;
  const done = tasks.filter(t => t.done).length;
  const percent = tasks.length ? Math.round(done/tasks.length*100) : 0;
  const books = state.books.slice(0,2);
  const welcome = new Date().getHours() < 12 ? "Good morning, builder." : new Date().getHours() < 18 ? "Good afternoon, builder." : "Good evening, builder.";
  return `${pageHeading("YOUR LIFE, MOVING FORWARD", welcome, "আজকের ছোট পদক্ষেপগুলোই তোমার বড় লক্ষ্যকে কাছে আনবে।", `${new Date().toLocaleDateString("en",{weekday:"long"}).toUpperCase()} · WEEK ${Math.ceil((new Date().getDate()+6)/7)}`)}
  <div class="dashboard-grid"><div class="stack">
    <section class="card hero-card"><p class="eyebrow">YOUR NORTH STAR · THE LONG GAME</p><h2>Learn something. Build something. Take care of yourself.</h2><p>তোমার science, technology আর creator লক্ষ্যগুলোকে ছোট, সামলানো যায় এমন দৈনিক পদক্ষেপে এগিয়ে নাও।</p><div class="hero-tags"><span class="tag">SCIENCE STUDENT</span><span class="tag">TECH × CREATOR</span></div></section>
    <div class="metric-grid"><div class="metric"><div class="metric-label"><span>♡</span> MOVEMENT</div><div class="metric-value">${movement}<small> min</small></div><div class="metric-foot">${movement ? "Logged today" : "Ready when you are"}</div></div><div class="metric"><div class="metric-label"><span>▤</span> STUDY</div><div class="metric-value">${studyMinutes}<small> min</small></div><div class="metric-foot">${studyMinutes ? "Focused time today" : "Add a study session"}</div></div><div class="metric"><div class="metric-label"><span>⌘</span> BUILDS</div><div class="metric-value">${activeProjects}</div><div class="metric-foot">Active projects</div></div><div class="metric"><div class="metric-label"><span>✎</span> IDEAS</div><div class="metric-value">${state.notes.length}</div><div class="metric-foot">Notes captured</div></div></div>
    <section class="card">${cardHead("Today's small wins", `${done} of ${tasks.length} complete · progress at your pace`, `<button class="button small" data-action="add-task">+ Add task</button>`)}${taskRows(tasks)}<div style="margin-top:14px"><div class="progress-line"><i style="width:${percent}%"></i></div><div class="progress-foot"><span>DAILY PROGRESS</span><strong>${percent}%</strong></div></div></section>
    <div class="section-grid"><section class="card">${cardHead("Movement this week","Only track what feels useful.")} ${miniWeekBars(state.health.filter(x=>x.kind==="movement"))}<div class="bar-caption">${minsLabel(totalMinutes(state.health.filter(x=>x.kind==="movement" && x.date >= weekStartKey())))} logged this week</div></section><section class="card">${cardHead("A thought to keep","Field notes from what you read.")}<p class="quote">Build a system that makes the next good action easier to begin.<small>YOUR PERSONAL OS · KEEP WHAT WORKS</small></p></section></div>
  </div><div class="stack side-stack">
    <section class="card">${cardHead("Today's balance","A gentle snapshot, no scores to chase.")}<div class="ring-wrap"><div class="ring" style="--ring:${percent}%"><span>${percent}%</span></div><div class="ring-copy"><strong>${tasks.length ? (percent === 100 ? "All done for today" : "One step at a time") : "Make room for what matters"}</strong><small>${tasks.length ? `${tasks.length-done} next step${tasks.length-done===1?"":"s"} left on your list.` : "Add a mission, or keep today open."}</small></div></div></section>
    <section class="card">${cardHead("Focus session","A quiet 25-minute block.",`<span class="badge">25 / 5</span>`)}<div class="focus-box"><div class="focus-top"><span>PERSONAL FOCUS</span><span>◉</span></div><div class="timer" id="focus-timer">25:00</div><div class="focus-controls"><button class="button small" id="timer-toggle">Start focus</button><button class="button secondary small" id="timer-reset">Reset</button></div></div></section>
    <section class="card">${cardHead("On your bookshelf","A place to keep curious questions.",`<button class="text-action" data-view-link="library">Open library ↗</button>`)}${books.length ? books.map((book,i)=>`<div class="book-row" style="${i?"margin-top:13px":""}"><div class="book-cover ${i?"green":""}">${bookMark(book.title)}</div><div class="book-copy"><strong>${esc(book.title)}</strong><small>${esc(book.author||"Author not added")} · ${esc(book.status)}</small></div></div>`).join("") : emptyState("Your reading list is open", "Add a book or idea in your library.")}</section>
    <section class="card">${cardHead("Your direction","A compass, not a deadline.",`<span class="badge accent">4 YEAR VIEW</span>`)}<div class="ring-copy"><strong>Learn → Build → Share</strong><small>IT skills · strong foundations · useful work · your own voice</small></div></section>
  </div></div>`;
}
function healthView() {
  const movement = state.health.filter(x=>x.kind==="movement").sort((a,b)=>b.date.localeCompare(a.date));
  const sleep = state.health.filter(x=>x.kind==="sleep").sort((a,b)=>b.date.localeCompare(a.date));
  const todayMove = totalMinutes(todayEntries(movement));
  const latestSleep = todayEntries(sleep)[0];
  return `${pageHeading("CARE FOR YOUR ENERGY","Health & fitness","শরীরের যত্ন নাও—নিজের জন্য অর্থবহ জিনিসগুলোই নথিবদ্ধ করো।",`${todayMove} MIN MOVEMENT TODAY`)}
  <div class="section-grid"><section class="form-card"><h2>Log movement</h2><p>Gym, walking, sport, stretching—তুমি যা করেছো সেটাই লেখো। কোনো লক্ষ্য বাধ্যতামূলক নয়।</p><form id="movement-form"><div class="field-grid"><div class="field"><label for="movement-type">Activity</label><select id="movement-type" name="activity"><option>Gym</option><option>Walk</option><option>Sport</option><option>Stretching</option><option>Other</option></select></div><div class="field"><label for="movement-minutes">Minutes</label><input id="movement-minutes" name="minutes" type="number" min="1" max="600" placeholder="30" required></div></div><div class="field"><label for="movement-note">Note (optional)</label><input id="movement-note" name="note" maxlength="120" placeholder="How did it feel?"></div><button class="button" type="submit">Save movement</button></form></section>
  <section class="form-card"><h2>Log rest</h2><p>ঘুম বা বিশ্রামের একটি সহজ নোট রাখো। এটি ব্যক্তিগত; ডেটা শুধু এই ব্রাউজারে থাকে।</p><form id="sleep-form"><div class="field"><label for="sleep-hours">Last night's sleep (hours)</label><input id="sleep-hours" name="hours" type="number" min="0" max="24" step="0.5" placeholder="8" required></div><div class="field"><label for="sleep-note">Optional note</label><input id="sleep-note" name="note" maxlength="120" placeholder="Rested, busy night, etc."></div><button class="button" type="submit">Save rest note</button>${latestSleep?`<div class="field-help" style="margin-top:9px">Today: ${latestSleep.hours} hours logged.</div>`:""}</form></section></div>
  <section class="card" style="margin-top:13px">${cardHead("Movement log","Your recent activity, without a score.",`<span class="badge">${movement.length} ENTRIES</span>`)}${movement.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>DATE</th><th>ACTIVITY</th><th>TIME</th><th>NOTE</th></tr></thead><tbody>${movement.slice(0,12).map(x=>`<tr><td>${fmtDate(x.date)}</td><td><strong>${esc(x.activity)}</strong></td><td>${x.minutes} min</td><td>${esc(x.note||"—")}</td></tr>`).join("")}</tbody></table></div>`:emptyState("Your movement log is empty","When you want, add a walk, workout, or any movement that felt good.")}</section>
  <section class="card" style="margin-top:13px">${cardHead("Rest notes","A private record, not a target.",`<span class="badge">${sleep.length} ENTRIES</span>`)}${sleep.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>DATE</th><th>SLEEP</th><th>NOTE</th></tr></thead><tbody>${sleep.slice(0,8).map(x=>`<tr><td>${fmtDate(x.date)}</td><td><strong>${x.hours} hours</strong></td><td>${esc(x.note||"—")}</td></tr>`).join("")}</tbody></table></div>`:emptyState("No rest notes yet","You can add one when tracking sleep feels helpful.")}</section>`;
}
function studyView() {
  const records = state.study.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const today = totalMinutes(todayEntries(state.study));
  const bySubject = Object.entries(state.study.reduce((acc,x)=>{acc[x.subject]=(acc[x.subject]||0)+(Number(x.minutes)||0);return acc;},{})).sort((a,b)=>b[1]-a[1]);
  return `${pageHeading("LEARN WITH INTENTION","Study room","বিজ্ঞান ও অন্য বিষয়গুলো ছোট focused session-এ ভাগ করে শেখো।",`${minsLabel(today)} TODAY`)}
  <div class="dashboard-grid"><div class="stack"><section class="form-card"><h2>Log a study session</h2><p>পড়ার সময়টা নথিবদ্ধ করো—তারপর চাইলে কোন বিষয়টা এগোল সেটাও যোগ করো।</p><form id="study-form"><div class="field-grid"><div class="field"><label for="study-subject">Subject</label><input id="study-subject" name="subject" maxlength="60" placeholder="Physics, Chemistry, English…" required></div><div class="field"><label for="study-minutes">Focused minutes</label><input id="study-minutes" name="minutes" type="number" min="1" max="720" placeholder="45" required></div></div><div class="field"><label for="study-note">What did you cover? (optional)</label><input id="study-note" name="note" maxlength="140" placeholder="Chapter, problem set, or takeaway"></div><button class="button" type="submit">Save study session</button></form></section>
  <section class="card">${cardHead("Recent study sessions","A record of showing up.",`<span class="badge">${records.length} SESSIONS</span>`)}${records.length?`<div class="list-stack">${records.slice(0,10).map(x=>`<article class="item-card"><div class="item-main"><h3>${esc(x.subject)}</h3><p>${esc(x.note||"Focused study time")}</p><div class="item-meta"><span class="badge accent">${x.minutes} MIN</span><span class="badge">${fmtDate(x.date)}</span></div></div><button class="icon-action" data-delete="study" data-id="${esc(x.id)}" aria-label="Delete study session">×</button></article>`).join("")}</div>`:emptyState("Your study log starts with one session","Try a focused block, then note what you learned.")}</section></div>
  <div class="stack"><section class="card">${cardHead("This week's study","Keep a steady rhythm.")} ${miniWeekBars(state.study)}<div class="bar-caption">${minsLabel(totalMinutes(state.study.filter(x=>x.date>=weekStartKey())))} logged since Monday</div></section><section class="card">${cardHead("Subjects in rotation","Based on your logged sessions.")} ${bySubject.length?`<div class="list-stack">${bySubject.slice(0,6).map(([name,mins])=>`<div class="habit-row"><strong>${esc(name)}</strong><span class="badge">${minsLabel(mins)}</span></div>`).join("")}</div>`:emptyState("Your subjects will show here","Log a session to begin.")}</section><div class="callout"><strong>Small reminder</strong><br>Study to understand one thing clearly. Your plan can change as you learn more about yourself.</div></div></div>`;
}
function buildView() {
  const projects = state.projects.slice().sort((a,b)=>b.created.localeCompare(a.created));
  const tasks = state.tasks.filter(t=>t.area==="CREATE"||t.area==="BRAND");
  return `${pageHeading("MAKE IDEAS REAL","Build & create","Tech projects, Roblox builds, content experiments—keep the next small step visible.",`${projects.length} PROJECT${projects.length===1?"":"S"}`)}
  <div class="button-row" style="margin-bottom:15px">${blankButton("+ New project","add-project")}<button class="button secondary" data-action="add-task">+ Add a build task</button></div>
  <section class="card">${cardHead("Project board","Move each idea forward when you are ready.",`<span class="badge">IDEA → BUILD → DONE</span>`)}${projects.length?`<div class="list-stack">${projects.map(p=>`<article class="item-card"><div class="item-main"><h3>${esc(p.title)}</h3><p>${esc(p.description||"A project in progress.")}</p><div class="item-meta"><span class="badge">${esc(p.category||"PERSONAL")}</span><span class="badge">${fmtDate(p.created)}</span>${p.starter?`<span class="badge">STARTER IDEA</span>`:""}</div></div><div class="item-actions"><select class="status-select" data-project-status="${esc(p.id)}" aria-label="Project status"><option ${p.status==="Idea"?"selected":""}>Idea</option><option ${p.status==="Building"?"selected":""}>Building</option><option ${p.status==="Done"?"selected":""}>Done</option></select><button class="icon-action" data-delete="projects" data-id="${esc(p.id)}" aria-label="Delete project">×</button></div></article>`).join("")}</div>`:emptyState("Every good build starts small","Add a Roblox, technology, automation, or content project when an idea catches your attention.")}</section>
  <div class="section-grid" style="margin-top:13px"><section class="card">${cardHead("Build tasks","Next actions connected to making things.",`<button class="text-action" data-action="add-task">+ Add</button>`)}${tasks.length?taskRows(tasks,true):emptyState("No build tasks yet","Capture the next small action, not the whole project.")}</section><section class="card">${cardHead("A simple business lens","Notice problems before you automate them.",`<span class="badge accent">LEARN</span>`)}<p class="quote">Find a repeated problem. Make the fix simpler. Then let a useful system handle the boring part.<small>ONE QUESTION: WHAT COULD BE MADE EASIER?</small></p></section></div>`;
}
function libraryView() {
  const books = state.books.slice();
  const notes = state.notes.slice().sort((a,b)=>b.created.localeCompare(a.created));
  return `${pageHeading("KEEP YOUR CURIOSITY","Ideas & library","Books, anime, business logic, and out-of-the-box thoughts—all in one place.",`${books.length} BOOKS · ${notes.length} NOTES`)}
  <div class="button-row" style="margin-bottom:15px"><button class="button" data-action="add-book">+ Add a book</button><button class="button secondary" data-action="add-note">+ Capture an idea</button></div>
  <section class="card">${cardHead("Reading shelf","Your list can hold books you want to read, are reading, or finished.",`<span class="badge">${books.length} ITEMS</span>`)}${books.length?`<div class="list-stack">${books.map((b,i)=>`<article class="item-card"><div class="book-cover ${i%2?"green":""}">${bookMark(b.title)}</div><div class="item-main"><h3>${esc(b.title)}</h3><p>${esc(b.author||"Add an author when you like")}</p><div class="item-meta"><span class="badge accent">${esc(b.status)}</span>${b.starter?`<span class="badge">SUGGESTED STARTER</span>`:""}</div></div><div class="item-actions"><select class="status-select" data-book-status="${esc(b.id)}" aria-label="Reading status"><option ${b.status==="Queue"?"selected":""}>Queue</option><option ${b.status==="Reading"?"selected":""}>Reading</option><option ${b.status==="Finished"?"selected":""}>Finished</option></select><button class="icon-action" data-delete="books" data-id="${esc(b.id)}" aria-label="Remove book">×</button></div></article>`).join("")}</div>`:emptyState("Your shelf is ready","Add a book, essay, or topic you want to explore.")}</section>
  <section class="card" style="margin-top:13px">${cardHead("Idea notes","Capture the useful bit while it is fresh.",`<button class="text-action" data-action="add-note">+ New note</button>`)}${notes.length?`<div class="list-stack">${notes.map(n=>`<article class="item-card"><div class="item-main"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="item-meta"><span class="badge">${fmtDate(n.date)}</span><span class="badge">${esc(n.topic||"GENERAL")}</span></div></div><button class="icon-action" data-delete="notes" data-id="${esc(n.id)}" aria-label="Delete note">×</button></article>`).join("")}</div>`:emptyState("Nothing captured yet","Use a short title and write down one idea in your own words.")}</section>`;
}
function reviewView() {
  const week = weekStartKey();
  const weekDays = daysBetween(week);
  const weekStudy = state.study.filter(x=>x.date>=week && x.date<=weekDays[6].key);
  const weekHealth = state.health.filter(x=>x.date>=week && x.date<=weekDays[6].key);
  const weekTasks = state.tasks.filter(x=>x.date>=week && x.date<=weekDays[6].key);
  const weekProjects = state.projects.filter(x=>x.created>=week && x.created<=weekDays[6].key);
  const done = weekTasks.filter(x=>x.done).length;
  const review = state.reviews[week] || { wentWell:"", learned:"", next:"" };
  return `${pageHeading("REFLECT, THEN RESET","Weekly review","কী কাজ করেছে, কী শিখেছো, আর পরের সপ্তাহে কোন ছোট পদক্ষেপ নেবে?",`WEEK OF ${fmtDate(week).toUpperCase()}`)}
  <div class="metric-grid" style="margin-bottom:13px"><div class="metric"><div class="metric-label"><span>▤</span> STUDY</div><div class="metric-value">${minsLabel(totalMinutes(weekStudy))}</div><div class="metric-foot">${weekStudy.length} sessions</div></div><div class="metric"><div class="metric-label"><span>♡</span> MOVEMENT</div><div class="metric-value">${minsLabel(totalMinutes(weekHealth.filter(x=>x.kind==="movement")))}</div><div class="metric-foot">${weekHealth.filter(x=>x.kind==="movement").length} check-ins</div></div><div class="metric"><div class="metric-label"><span>✓</span> MISSIONS</div><div class="metric-value">${done}<small> / ${weekTasks.length}</small></div><div class="metric-foot">completed</div></div><div class="metric"><div class="metric-label"><span>⌘</span> BUILDS</div><div class="metric-value">${weekProjects.length}</div><div class="metric-foot">new projects this week</div></div></div>
  <div class="section-grid"><section class="card">${cardHead("Your week in focus","A gentle picture of your study time.")} ${miniWeekBars(weekStudy)}<div class="bar-caption">${minsLabel(totalMinutes(weekStudy))} total · progress can be quiet</div><div class="divider"></div><div class="callout"><strong>Keep the long view.</strong><br>A week is one small chapter. Notice what gave you energy and what made things harder.</div></section>
  <section class="form-card">${cardHead("A few prompts","Save a private note for your future self.")}<form id="review-form"><div class="field"><label for="review-well">What went well?</label><textarea id="review-well" name="wentWell" maxlength="500" placeholder="A small win, a good question, a moment you showed up…">${esc(review.wentWell)}</textarea></div><div class="field"><label for="review-learned">What did you learn?</label><textarea id="review-learned" name="learned" maxlength="500" placeholder="About a subject, a project, or yourself…">${esc(review.learned)}</textarea></div><div class="field"><label for="review-next">What is one next step?</label><textarea id="review-next" name="next" maxlength="300" placeholder="Keep it small and specific.">${esc(review.next)}</textarea></div><button class="button" type="submit">Save weekly reflection</button></form></section></div>`;
}
const renderers = { dashboard:dashboardView, health:healthView, study:studyView, build:buildView, library:libraryView, review:reviewView };
function render({ focus = false } = {}) {
  $("#page-content").innerHTML = (renderers[activeView] || dashboardView)();
  $("#page-crumb").textContent = views[activeView] || views.dashboard;
  $$('[data-view]').forEach(button => { const selected = button.dataset.view === activeView; button.classList.toggle("active",selected); if (selected) button.setAttribute("aria-current","page"); else button.removeAttribute("aria-current"); });
  if (focus) $("#page-content").focus({ preventScroll:true });
  wireTimerControls();
}
function navigate(view) {
  if (!renderers[view]) return;
  activeView = view;
  render({ focus:true });
  history.replaceState(null,"",`#${view}`);
}
function toast(message, error = false) {
  const region = $("#toast-region");
  const node = document.createElement("div");
  node.className = `toast${error?" error":""}`;
  node.textContent = message;
  region.append(node);
  setTimeout(()=>node.remove(),2800);
}
function showDialog(title, description, fields, submitLabel, onSubmit) {
  const dialog = $("#app-dialog");
  $("#dialog-content").innerHTML = `<h2 class="dialog-title">${title}</h2><p class="dialog-description">${description}</p><form id="modal-form">${fields}<div class="dialog-actions"><button class="button secondary" type="button" data-close-dialog>Cancel</button><button class="button" type="submit">${submitLabel}</button></div></form>`;
  const form = $("#modal-form");
  form.addEventListener("submit", event=>{ event.preventDefault(); const result=onSubmit(new FormData(form)); if (result !== false) { dialog.close(); render(); } });
  $$("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>dialog.close()));
  dialog.showModal();
  $("#dialog-content input")?.focus();
}
const field = (name,label,placeholder,type="text",required=true,extra="") => `<div class="dialog-field"><label for="modal-${name}">${label}</label><input id="modal-${name}" name="${name}" type="${type}" placeholder="${placeholder}" ${required?"required":""} ${extra}></div>`;
const selectField = (name,label,options) => `<div class="dialog-field"><label for="modal-${name}">${label}</label><select id="modal-${name}" name="${name}">${options.map(x=>`<option>${x}</option>`).join("")}</select></div>`;
function addTaskDialog() {
  showDialog("Add a small next step","Keep it clear enough to start.",`${field("title","What needs doing?","e.g. Review one physics concept")}${selectField("area","Area",["STUDY","HEALTH","CREATE","BRAND","PERSONAL"])}`,"Add task",data=>{
    const title=String(data.get("title")||"").trim(); if (!title) return false;
    state.tasks.unshift({id:uid(),title,area:String(data.get("area")),date:nowDateKey,done:false});save();toast("Task added to today.");
  });
}
function addProjectDialog() {
  showDialog("Start a project","A project can begin as an idea; you can change its status as it grows.",`${field("title","Project name","e.g. Roblox obstacle course")}${field("description","What is the idea?","One short description", "text", false)}${selectField("category","Category",["Technology","Roblox","Automation","Content","Personal"])}`,"Create project",data=>{
    const title=String(data.get("title")||"").trim();if(!title)return false;
    state.projects.unshift({id:uid(),title,description:String(data.get("description")||"").trim(),category:String(data.get("category")),status:"Idea",created:nowDateKey});save();toast("Project created.");
  });
}
function addBookDialog() {
  showDialog("Add to your shelf","Books, essays, courses, or topics you want to explore.",`${field("title","Title","e.g. Deep Work")}${field("author","Author or source","Optional", "text", false)}${selectField("status","Reading status",["Queue","Reading","Finished"])}`,"Add to shelf",data=>{
    const title=String(data.get("title")||"").trim();if(!title)return false;
    state.books.unshift({id:uid(),title,author:String(data.get("author")||"").trim(),status:String(data.get("status"))});save();toast("Added to your library.");
  });
}
function addNoteDialog() {
  showDialog("Capture an idea","Write the thought in your own words so you can find it later.",`${field("title","Short title","The idea in a few words")}${selectField("topic","Topic",["BOOKS","BUSINESS","ANIME","TECH","SCIENCE","PERSONAL"])}<div class="dialog-field"><label for="modal-body">Your note</label><textarea id="modal-body" name="body" maxlength="1200" placeholder="What caught your attention?" required></textarea></div>`,"Save note",data=>{
    const title=String(data.get("title")||"").trim(),body=String(data.get("body")||"").trim();if(!title||!body)return false;
    state.notes.unshift({id:uid(),title,body,topic:String(data.get("topic")),date:nowDateKey,created:new Date().toISOString()});save();toast("Idea saved.");
  });
}
function wireTimerControls() {
  const display=$("#focus-timer"); if(!display)return;
  const paint=()=>{display.textContent=`${String(Math.floor(timerSeconds/60)).padStart(2,"0")}:${String(timerSeconds%60).padStart(2,"0")}`;};
  paint();
  const toggle=$("#timer-toggle"),reset=$("#timer-reset");
  toggle?.addEventListener("click",()=>{
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;toggle.textContent="Resume focus";return;}
    toggle.textContent="Pause";
    timerInterval=setInterval(()=>{timerSeconds=Math.max(0,timerSeconds-1);paint();if(timerSeconds===0){clearInterval(timerInterval);timerInterval=null;toggle.textContent="Start focus";timerSeconds=25*60;const record=confirm("Focus session complete. Add 25 minutes to your study log?");if(record){state.study.unshift({id:uid(),subject:"Focus session",minutes:25,date:nowDateKey,note:"Completed with the Northstar focus timer."});save();if(activeView==="dashboard")render();toast("Focus session saved to Study.");}else toast("Focus session complete. Take a short break.");}},1000);
  });
  reset?.addEventListener("click",()=>{clearInterval(timerInterval);timerInterval=null;timerSeconds=25*60;paint();toggle.textContent="Start focus";});
}
function applyTheme(theme) {
  state.settings.theme = themeClasses.includes(`theme-${theme}`) ? theme : "focus";
  document.body.classList.remove(...themeClasses);
  document.body.classList.add(`theme-${state.settings.theme}`);
  $("#theme-select").value=state.settings.theme;
  save();
}
async function exportBackup() {
  const payload={...state,exportedAt:new Date().toISOString()};
  const json=JSON.stringify(payload,null,2), filename=`northstar-backup-${nowDateKey}.json`;
  try {
    if(window.northstarDesktop?.saveBackup){
      const result=await window.northstarDesktop.saveBackup({filename,json});
      if(result?.saved)toast("Backup saved to your chosen location.");
      return;
    }
    const blob=new Blob([json],{type:"application/json"});
    const file=new File([blob],filename,{type:"application/json"});
    if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"Northstar backup"});toast("Backup shared.");return;}
    const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast("Backup downloaded to your device.");
  } catch (error) {
    if(error?.name!=="AbortError")toast("Backup could not be exported.",true);
  }
}
function restoreBackup(file) {
  const reader=new FileReader();
  reader.onload=()=>{try{const incoming=JSON.parse(String(reader.result));if(incoming.version!==1||!Array.isArray(incoming.tasks)||!Array.isArray(incoming.study)||!Array.isArray(incoming.health))throw new Error("Unsupported backup format");state={...starterData(),...incoming,settings:{theme:"focus",...incoming.settings}};save();applyTheme(state.settings.theme);render();toast("Backup restored.");}catch{toast("That backup file could not be read.",true);}};
  reader.readAsText(file);
}
function handleClick(event) {
  const nav=event.target.closest("[data-view]");if(nav){navigate(nav.dataset.view);return;}
  const viewLink=event.target.closest("[data-view-link]");if(viewLink){navigate(viewLink.dataset.viewLink);return;}
  const action=event.target.closest("[data-action]");if(action){switch(action.dataset.action){case"add-task":addTaskDialog();break;case"add-project":addProjectDialog();break;case"add-book":addBookDialog();break;case"add-note":addNoteDialog();break;}return;}
  const deleteButton=event.target.closest("[data-delete]");if(deleteButton){if(!confirm("Remove this item from your local workspace?"))return;const collection=deleteButton.dataset.delete,id=deleteButton.dataset.id;state[collection]=state[collection].filter(x=>x.id!==id);save();render();toast("Item removed.");return;}
  const deleteTask=event.target.closest("[data-delete-task]");if(deleteTask){if(!confirm("Remove this task?"))return;state.tasks=state.tasks.filter(x=>x.id!==deleteTask.dataset.deleteTask);save();render();return;}
}
function handleChange(event) {
  const taskBox=event.target.closest("[data-task]");if(taskBox){const task=state.tasks.find(x=>x.id===taskBox.dataset.task);if(task){task.done=taskBox.checked;save();render();}return;}
  const project=event.target.closest("[data-project-status]");if(project){const item=state.projects.find(x=>x.id===project.dataset.projectStatus);if(item){item.status=project.value;save();toast("Project status updated.");}return;}
  const book=event.target.closest("[data-book-status]");if(book){const item=state.books.find(x=>x.id===book.dataset.bookStatus);if(item){item.status=book.value;save();toast("Reading status updated.");}}
}
function handleSubmit(event) {
  const form=event.target;
  if(form.id==="movement-form"){event.preventDefault();const data=new FormData(form);state.health.unshift({id:uid(),kind:"movement",activity:String(data.get("activity")),minutes:Number(data.get("minutes")),note:String(data.get("note")||"").trim(),date:nowDateKey});save();render();toast("Movement logged.");}
  if(form.id==="sleep-form"){event.preventDefault();const data=new FormData(form);state.health.unshift({id:uid(),kind:"sleep",hours:Number(data.get("hours")),note:String(data.get("note")||"").trim(),date:nowDateKey});save();render();toast("Rest note saved.");}
  if(form.id==="study-form"){event.preventDefault();const data=new FormData(form);state.study.unshift({id:uid(),subject:String(data.get("subject")).trim(),minutes:Number(data.get("minutes")),note:String(data.get("note")||"").trim(),date:nowDateKey});save();render();toast("Study session saved.");}
  if(form.id==="review-form"){event.preventDefault();const data=new FormData(form);state.reviews[weekStartKey()]={wentWell:String(data.get("wentWell")||""),learned:String(data.get("learned")||""),next:String(data.get("next")||"")};save();toast("Weekly reflection saved.");}
}
document.addEventListener("click",handleClick);
document.addEventListener("change",handleChange);
document.addEventListener("submit",handleSubmit);
$("#theme-select").addEventListener("change",event=>applyTheme(event.target.value));
$("#export-btn").addEventListener("click",exportBackup);
$("#import-btn").addEventListener("click",()=>$("#import-file").click());
$("#import-file").addEventListener("change",event=>{const file=event.target.files?.[0];if(file)restoreBackup(file);event.target.value="";});
$("#today-chip").textContent=new Date().toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
applyTheme(state.settings.theme);
const requestedView=location.hash.slice(1);if(renderers[requestedView])activeView=requestedView;
render();
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;$("#install-btn").classList.remove("hidden");});
$("#install-btn").addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("#install-btn").classList.add("hidden");});
