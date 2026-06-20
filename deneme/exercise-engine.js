/* =====================================================================
   exercise-engine.js
   Gitar Akademisi — ortak "Klavye tipi" egzersiz motoru.

   Bu dosya Klavye, Bas Gitar gibi "klavye üzerinde perde/tel göster,
   doğru notayı mini-portede seçtir" tipindeki tüm egzersiz sayfaları
   için ORTAK mantığı içerir. Her sayfa (örn. /bas/index.html) sadece
   küçük bir config objesiyle ExerciseEngine.init(...) çağırır.

   NOT: "Nota Okuma" / "Tel Egzersizi" sayfaları farklı bir soru-cevap
   yönü kullanıyorsa (porte soru, metin cevap gibi) bu motor onlar için
   henüz uygun değildir — ayrı bir mod eklenecektir.
   ===================================================================== */
(function (global) {
  'use strict';

  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  const ALL_NOTE_NAMES = ['Mi', 'Fa', 'Sol', 'La', 'Si', 'Do', 'Re'];

  function shuffle(a) { return [...a].sort(() => Math.random() - 0.5); }

  function init(rootEl, cfg) {
    const config = Object.assign({
      title: 'Egzersiz',
      clef: 'treble',            // 'treble' | 'bass'
      numStrings: 6,
      maxFret: 4,                 // klavyede gösterilecek en yüksek perde
      notes: [],                  // [{string, fret, name, freq, key}]
      homeUrl: 'https://gitar.yunusgedik.com.tr/',
      totalQuestions: 12,
      raceSeconds: 40,
      sessionStorageKey: 'gitar_session',
      requireSession: true,
    }, cfg);

    // ---- Oturum kontrolü (klavye/bas/tel ortak güvenlik) ----
    if (config.requireSession) {
      const sid = localStorage.getItem(config.sessionStorageKey);
      if (!sid) { global.location.href = config.homeUrl; return; }
    }

    rootEl.innerHTML = buildSkeleton(config);
    const dom = collectDom(rootEl);

    const state = {
      config,
      selectedStrings: new Set(Array.from({ length: config.numStrings }, (_, i) => i + 1)),
      filteredNotes: [...config.notes],
      mode: 'practice',
      gameTimer: null,
      timeLeft: config.raceSeconds,
      audioCtx: null,
      questions: [],
      currentIndex: 0,
      current: null,
      answered: false,
      interacted: false,
      correctCount: 0,
      wrongCount: 0,
      startTime: null,
      timerInterval: null,
    };

    renderFretboardSVG(dom.guitarWrap, config);
    wireSetupScreen(dom, state);
    wireQuizControls(dom, state);
  }

  // ---------------------------------------------------------------
  // HTML İSKELETİ
  // ---------------------------------------------------------------
  function buildSkeleton(cfg) {
    const stringBtns = Array.from({ length: cfg.numStrings }, (_, i) => {
      const n = i + 1;
      const circled = '①②③④⑤⑥'[i] || n;
      return `<button class="string-btn active string-num-btn" data-string="${n}">${circled}</button>`;
    }).join('');

    return `
      <header>
        <h1>${cfg.title}</h1>
      </header>
      <div id="app-wrap">
        <div id="setup-area" class="filter-card">
          <div style="display:flex; justify-content:flex-end; margin-bottom:0.5rem;">
            <button class="back-to-menu-btn" id="home-btn" style="margin-bottom:0;">🏠 Başa Dön</button>
          </div>
          <div class="filter-title">Çalışılacak Telleri Seçin</div>
          <div class="string-buttons">
            <button id="btn-all" class="string-btn all-btn active">Hepsi</button>
            ${stringBtns}
          </div>
          <div class="action-buttons-wrap">
            <button id="start-btn" class="start-exercise-btn">Egzersize Başla (Zamansız) 🎯</button>
            <button id="race-btn" class="start-exercise-btn start-race-btn">Yarışmaya Başla (${cfg.raceSeconds} Saniye) 🏆</button>
          </div>
        </div>

        <div id="quiz-zone" style="display:none;">
          <div style="display:flex; justify-content:flex-start; align-items:center; margin-bottom:0.85rem;">
            <button class="back-to-menu-btn" id="menu-btn" style="margin-bottom:0;">← Menüye Dön</button>
          </div>

          <div class="card">
            <div class="card-top">
              <button id="listen-btn">🔊 Dinle</button>
              <div class="timer-badge" id="timer-display" style="display:none;">Kalan Süre: ${cfg.raceSeconds}</div>
            </div>

            <div class="hint-box" id="hint-text">💡 Soruyu incele ve doğru notayı seç</div>

            <div class="guitar-wrap" id="guitar-wrap"></div>

            <div class="choices" id="choices"></div>
            <div id="message">🎵 Doğru cevabı seç ve öğrenmeye devam et!</div>

            <div class="progress-area">
              <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
            </div>

            <div class="controls">
              <button class="ctrl-btn" id="retry-btn">↻ Tekrar</button>
              <button class="ctrl-btn primary" id="next-btn" disabled>Sonraki Soru →</button>
              <button class="ctrl-btn" id="home-btn-2">🏠 Ana Sayfa</button>
            </div>
          </div>
        </div>

        <div id="result-zone" class="result-screen">
          <h2 class="result-title">🎉 Test Tamamlandı!</h2>
          <div class="result-stats">
            <div class="stat-row"><span>Toplam Süre:</span><span class="stat-val" id="res-time">00:00</span></div>
            <div class="stat-row"><span>Doğru Cevap:</span><span class="stat-val correct-val" id="res-correct">0</span></div>
            <div class="stat-row"><span>Yanlış Cevap:</span><span class="stat-val wrong-val" id="res-wrong">0</span></div>
          </div>
          <p style="color:#8b6b4e; font-weight:700; margin-bottom:1.5rem;">Bravo! Ekran görüntüsü al ve grupta paylaş 🎸</p>
        </div>
      </div>`;
  }

  function collectDom(root) {
    const $ = (id) => root.querySelector('#' + id);
    return {
      root,
      setupArea: $('setup-area'), quizZone: $('quiz-zone'), resultZone: $('result-zone'),
      btnAll: $('btn-all'), startBtn: $('start-btn'), raceBtn: $('race-btn'),
      homeBtn: $('home-btn'), homeBtn2: $('home-btn-2'), menuBtn: $('menu-btn'),
      listenBtn: $('listen-btn'), timerDisplay: $('timer-display'), hintText: $('hint-text'),
      guitarWrap: $('guitar-wrap'), choices: $('choices'), message: $('message'),
      progressFill: $('progress-fill'), retryBtn: $('retry-btn'), nextBtn: $('next-btn'),
      resTime: $('res-time'), resCorrect: $('res-correct'), resWrong: $('res-wrong'),
    };
  }

  // ---------------------------------------------------------------
  // KLAVYE (FRETBOARD) SVG — string/fret sayısına göre üretilir
  // ---------------------------------------------------------------
  function renderFretboardSVG(container, cfg) {
    const NUT_X = 112, NUT_W = 8, NUT_TOP = 30, NUT_H = 152;
    const FB_TOP = 32, FB_H = 148;
    const FRET_STEP = 84;
    const fretWireX = (n) => NUT_X + NUT_W + FRET_STEP * n;
    const fretMidX = (n) => {
      if (n === 0) return NUT_X + NUT_W / 2 + 4;
      const left = n === 1 ? (NUT_X + NUT_W) : fretWireX(n - 1);
      return Math.round((left + fretWireX(n)) / 2);
    };
    const lastWire = fretWireX(cfg.maxFret);
    const fbRight = lastWire + 30;
    const fbLeft = 62;
    const fbWidth = fbRight - fbLeft;

    const stringPad = cfg.numStrings <= 4 ? 23 : 18;
    const usable = FB_H - stringPad * 2;
    const step = cfg.numStrings > 1 ? usable / (cfg.numStrings - 1) : 0;
    const stringY = Array.from({ length: cfg.numStrings }, (_, i) => Math.round(FB_TOP + stringPad + step * i));

    const minW = cfg.numStrings <= 4 ? 1.3 : 0.9;
    const maxW = cfg.numStrings <= 4 ? 3.1 : 2.8;
    const colorLight = [232, 208, 154], colorDark = [168, 120, 32];
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const stringStyle = (i) => {
      const t = cfg.numStrings > 1 ? i / (cfg.numStrings - 1) : 0;
      const w = (minW + (maxW - minW) * t).toFixed(2);
      const c = `rgb(${lerp(colorLight[0], colorDark[0], t)},${lerp(colorLight[1], colorDark[1], t)},${lerp(colorLight[2], colorDark[2], t)})`;
      return { w, c };
    };

    const fretWires = Array.from({ length: cfg.maxFret }, (_, i) =>
      `<rect x="${fretWireX(i + 1)}" y="${FB_TOP}" width="4" height="${FB_H}" rx="1" fill="#b0b8b0" opacity="0.85"/>`
    ).join('');

    const fretLabels = Array.from({ length: cfg.maxFret }, (_, i) =>
      `<text x="${fretMidX(i + 1)}" y="24" text-anchor="middle" fill="#8b6b4e" font-size="12" font-weight="700" font-family="Lato,sans-serif">${ROMAN[i + 1]}</text>`
    ).join('');

    const strings = stringY.map((y, i) => {
      const { w, c } = stringStyle(i);
      return `<line x1="70" y1="${y}" x2="${fbRight - 8}" y2="${y}" stroke="${c}" stroke-width="${w}" opacity="0.95"/>`;
    }).join('');

    const badges = stringY.map((y, i) =>
      `<circle cx="93" cy="${y}" r="10" fill="#fff8ef" stroke="#d4a373" stroke-width="1.2"/>
       <text x="93" y="${y + 4}" text-anchor="middle" fill="#5a3e2b" font-size="10" font-weight="700" font-family="Lato,sans-serif">${i + 1}</text>`
    ).join('');

    container.dataset.fretMidX = JSON.stringify(Array.from({ length: cfg.maxFret + 1 }, (_, i) => fretMidX(i)));
    container.dataset.stringY = JSON.stringify(stringY);

    container.innerHTML = `
      <svg id="guitar-svg" viewBox="${fbLeft - 2} 0 ${fbWidth + 4} 210" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="fbGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2a1a0e"/><stop offset="100%" stop-color="#1a0f06"/>
          </linearGradient>
          <linearGradient id="nutGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f0e0b0"/><stop offset="100%" stop-color="#c8a050"/>
          </linearGradient>
          <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect x="${fbLeft}" y="${FB_TOP}" width="${fbWidth}" height="${FB_H}" rx="5" fill="url(#fbGrad)" stroke="#3a2010" stroke-width="1.5"/>
        <rect x="${fbLeft}" y="${FB_TOP}" width="${fbWidth}" height="3" rx="1" fill="#c8a050" opacity="0.5"/>
        <rect x="${fbLeft}" y="${FB_TOP + FB_H - 3}" width="${fbWidth}" height="3" rx="1" fill="#c8a050" opacity="0.5"/>
        <rect x="${NUT_X}" y="${NUT_TOP}" width="${NUT_W}" height="${NUT_H}" rx="2" fill="url(#nutGrad)" stroke="#c0a040" stroke-width="0.8"/>
        ${fretWires}
        ${fretLabels}
        ${strings}
        ${badges}
        <circle id="fret-highlight" cx="0" cy="0" r="14" fill="#f4d03f" stroke="#d4ac0d" stroke-width="2.5" filter="url(#dotGlow)" opacity="0.95" style="display:none;pointer-events:none;"/>
      </svg>`;
  }

  function moveHighlight(container, stringN, fretN) {
    const fretMid = JSON.parse(container.dataset.fretMidX);
    const stringY = JSON.parse(container.dataset.stringY);
    const dot = container.querySelector('#fret-highlight');
    dot.setAttribute('cx', fretMid[fretN]);
    dot.setAttribute('cy', stringY[stringN - 1]);
    dot.style.display = 'block';
  }

  // ---------------------------------------------------------------
  // SETUP EKRANI (tel seçimi + başlat butonları)
  // ---------------------------------------------------------------
  function wireSetupScreen(dom, state) {
    const cfg = state.config;

    dom.homeBtn.onclick = () => { global.location.href = cfg.homeUrl; };
    dom.homeBtn2.onclick = () => { global.location.href = cfg.homeUrl; };

    const numBtns = Array.from(dom.setupArea.querySelectorAll('.string-num-btn'));

    function checkStartButtons() {
      const isZero = state.selectedStrings.size === 0;
      dom.startBtn.disabled = isZero;
      dom.raceBtn.disabled = isZero;
    }

    dom.btnAll.onclick = () => {
      if (state.selectedStrings.size === cfg.numStrings) {
        state.selectedStrings.clear();
        dom.btnAll.classList.remove('active');
        numBtns.forEach(b => b.classList.remove('active'));
      } else {
        state.selectedStrings = new Set(Array.from({ length: cfg.numStrings }, (_, i) => i + 1));
        dom.btnAll.classList.add('active');
        numBtns.forEach(b => b.classList.add('active'));
      }
      checkStartButtons();
    };

    numBtns.forEach(btn => {
      btn.onclick = () => {
        const n = parseInt(btn.dataset.string, 10);
        if (state.selectedStrings.has(n)) { state.selectedStrings.delete(n); btn.classList.remove('active'); }
        else { state.selectedStrings.add(n); btn.classList.add('active'); }
        dom.btnAll.classList.toggle('active', state.selectedStrings.size === cfg.numStrings);
        checkStartButtons();
      };
    });

    dom.startBtn.onclick = () => startExercise(dom, state, 'practice');
    dom.raceBtn.onclick = () => startExercise(dom, state, 'race');
    dom.menuBtn.onclick = () => goBackToMenu(dom, state);
  }

  function startExercise(dom, state, mode) {
    const cfg = state.config;
    state.filteredNotes = cfg.notes.filter(n => state.selectedStrings.has(n.string));
    if (state.filteredNotes.length === 0) return;

    state.mode = mode;
    dom.setupArea.style.display = 'none';
    dom.quizZone.style.display = 'block';
    resetQuiz(dom, state, false);
  }

  function goBackToMenu(dom, state) {
    if (state.gameTimer) { clearInterval(state.gameTimer); state.gameTimer = null; }
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    dom.quizZone.style.display = 'none';
    dom.resultZone.style.display = 'none';
    dom.setupArea.style.display = 'block';
  }

  // ---------------------------------------------------------------
  // QUIZ MANTIĞI
  // ---------------------------------------------------------------
  function wireQuizControls(dom, state) {
    dom.listenBtn.onclick = () => { state.interacted = true; if (state.current) playGuitar(state, state.current.freq); };
    dom.retryBtn.onclick = () => resetQuiz(dom, state, false);
    dom.nextBtn.onclick = () => { if (!dom.nextBtn.disabled) nextQuestion(dom, state); };
  }

  function resetQuiz(dom, state, showSetup) {
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    if (state.gameTimer) { clearInterval(state.gameTimer); state.gameTimer = null; }

    if (showSetup) { goBackToMenu(dom, state); return; }

    dom.quizZone.style.display = 'block';
    dom.resultZone.style.display = 'none';
    state.correctCount = 0; state.wrongCount = 0; state.currentIndex = 0;
    state.answered = false; state.interacted = false;

    const pool = state.filteredNotes.length > 0 ? state.filteredNotes : state.config.notes;
    state.questions = Array.from({ length: state.config.totalQuestions }, () => pool[Math.floor(Math.random() * pool.length)]);
    dom.hintText.innerHTML = '💡 Soruyu incele ve doğru notayı seç';

    if (state.mode === 'race') {
      state.timeLeft = state.config.raceSeconds;
      dom.timerDisplay.textContent = 'Kalan Süre: ' + state.timeLeft;
      dom.timerDisplay.style.display = 'inline-block';
      dom.timerDisplay.classList.add('race-mode');
      startGameTimer(dom, state);
    } else {
      startTimer(dom, state);
    }
    nextQuestion(dom, state);
  }

  function startGameTimer(dom, state) {
    if (state.gameTimer) clearInterval(state.gameTimer);
    state.gameTimer = setInterval(() => {
      state.timeLeft--;
      if (state.timeLeft <= 0) {
        dom.timerDisplay.textContent = 'Süre Bitti!';
        clearInterval(state.gameTimer);
        showFinalResults(dom, state);
      } else {
        dom.timerDisplay.textContent = 'Kalan Süre: ' + state.timeLeft;
      }
    }, 1000);
  }

  function startTimer(dom, state) {
    state.startTime = Date.now();
    if (state.timerInterval) clearInterval(state.timerInterval);
    dom.timerDisplay.style.display = 'inline-block';
    dom.timerDisplay.classList.remove('race-mode');
    dom.timerDisplay.textContent = 'Süre: 00:00';
    state.timerInterval = setInterval(() => {
      const s = Math.floor((Date.now() - state.startTime) / 1000);
      dom.timerDisplay.textContent = 'Süre: ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
  }

  function nextQuestion(dom, state) {
    state.answered = false;
    if (document.activeElement) document.activeElement.blur();
    dom.message.textContent = '🎵 Doğru cevabı seç ve öğrenmeye devam et!';
    dom.message.style.color = '#8b6b4e';
    dom.nextBtn.disabled = true;

    if (state.mode !== 'race' && state.currentIndex >= state.config.totalQuestions) {
      showFinalResults(dom, state); return;
    }

    if (state.mode === 'race') {
      const pool = state.filteredNotes.length > 0 ? state.filteredNotes : state.config.notes;
      state.current = pool[Math.floor(Math.random() * pool.length)];
    } else {
      state.current = state.questions[state.currentIndex];
    }

    moveHighlight(dom.guitarWrap, state.current.string, state.current.fret);
    dom.hintText.innerHTML = `💡 <span class="hint-string-badge">${state.current.string}</span> . Tel – <span class="hint-fret-text">${state.current.fret === 0 ? 'Boş Tel' : ROMAN[state.current.fret] + '. Perde'}</span>`;

    const wrongs = shuffle(ALL_NOTE_NAMES.filter(n => n !== state.current.name)).slice(0, 3);
    const wrongNotes = wrongs.map(n => state.config.notes.find(note => note.name === n) || state.config.notes.find(note => note.name !== state.current.name));
    const choices = shuffle([state.current, ...wrongNotes]);

    dom.choices.innerHTML = '';
    choices.forEach(noteObj => {
      const card = document.createElement('div');
      card.className = 'choice-card';
      card.dataset.choice = noteObj.name;
      card.onclick = () => selectChoice(dom, state, card, noteObj.name);
      const staffDiv = document.createElement('div');
      staffDiv.className = 'choice-staff';
      card.appendChild(staffDiv);
      dom.choices.appendChild(card);
      drawMiniStaff(staffDiv, noteObj, state.config.clef);
    });

    if (state.mode !== 'race') {
      dom.progressFill.style.width = (state.currentIndex / state.config.totalQuestions * 100) + '%';
    }
    if (state.interacted) setTimeout(() => playGuitar(state, state.current.freq), 300);
  }

  function selectChoice(dom, state, card, choiceName) {
    if (state.answered) return;
    state.answered = true; state.interacted = true;

    const correct = choiceName === state.current.name;
    Array.from(dom.choices.children).forEach(c => {
      c.classList.add('locked');
      if (c.dataset.choice === state.current.name) c.classList.add('correct');
      else if (c === card) c.classList.add('wrong');
    });

    if (correct) {
      state.correctCount++;
      dom.message.textContent = '✓ Doğru!';
      dom.message.style.color = '#3b6d11';
      playGuitar(state, state.current.freq);
    } else {
      state.wrongCount++;
      dom.message.textContent = '✗ Yanlış — Doğrusu: ' + state.current.name;
      dom.message.style.color = '#a32d2d';
    }

    dom.nextBtn.disabled = false;
    if (state.mode !== 'race') state.currentIndex++;
  }

  function showFinalResults(dom, state) {
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    if (state.gameTimer) { clearInterval(state.gameTimer); state.gameTimer = null; }
    dom.quizZone.style.display = 'none';
    dom.resultZone.style.display = 'block';

    if (state.mode === 'race') {
      dom.resTime.textContent = (state.config.raceSeconds - state.timeLeft) + ' sn';
    } else {
      const s = Math.floor((Date.now() - state.startTime) / 1000);
      const mins = Math.floor(s / 60), secs = s % 60;
      dom.resTime.textContent = mins > 0 ? `${mins} dk ${secs} sn` : `${secs} sn`;
    }
    dom.resCorrect.textContent = state.correctCount;
    dom.resWrong.textContent = state.wrongCount;
  }

  // ---------------------------------------------------------------
  // NOTA (VexFlow) + SES
  // ---------------------------------------------------------------
  function drawMiniStaff(div, noteObj, clef) {
    div.innerHTML = '';
    try {
      const { Renderer, Stave, StaveNote, Voice, Formatter } = Vex.Flow;
      const renderer = new Renderer(div, Renderer.Backends.SVG);
      renderer.resize(110, 115);
      const ctx = renderer.getContext();
      const stave = new Stave(0, -10, 110);
      stave.addClef(clef).setContext(ctx).draw();
      const note = new StaveNote({ keys: [noteObj.key], duration: 'w', clef });
      const voice = new Voice({ num_beats: 4, beat_value: 4 });
      voice.addTickables([note]);
      new Formatter().joinVoices([voice]).format([voice], 60);
      voice.draw(ctx, stave);
    } catch (e) { console.error('Nota çizilemedi:', e); }
  }

  function getAudio(state) {
    if (!state.audioCtx) state.audioCtx = new (global.AudioContext || global.webkitAudioContext)();
    return state.audioCtx;
  }

  function playGuitar(state, freq) {
    try {
      const ctx = getAudio(state);
      if (ctx.state === 'suspended') ctx.resume();
      const master = ctx.createGain();
      const now = ctx.currentTime;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(0.55, now + 0.006);
      master.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
      master.connect(ctx.destination);
      [[1, 0.5], [2, 0.28], [3, 0.12], [4, 0.06]].forEach(([m, v]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq * m; g.gain.value = v;
        o.connect(g); g.connect(master); o.start(now); o.stop(now + 2.2);
      });
    } catch (e) { /* ses motoru desteklenmiyor olabilir */ }
  }

  global.ExerciseEngine = { init };
})(window);
