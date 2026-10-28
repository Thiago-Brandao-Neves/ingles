"use strict";

/* ==========================================================================
   Monte a frase — lógica do jogo
   Sumário:
   1. Dados e configurações
   2. Funções auxiliares
   3. Estado do jogo
   4. Início de partida e de rodada
   5. Desenho da tela
   6. Interações (cliques)
   7. Verificação, respostas e avanço
   8. Tela final e melhor pontuação
   ========================================================================== */


/* ==========================================================================
   1. Dados e configurações
   ========================================================================== */

// As 4 formas de cada frase, na ordem em que aparecem na tela.
const FORMS = [
  { id: "aff",    label: "Afirmativa" },
  { id: "neg",    label: "Negativa" },
  { id: "int",    label: "Interrogativa" },
  { id: "negint", label: "Interrogativa negativa" },
];

// As 4 rodadas. Cada uma tem uma frase-base e suas 4 formas.
//   aux:      verbo auxiliar usado nas dicas
//   kind:     "be" (verbo to be) ou "do" (do/does/did)
//   extra:    peças a mais para confundir
//   answers:  respostas aceitas (a primeira é a mostrada em "Ver respostas")
const ROUNDS = [
  {
    title: "Fase 1 · To be, presente",
    tense: "To be · presente",
    aux: "is",
    kind: "be",
    extra: ["are", "am", "do"],
    forms: {
      aff:    { answers: ["she is a teacher"], pt: "Ela é professora." },
      neg:    { answers: ["she is not a teacher", "she isn't a teacher"], pt: "Ela não é professora." },
      int:    { answers: ["is she a teacher"], pt: "Ela é professora?" },
      negint: { answers: ["isn't she a teacher", "is she not a teacher"], pt: "Ela não é professora?" },
    },
  },
  {
    title: "Fase 2 · To be, passado",
    tense: "To be · passado",
    aux: "were",
    kind: "be",
    extra: ["was", "are", "did"],
    forms: {
      aff:    { answers: ["they were at home"], pt: "Eles estavam em casa." },
      neg:    { answers: ["they were not at home", "they weren't at home"], pt: "Eles não estavam em casa." },
      int:    { answers: ["were they at home"], pt: "Eles estavam em casa?" },
      negint: { answers: ["weren't they at home", "were they not at home"], pt: "Eles não estavam em casa?" },
    },
  },
  {
    title: "Fase 3 · Do/does, presente",
    tense: "Do/does · presente",
    aux: "does",
    kind: "do",
    affHint: "Com he/she/it, o verbo ganha -s no presente.",
    extra: ["do", "plays"],
    forms: {
      aff:    { answers: ["he plays football"], pt: "Ele joga futebol." },
      neg:    { answers: ["he does not play football", "he doesn't play football"], pt: "Ele não joga futebol." },
      int:    { answers: ["does he play football"], pt: "Ele joga futebol?" },
      negint: { answers: ["doesn't he play football", "does he not play football"], pt: "Ele não joga futebol?" },
    },
  },
  {
    title: "Fase 4 · Did, passado",
    tense: "Did · passado",
    aux: "did",
    kind: "do",
    affHint: "No passado, use o verbo no passado (-ed).",
    extra: ["do", "watched"],
    forms: {
      aff:    { answers: ["we watched a movie"], pt: "Nós assistimos a um filme." },
      neg:    { answers: ["we did not watch a movie", "we didn't watch a movie"], pt: "Nós não assistimos a um filme." },
      int:    { answers: ["did we watch a movie"], pt: "Nós assistimos a um filme?" },
      negint: { answers: ["didn't we watch a movie", "did we not watch a movie"], pt: "Nós não assistimos a um filme?" },
    },
  },
];

// Pontuação
const POINTS = { max: 10, perWrong: 3, perHint: 2, min: 2 };
const TOTAL_ROWS = ROUNDS.length * FORMS.length;
const MAX_SCORE = TOTAL_ROWS * POINTS.max;

// Chave usada para guardar a melhor pontuação no navegador
const BEST_KEY = "mf-best";


/* ==========================================================================
   2. Funções auxiliares
   ========================================================================== */

const $ = (id) => document.getElementById(id);

// Mostra uma tela ("home", "game" ou "end") e esconde as outras
function showScreen(id) {
  ["home", "game", "end"].forEach((screen) => {
    $(screen).classList.toggle("hide", screen !== id);
  });
  window.scrollTo(0, 0);
}

// Troca o apóstrofo reto pelo tipográfico (isn't -> isn’t)
const prettify = (text) => text.replace(/'/g, "\u2019");

// Deixa o texto comparável: minúsculas, "n't" vira " not", espaços limpos
const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/n't/g, " not")
    .replace(/\s+/g, " ")
    .trim();

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const isQuestion = (formId) => formId === "int" || formId === "negint";
const punctuation = (formId) => (isQuestion(formId) ? "?" : ".");

// Frase completa de uma resposta, com maiúscula e pontuação final
const fullSentence = (answer, formId) =>
  prettify(capitalize(answer)) + punctuation(formId);

// Texto da dica de uma linha, conforme a forma e o tipo de verbo
function hintFor(row) {
  const { aux, kind, affHint } = state.round;

  if (row.formId === "aff") {
    return kind === "be" ? `Sujeito + \u201C${aux}\u201D + complemento.` : affHint;
  }
  if (row.formId === "neg") {
    return kind === "be"
      ? `Coloque \u201Cnot\u201D depois de \u201C${aux}\u201D (ou use ${aux}n\u2019t).`
      : `Use \u201C${aux} not\u201D (ou ${aux}n\u2019t) e deixe o verbo na forma base.`;
  }
  if (row.formId === "int") {
    return kind === "be"
      ? `Inverta: \u201C${aux}\u201D vem antes do sujeito.`
      : `Comece com \u201C${aux}\u201D, depois o sujeito e o verbo na forma base.`;
  }
  return `Comece com \u201C${aux}n\u2019t\u201D, ou use \u201C${aux}\u201D + sujeito + \u201Cnot\u201D.`;
}


/* ==========================================================================
   3. Estado do jogo
   ========================================================================== */

// state.roundIndex  rodada atual (0 a 3)
// state.round       dados da rodada atual
// state.rows        as 4 linhas (uma por forma) da rodada atual
// state.activeRow   linha selecionada
// state.score       pontos acumulados
// state.results     resultado de cada frase, na ordem do jogo: { ok: true/false }
let state = null;

// Monta uma linha: palavras (peças) embaralhadas + estado da resposta
function createRow(round, form) {
  const { answers, pt } = round.forms[form.id];

  const words = [];
  answers.concat([round.extra]).flat().forEach((entry) => {
    entry.split(" ").forEach((word) => {
      if (!words.includes(word)) words.push(word);
    });
  });

  return {
    formId: form.id,
    label: form.label,
    answers,
    pt,
    tiles: shuffle(words.map((word, id) => ({ id, word }))),
    picked: [],     // peças já colocadas na resposta
    wrong: 0,       // tentativas erradas
    usedHint: false,
    done: false,    // linha terminada (certa ou revelada)
    ok: false,      // terminou certa
    error: false,   // última verificação estava errada
  };
}


/* ==========================================================================
   4. Início de partida e de rodada
   ========================================================================== */

function startGame() {
  state = { roundIndex: 0, score: 0, results: [] };
  showScreen("game");
  loadRound();
}

function loadRound() {
  state.round = ROUNDS[state.roundIndex];
  state.rows = FORMS.map((form) => createRow(state.round, form));
  state.activeRow = 0;

  $("phase").textContent = state.round.title;
  $("pts").textContent = `${state.score} pontos`;
  $("barfill").style.width = `${(state.roundIndex / ROUNDS.length) * 100}%`;
  $("tag1").textContent = state.round.tense;
  $("pt").textContent = state.round.forms.aff.pt;

  ["check", "clear", "hint"].forEach((id) => $(id).classList.remove("hide"));
  $("reveal").classList.add("hide");
  $("next").classList.add("hide");
  $("msg").innerHTML = "";

  drawDots("dots");
  render();
}


/* ==========================================================================
   5. Desenho da tela
   ========================================================================== */

// Bolinhas de progresso (uma por frase do jogo todo)
function drawDots(containerId) {
  let html = "";
  for (let k = 0; k < TOTAL_ROWS; k++) {
    const result = state.results[k];
    let cls = result ? (result.ok ? "ok" : "miss") : "";
    const inCurrentRound = Math.floor(k / FORMS.length) === state.roundIndex;
    if (containerId === "dots" && inCurrentRound) cls += " now";
    html += `<span class="${cls}"></span>`;
  }
  $(containerId).innerHTML = html;
}

// HTML de uma linha de resposta
function rowHtml(row, index) {
  let tiles = "";

  if (!row.picked.length && !row.done) {
    const hint = index === state.activeRow ? "Toque nas palavras abaixo" : "Toque aqui para montar";
    tiles = `<span class="ph">${hint}</span>`;
  }

  row.picked.forEach((tile, i) => {
    const text = i === 0 ? capitalize(prettify(tile.word)) : prettify(tile.word);
    tiles += `<button class="tile" data-r="${tile.id}" ${row.done ? "disabled" : ""}>${text}</button>`;
  });
  if (row.picked.length) tiles += `<span class="mark">${punctuation(row.formId)}</span>`;

  let cls = "row";
  if (index === state.activeRow && !row.done) cls += " act";
  if (row.done) cls += row.ok ? " good" : " rev";
  if (row.error) cls += " bad";

  return `
    <div class="${cls}" data-k="${index}">
      <div class="rh"><span class="tag f">${row.label}</span></div>
      <div class="answer">${tiles}</div>
    </div>`;
}

// Desenha as 4 linhas e o banco de peças da linha selecionada
function render() {
  $("rows").innerHTML = state.rows.map(rowHtml).join("");

  const active = state.rows[state.activeRow];
  let bank = "";
  if (!active.done) {
    active.tiles.forEach((tile) => {
      const used = active.picked.includes(tile);
      bank += `<button class="tile${used ? " used" : ""}" data-a="${tile.id}">${prettify(tile.word)}</button>`;
    });
  }
  $("bank").innerHTML = bank;
}


/* ==========================================================================
   6. Interações (cliques)
   ========================================================================== */

const findTile = (row, id) => row.tiles.find((tile) => tile.id === Number(id));

// Clique numa peça do banco: coloca na linha selecionada
$("bank").addEventListener("click", (event) => {
  const button = event.target.closest("[data-a]");
  if (!button) return;

  const row = state.rows[state.activeRow];
  if (row.done) return;

  const tile = findTile(row, button.dataset.a);
  if (!row.picked.includes(tile)) {
    row.picked.push(tile);
    row.error = false;
    render();
  }
});

// Clique numa linha: seleciona; clique numa peça colocada: devolve ao banco
$("rows").addEventListener("click", (event) => {
  const rowEl = event.target.closest(".row");
  if (!rowEl) return;

  const index = Number(rowEl.dataset.k);
  const row = state.rows[index];
  const tileButton = event.target.closest("[data-r]");

  if (tileButton && !row.done) {
    const tile = findTile(row, tileButton.dataset.r);
    row.picked.splice(row.picked.indexOf(tile), 1);
    row.error = false;
  }
  state.activeRow = index;
  render();
});

$("clear").onclick = () => {
  const row = state.rows[state.activeRow];
  if (row.done) return;
  row.picked = [];
  row.error = false;
  render();
};

$("hint").onclick = () => {
  const row = state.rows[state.activeRow];
  if (row.done) {
    $("msg").innerHTML = `<div class="msg info">Essa linha já está pronta. Toque em outra.</div>`;
    return;
  }
  row.usedHint = true;
  $("msg").innerHTML = `<div class="msg info">\uD83D\uDCA1 ${row.label}: ${hintFor(row)}</div>`;
};

$("check").onclick = checkRound;
$("reveal").onclick = revealAnswers;
$("next").onclick = goNext;


/* ==========================================================================
   7. Verificação, respostas e avanço
   ========================================================================== */

// Primeira linha ainda não terminada (ou a atual, se todas terminaram)
function firstOpenRow() {
  const index = state.rows.findIndex((row) => !row.done);
  return index === -1 ? state.activeRow : index;
}

// Se as 4 linhas terminaram, troca os botões pelo "Próxima"
function finishRoundIfDone() {
  if (!state.rows.every((row) => row.done)) return false;

  ["check", "clear", "hint", "reveal"].forEach((id) => $(id).classList.add("hide"));
  $("next").classList.remove("hide");
  $("next").textContent = state.roundIndex === ROUNDS.length - 1 ? "Ver resultado" : "Próxima";
  return true;
}

function saveResult(rowIndex, ok) {
  state.results[state.roundIndex * FORMS.length + rowIndex] = { ok };
}

function checkRound() {
  const openRows = state.rows.filter((row) => !row.done);

  // Todas as linhas abertas precisam ter alguma peça
  const emptyIndex = state.rows.findIndex((row) => !row.done && !row.picked.length);
  if (emptyIndex !== -1) {
    state.activeRow = emptyIndex;
    render();
    $("msg").innerHTML = `<div class="msg info">Monte as 4 frases antes de verificar. Toque numa linha vazia.</div>`;
    return;
  }

  let correct = 0;
  let gained = 0;

  state.rows.forEach((row, index) => {
    if (row.done) return;

    const attempt = normalize(row.picked.map((tile) => tile.word).join(" "));
    const isCorrect = row.answers.some((answer) => normalize(answer) === attempt);

    if (isCorrect) {
      const points = Math.max(
        POINTS.min,
        POINTS.max - POINTS.perWrong * row.wrong - (row.usedHint ? POINTS.perHint : 0)
      );
      state.score += points;
      gained += points;
      correct++;
      row.done = true;
      row.ok = true;
      row.error = false;
      saveResult(index, true);
    } else {
      row.wrong++;
      row.error = true;
    }
  });

  $("pts").textContent = `${state.score} pontos`;
  state.activeRow = firstOpenRow();
  render();
  drawDots("dots");

  if (finishRoundIfDone()) {
    $("msg").innerHTML = `<div class="msg good">\u2705 Rodada completa! +${gained} pontos nesta verificação.</div>`;
    return;
  }

  const prefix = correct ? `${correct} certa(s)! ` : "";
  $("msg").innerHTML =
    `<div class="msg bad">${prefix}Revise as linhas em vermelho: ` +
    `confira a ordem e se faltou algum \u201Cnot\u201D ou auxiliar.</div>`;

  // Depois de 2 erros em alguma linha, libera "Ver respostas"
  if (openRows.some((row) => row.wrong >= 2)) $("reveal").classList.remove("hide");
}

// Preenche as linhas que faltam com a resposta certa (sem pontos)
function revealAnswers() {
  state.rows.forEach((row, index) => {
    if (row.done) return;

    const used = [];
    row.picked = row.answers[0].split(" ").map((word) => {
      const tile = row.tiles.find((t) => t.word === word && !used.includes(t));
      used.push(tile);
      return tile;
    });

    row.done = true;
    row.ok = false;
    row.error = false;
    saveResult(index, false);
  });

  state.activeRow = 0;
  render();
  drawDots("dots");
  finishRoundIfDone();
  $("msg").innerHTML =
    `<div class="msg info">Respostas reveladas. Essas frases ficam marcadas para você revisar no final.</div>`;
}

function goNext() {
  if (state.roundIndex === ROUNDS.length - 1) {
    endGame();
  } else {
    state.roundIndex++;
    loadRound();
  }
}


/* ==========================================================================
   8. Tela final e melhor pontuação
   ========================================================================== */

function endGame() {
  showScreen("end");

  const ratio = state.score / MAX_SCORE;
  $("final").textContent = `${state.score} / ${MAX_SCORE}`;
  $("verdict").textContent =
    ratio >= 0.85 ? "\uD83C\uDFC6 Excelente! Você domina essas estruturas."
    : ratio >= 0.6 ? "\uD83D\uDC4F Bom trabalho! Revise as negativas e interrogativas."
    : "\uD83D\uDCAA Bom começo! Releia a cola rápida e jogue de novo.";

  // Acertos por forma (ex.: "3 de 4 certas")
  $("byform").innerHTML = FORMS.map((form, formIndex) => {
    let right = 0;
    for (let r = 0; r < ROUNDS.length; r++) {
      const result = state.results[r * FORMS.length + formIndex];
      if (result && result.ok) right++;
    }
    return `<div><b>${form.label}</b><br>${right} de ${ROUNDS.length} certas</div>`;
  }).join("");

  drawDots("enddots");
  saveBestScore(state.score);
}

function saveBestScore(score) {
  try {
    const best = Number(localStorage.getItem(BEST_KEY)) || 0;
    if (score > best) localStorage.setItem(BEST_KEY, score);
  } catch (error) {
    // Sem armazenamento disponível: o jogo segue normalmente
  }
}

function showBestScore() {
  try {
    const best = Number(localStorage.getItem(BEST_KEY)) || 0;
    $("best").textContent = best ? `Sua melhor pontuação: ${best} pontos.` : "";
  } catch (error) {
    // Sem armazenamento disponível: não mostra nada
  }
}


/* ==========================================================================
   Início
   ========================================================================== */

$("start").onclick = startGame;
$("again").onclick = () => {
  showScreen("home");
  showBestScore();
};

showBestScore();
