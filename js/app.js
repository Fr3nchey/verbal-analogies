// js/app.js
import { DEFAULT_SECONDS_PER_QUESTION, MASKS } from './config.js';
import { $, shuffle, sample, fmt, escapeHtml } from './utils.js';
import { QUESTIONS, WORD_POOL } from './questions.js';

let session = null; // { subset, idx, score, results[], secondsPerQuestion }
let selected = new Set();
let timer = null, time = 0;
let mask = ["bl","br"];

/*** WELCOME / SETTINGS ***/
document.getElementById("startBtn").addEventListener("click", () => {
  const qCountSel = document.getElementById("qCount");
  const qTimeInput = document.getElementById("qTime");
  let count = parseInt(qCountSel.value, 10);
  if (Number.isNaN(count) || count < 1) count = 25;
  if (count > QUESTIONS.length) count = QUESTIONS.length;

  let secondsPerQuestion = parseInt(qTimeInput.value, 10);
  if (Number.isNaN(secondsPerQuestion) || secondsPerQuestion < 5) secondsPerQuestion = DEFAULT_SECONDS_PER_QUESTION;
  if (secondsPerQuestion > 60) secondsPerQuestion = 60;

  startSession(count, secondsPerQuestion);
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  showWelcome();
});

document.getElementById("restartBtn").addEventListener("click", () => {
  const currentCount = session ? session.subset.length : 25;
  const currentTime = session ? session.secondsPerQuestion : DEFAULT_SECONDS_PER_QUESTION;
  startSession(currentCount, currentTime);
});

/*** SESSION MGMT ***/
function startSession(count, secondsPerQuestion){
  const order = shuffle([...Array(QUESTIONS.length).keys()]);
  const subset = order.slice(0, count).map(i => QUESTIONS[i]);
  session = { subset, idx:0, score:0, results:[], secondsPerQuestion };

  // UI switches
  document.getElementById("welcome").classList.add("hidden");
  document.getElementById("quizCard").classList.remove("hidden");
  document.getElementById("results").innerHTML = "";

  // Header
  setProgress(1, subset.length);
  setScore(0);
  setPerQ(secondsPerQuestion);

  render();
}

function showWelcome(){
  clearTimer();
  document.getElementById("welcome").classList.remove("hidden");
  document.getElementById("quizCard").classList.add("hidden");
  document.getElementById("results").innerHTML = "";
  setProgressText("–");
  setScore(0);
  setPerQText("–");
}

/*** QUIZ RENDER ***/
function render(){
  clearTimer();
  selected.clear();
  disable("checkBtn", true);
  disable("nextBtn", true);
  disable("resetBtn", false);
  text("explain", "");
  text("hint", "Select two answers.");

  const q = session.subset[session.idx];
  mask = MASKS[Math.floor(Math.random()*MASKS.length)];

  setProgress(session.idx+1, session.subset.length);
  setScore(session.score);

  // Fill all cells then blank masked ones
  text("tl", q.tl);
  text("tr", q.tr);
  text("bl", q.bl);
  text("br", q.br);
  for(const id of mask){ setQmark(id); }

  // Options: 2 missing + 4 distractors
  const missing = mask.map(id => q[id]);
  const distractors = sample(WORD_POOL, 14, new Set(missing))
    .filter(w => ![q.tl,q.tr,q.bl,q.br].includes(w))
    .slice(0,4);
  const opts = shuffle([...missing, ...distractors]);

  const cont = $("options"); cont.innerHTML = "";
  for(const w of opts){
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = w;
    b.onclick = () => toggle(b,w);
    cont.appendChild(b);
  }

  // Timer
  time = session.secondsPerQuestion;
  setPerQ(time);
  text("timeLeft", `${time}s remaining`);
  bar(time/session.secondsPerQuestion);
  timer = setInterval(tick, 1000);
}

function toggle(btn, w){
  if (btn.classList.contains("correct") || btn.classList.contains("wrong")) return;
  if (selected.has(w)) { selected.delete(w); btn.classList.remove("selected"); }
  else {
    if (selected.size === 2) return;
    selected.add(w); btn.classList.add("selected");
  }
  disable("checkBtn", selected.size !== 2);
}

function check(){ reveal(false); }
function nextQ(){
  session.idx++;
  if (session.idx >= session.subset.length){
    showResults();
  } else {
    render();
  }
}
function resetSel(){
  selected.clear();
  [...$("options").children].forEach(b=>b.classList.remove("selected","correct","wrong"));
  disable("checkBtn", true);
}

/*** REVEAL / TIMER ***/
function reveal(timeoutTriggered){
  clearTimer();
  const q = session.subset[session.idx];
  const must = new Set(mask.map(id => q[id]));
  const chosen = Array.from(selected);
  const correctCount = chosen.filter(w => must.has(w)).length;
  const correct = (!timeoutTriggered && correctCount === 2);

  // decorate options
  [...$("options").children].forEach(btn=>{
    const w = btn.textContent;
    if (must.has(w)) btn.classList.add("correct");
    if (selected.has(w) && !must.has(w)) btn.classList.add("wrong");
    btn.classList.remove("selected");
  });

  // reveal into masked cells
  for(const id of mask){ text(id, q[id]); }

  if (correct) session.score++;
  setScore(session.score);
  text("explain", q.note || "");
  disable("checkBtn", true);
  disable("nextBtn", false);
  disable("resetBtn", true);

  // store result
  session.results.push({
    idx: session.idx+1,
    q,
    mask: [...mask],
    chosen,
    correct,
    timeSpent: session.secondsPerQuestion - time
  });
}

function tick(){
  time--;
  bar(Math.max(0, time/session.secondsPerQuestion));
  setPerQ(Math.max(0, time));
  text("timeLeft", `${Math.max(0,time)}s remaining`);
  if (time <= 0){
    text("hint", "Time’s up. Correct answers shown.");
    reveal(true);
  }
}
function clearTimer(){ if (timer){ clearInterval(timer); timer=null; } }

/*** RESULTS ***/
function showResults(){
  clearTimer();
  const total = session.subset.length;
  const score = session.score;
  const pct = Math.round((score/total)*100);

  const res = document.createElement("div");
  res.id = "results";
  res.innerHTML = `
    <div class="res-card">
      <div class="res-summary">
        <span class="pill">Session complete</span>
        <span class="pill">Score: <b>${score}</b> / ${total}</span>
        <span class="pill">Accuracy: <b>${pct}%</b></span>
        <span class="pill">Per-question time: ${session.secondsPerQuestion}s</span>
      </div>
      <div class="small" style="color:var(--muted); margin-bottom:8px;">
        Correct answers are shown in the grid; <b>Your picks</b> listed in the last column.
      </div>
      <div style="overflow:auto;">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Top (TL → TR)</th>
              <th>Bottom (BL → BR)</th>
              <th>Blank cells</th>
              <th>Result</th>
              <th>Your picks</th>
              <th>Time (s)</th>
            </tr>
          </thead>
          <tbody id="resRows"></tbody>
        </table>
      </div>
      <div class="actions" style="margin-top:12px;">
        <button class="action secondary" id="newSessionBtn">New Session</button>
        <button class="action secondary" id="editSettingsBtn">Edit settings</button>
      </div>
    </div>
  `;
  const resultsRoot = document.getElementById("results");
  resultsRoot.innerHTML = "";
  resultsRoot.appendChild(res);

  const tbody = document.getElementById("resRows");
  tbody.innerHTML = session.results.map(r=>{
    const blankStr = r.mask.join(" & ").toUpperCase();
    const top = `${r.q.tl} → ${r.q.tr}`;
    const bottom = `${r.q.bl} → ${r.q.br}`;
    const pick = (r.chosen.length? r.chosen.join(" + ") : "—");
    const resTxt = r.correct ? `<span class="ok">Correct</span>` : `<span class="bad">Wrong</span>`;
    return `<tr>
      <td>${r.idx}</td>
      <td>${escapeHtml(top)}</td>
      <td>${escapeHtml(bottom)}</td>
      <td>${blankStr}</td>
      <td>${resTxt}</td>
      <td>${escapeHtml(pick)}</td>
      <td>${r.timeSpent}</td>
    </tr>`;
  }).join("");

  // Lock quiz
  ["tl","tr","bl","br"].forEach(id=>$(id).style.opacity=".5");
  $("options").innerHTML = "";
  text("hint", "Session finished. Review your results or start a new one.");
  disable("checkBtn", true); disable("nextBtn", true); disable("resetBtn", true);

  // Wire buttons
  $("newSessionBtn").addEventListener("click", () => {
    startSession(session.subset.length, session.secondsPerQuestion);
  });
  $("editSettingsBtn").addEventListener("click", () => {
    showWelcome();
  });
}

/*** SMALL DOM HELPERS ***/
function setQmark(id){ $(id).innerHTML = `<span class="qmark">?</span>`; }
function text(id, v){ $(id).textContent = v; }
function disable(id, val){ $(id).disabled = !!val; }
function bar(pct){ $("timerBar").style.width = (pct*100) + "%"; }
function setProgress(cur, total){ text("progress", `${cur} / ${total}`); }
function setProgressText(v){ text("progress", v); }
function setScore(v){ text("score", `Score: ${v}`); }
function setPerQ(sec){ text("perQ", `Time: 00:${fmt(sec)}`); }
function setPerQText(v){ text("perQ", `Time: ${v}`); }

/*** QUIZ BUTTON WIRING ***/
$("checkBtn").addEventListener("click", ()=>check());
$("nextBtn").addEventListener("click", ()=>nextQ());
$("resetBtn").addEventListener("click", ()=>resetSel());
