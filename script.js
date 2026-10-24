const EXERCISES = [];

const KEY_SIGNATURES = {
  C: {}, G: { F: "#" }, D: { F: "#", C: "#" }, A: { F: "#", C: "#", G: "#" },
  E: { F: "#", C: "#", G: "#", D: "#" }, B: { F: "#", C: "#", G: "#", D: "#", A: "#" },
  "F#": { F: "#", C: "#", G: "#", D: "#", A: "#", E: "#" },
  "C#": { F: "#", C: "#", G: "#", D: "#", A: "#", E: "#", B: "#" },
  F: { B: "b" }, Bb: { B: "b", E: "b" }, Eb: { B: "b", E: "b", A: "b" },
  Ab: { B: "b", E: "b", A: "b", D: "b" }, Db: { B: "b", E: "b", A: "b", D: "b", G: "b" },
  Gb: { B: "b", E: "b", A: "b", D: "b", G: "b", C: "b" },
  Cb: { B: "b", E: "b", A: "b", D: "b", G: "b", C: "b", F: "b" },
  Am: {}, Em: { F: "#" }, Bm: { F: "#", C: "#" }, Dm: { B: "b" },
  "F#m": { F: "#", C: "#", G: "#" }, "C#m": { F: "#", C: "#", G: "#", D: "#" },
  "G#m": { F: "#", C: "#", G: "#", D: "#", A: "#" }, "D#m": { F: "#", C: "#", G: "#", D: "#", A: "#", E: "#" },
  "A#m": { F: "#", C: "#", G: "#", D: "#", A: "#", E: "#", B: "#" },
  Gm: { B: "b", E: "b" }, Cm: { B: "b", E: "b", A: "b" }, Bbm: { B: "b", E: "b", A: "b", D: "b", G: "b" },
  Ebm: { B: "b", E: "b", A: "b", D: "b", G: "b", C: "b" }, Abm: { B: "b", E: "b", A: "b", D: "b", G: "b", C: "b", F: "b" }
};
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fm", "Gm", "Cm", "Bbm", "Ebm", "Abm"]);

window.registerSightReadingExercise = (exercise) => {
  const normalizedNotes = [];
  let nextStart = 0;

  exercise.notes.forEach((entry) => {
    const note = typeof entry === "number" ? { midi: entry } : entry;
    const start = Number.isFinite(note.start) ? note.start : nextStart;
    const duration = Number.isFinite(note.duration) ? note.duration : 1;
    normalizedNotes.push({ ...note, start, duration });
    nextStart = start + duration;
  });

  const title = exercise.title || `Exercício ${EXERCISES.length + 1}`;
  EXERCISES.push({
    ...exercise,
    title: /^Exercício\b/i.test(title) ? title : `Exercício ${title}`,
    group: exercise.group || "Sem grupo",
    key: exercise.key || "C",
    notes: normalizedNotes
  });
};

const state = {
  currentExerciseIndex: 0,
  currentExercise: null,
  audioContext: null,
  masterGain: null,
  activeOscillators: [],
  volumeLevel: 1.5,
  playbackTimerIds: [],
  playbackFrameId: null,
  playbackStartedAt: 0,
  playbackStartBeat: 0,
  playbackTotalBeats: 0,
  playbackBeatDuration: 0,
  scoreNotePositions: new Map(),
  isPlayingDemo: false,
  exposureTimerId: null,
  exposureFrameId: null,
  exposureStartedAt: 0,
  exposureDurationMs: 10000,
  exposureSeconds: 10,
  playbackBpmOverride: null
};

const ui = {
  groupSelect: document.getElementById("groupSelect"),
  exerciseSelect: document.getElementById("exerciseSelect"),
  repeatBtn: document.getElementById("repeatBtn"),
  nextBtn: document.getElementById("nextBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  exerciseTitle: document.getElementById("exerciseTitle"),
  exerciseName: document.getElementById("exerciseName"),
  statusPill: document.getElementById("statusPill"),
  messageBox: document.getElementById("messageBox"),
  staff: document.getElementById("staff"),
  countdown: document.getElementById("countdown"),
  countdownText: document.getElementById("countdownText"),
  progressTrack: document.getElementById("progressTrack"),
  progressFill: document.getElementById("progressFill"),
  countdownLabel: document.getElementById("countdownLabel"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  modal: document.getElementById("modal"),
  modalText: document.getElementById("modalText"),
  modalRepeatBtn: document.getElementById("modalRepeatBtn"),
  modalNextBtn: document.getElementById("modalNextBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingsForm: document.getElementById("settingsForm"),
  exposureInput: document.getElementById("exposureInput"),
  tempoModeInput: document.getElementById("tempoModeInput"),
  playbackBpmInput: document.getElementById("playbackBpmInput"),
  volumeInput: document.getElementById("volumeInput"),
  volumeValue: document.getElementById("volumeValue"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn")
};

function init() {
  loadExposureSetting();
  attachEvents();
  loadExerciseFiles()
    .then(() => {
      if (EXERCISES.length === 0) throw new Error("Nenhum exercício foi registrado.");
      populateGroupOptions();
      populateExerciseOptions(ui.groupSelect.value);
      setExercise(Number(ui.exerciseSelect.value));
    })
    .catch((error) => {
      console.error("Falha ao carregar exercícios:", error);
      ui.statusPill.textContent = "Erro";
      ui.messageBox.textContent = "Não foi possível carregar os exercícios. Confira os arquivos na pasta exercises.";
    });
}

function loadExerciseFiles() {
  const files = window.SIGHT_READING_EXERCISE_FILES || [];
  return files.reduce((queue, filePath) => queue.then(() => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL(filePath, document.baseURI).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${filePath}`));
    document.head.appendChild(script);
  })), Promise.resolve());
}

function populateGroupOptions() {
  const groups = [...new Set(EXERCISES.map((exercise) => exercise.group))];
  ui.groupSelect.replaceChildren();
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    ui.groupSelect.appendChild(option);
  });
  ui.groupSelect.value = groups[0];
}

function populateExerciseOptions(group) {
  ui.exerciseSelect.replaceChildren();
  EXERCISES.forEach((exercise, index) => {
    if (exercise.group !== group) return;
    const option = document.createElement("option");
    option.value = index;
    option.textContent = `${exercise.title} — ${exercise.name}`;
    ui.exerciseSelect.appendChild(option);
  });
  return ui.exerciseSelect.value;
}

function attachEvents() {
  let resizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.currentExercise) renderScore();
    }, 150);
  });

  ui.groupSelect.addEventListener("change", (event) => {
    const firstExercise = populateExerciseOptions(event.target.value);
    if (firstExercise !== undefined) setExercise(Number(firstExercise), true);
  });

  ui.exerciseSelect.addEventListener("change", (event) => {
    const index = Number(event.target.value);
    setExercise(index, true);
  });

  ui.repeatBtn.addEventListener("click", () => {
    startExerciseFlow();
  });

  ui.nextBtn.addEventListener("click", () => {
    advanceExercise(1);
  });

  ui.modalRepeatBtn.addEventListener("click", () => {
    closeModal();
    startExerciseFlow();
  });

  ui.modalNextBtn.addEventListener("click", () => {
    closeModal();
    advanceExercise(1);
  });

  ui.settingsBtn.addEventListener("click", openSettings);
  ui.cancelSettingsBtn.addEventListener("click", closeSettings);
  ui.tempoModeInput.addEventListener("change", updateTempoInputState);
  ui.volumeInput.addEventListener("input", updateVolumePreview);
  ui.settingsForm.addEventListener("submit", saveSettings);
  ui.fullscreenBtn.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
}

function loadExposureSetting() {
  try {
    const savedValue = Number(window.localStorage.getItem("sightReadingExposureSeconds"));
    if (Number.isInteger(savedValue) && savedValue >= 1 && savedValue <= 60) {
      state.exposureSeconds = savedValue;
    }
  } catch {
    state.exposureSeconds = 10;
  }

  try {
    const savedBpm = Number(window.localStorage.getItem("sightReadingPlaybackBpm"));
    if (Number.isInteger(savedBpm) && savedBpm >= 40 && savedBpm <= 180) {
      state.playbackBpmOverride = savedBpm;
    }
  } catch {
    state.playbackBpmOverride = null;
  }

  try {
    const savedVolume = Number(window.localStorage.getItem("sightReadingVolume"));
    if (Number.isFinite(savedVolume) && savedVolume >= 0.5 && savedVolume <= 2) {
      state.volumeLevel = savedVolume;
    }
  } catch {
    state.volumeLevel = 1.5;
  }
  ui.volumeInput.value = String(Math.round(state.volumeLevel * 100));
  updateVolumePreview();
}

function openSettings() {
  ui.exposureInput.value = String(state.exposureSeconds);
  ui.tempoModeInput.value = state.playbackBpmOverride === null ? "exercise" : "custom";
  ui.playbackBpmInput.value = String(state.playbackBpmOverride ?? 90);
  ui.volumeInput.value = String(Math.round(state.volumeLevel * 100));
  updateVolumePreview();
  updateTempoInputState();
  ui.settingsModal.classList.remove("hidden");
  ui.exposureInput.focus();
}

function updateTempoInputState() {
  ui.playbackBpmInput.disabled = ui.tempoModeInput.value !== "custom";
  ui.playbackBpmInput.required = !ui.playbackBpmInput.disabled;
}

function closeSettings() {
  ui.settingsModal.classList.add("hidden");
}

function saveSettings(event) {
  event.preventDefault();
  const value = Number(ui.exposureInput.value);
  if (!Number.isInteger(value) || value < 1 || value > 60) {
    ui.exposureInput.reportValidity();
    return;
  }

  const customBpm = Number(ui.playbackBpmInput.value);
  if (ui.tempoModeInput.value === "custom" && (!Number.isInteger(customBpm) || customBpm < 40 || customBpm > 180)) {
    ui.playbackBpmInput.reportValidity();
    return;
  }

  state.exposureSeconds = value;
  state.playbackBpmOverride = ui.tempoModeInput.value === "custom" ? customBpm : null;
  state.volumeLevel = Number(ui.volumeInput.value) / 100;
  if (state.masterGain) {
    state.masterGain.gain.setTargetAtTime(state.volumeLevel, state.audioContext.currentTime, 0.025);
  }
  try {
    window.localStorage.setItem("sightReadingExposureSeconds", String(value));
    if (state.playbackBpmOverride === null) {
      window.localStorage.removeItem("sightReadingPlaybackBpm");
    } else {
      window.localStorage.setItem("sightReadingPlaybackBpm", String(state.playbackBpmOverride));
    }
    window.localStorage.setItem("sightReadingVolume", String(state.volumeLevel));
  } catch {
    // A configuração ainda vale nesta sessão, mesmo se o armazenamento estiver indisponível.
  }

  closeSettings();
  if (state.currentExercise) renderScore();
  ui.messageBox.textContent = `Configurações salvas. Volume do piano: ${Math.round(state.volumeLevel * 100)}%.`;
}

function updateVolumePreview() {
  const percent = Number(ui.volumeInput.value);
  ui.volumeValue.textContent = `${percent}%`;
  if (state.masterGain && Number.isFinite(percent)) {
    state.masterGain.gain.setTargetAtTime(percent / 100, state.audioContext.currentTime, 0.025);
  }
  if (Number.isFinite(percent)) state.volumeLevel = percent / 100;
}

async function toggleFullscreen() {
  const appShell = document.querySelector(".app-shell");
  if (appShell.classList.contains("focus-mode")) {
    appShell.classList.remove("focus-mode");
    document.body.classList.remove("focus-mode-active");
    updateFullscreenButton();
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      if (!appShell.requestFullscreen) throw new Error("Fullscreen API indisponível");
      await appShell.requestFullscreen();
    }
  } catch (error) {
    appShell.classList.add("focus-mode");
    document.body.classList.add("focus-mode-active");
  }
  updateFullscreenButton();
}

function updateFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement) || document.querySelector(".app-shell").classList.contains("focus-mode");
  ui.fullscreenBtn.setAttribute("aria-label", isFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia");
  ui.fullscreenBtn.title = isFullscreen ? "Sair da tela cheia" : "Tela cheia";
  ui.fullscreenBtn.querySelector("span:last-child").textContent = isFullscreen ? "Sair" : "Tela cheia";
  ui.fullscreenBtn.querySelector(".button-icon").textContent = isFullscreen ? "⤢" : "⛶";
  if (state.currentExercise) renderScore();
}

function setExercise(index, startImmediately = false) {
  const safeIndex = Math.max(0, Math.min(index, EXERCISES.length - 1));
  state.currentExerciseIndex = safeIndex;
  state.currentExercise = EXERCISES[safeIndex];
  if (!state.currentExercise) return;
  clearPlaybackTimers();
  closeModal();

  ui.groupSelect.value = state.currentExercise.group;
  ui.exerciseSelect.value = String(safeIndex);
  ui.exerciseTitle.textContent = state.currentExercise.title;
  ui.exerciseName.textContent = state.currentExercise.name;
  ui.statusPill.textContent = "Pronto";
  ui.messageBox.textContent = "Toque em uma nota para ouvir a partir daquele ponto, ou use “Repetir” para começar do início.";
  renderScore();
  if (startImmediately) startExerciseFlow();
}

function startExerciseFlow() {
  const exercise = state.currentExercise;
  if (!exercise) return;

  getAudioContext();
  clearPlaybackTimers();
  closeModal();

  const exposureSeconds = state.exposureSeconds;
  ui.statusPill.textContent = "Observe";
  ui.messageBox.textContent = `Observe a partitura. A música começa em ${exposureSeconds} segundos.`;
  ui.countdownLabel.textContent = "Tempo para observar";
  state.exposureStartedAt = performance.now();
  state.exposureDurationMs = exposureSeconds * 1000;
  ui.countdown.hidden = false;
  ui.progressFill.style.width = "0%";
  ui.progressTrack.setAttribute("aria-valuenow", "0");
  updateCountdown();
  state.exposureTimerId = window.setTimeout(() => playExerciseDemo(exercise), state.exposureDurationMs);
}

function updateCountdown() {
  const elapsed = performance.now() - state.exposureStartedAt;
  const progress = Math.min(1, elapsed / state.exposureDurationMs);
  const remainingSeconds = Math.max(0, Math.ceil((state.exposureDurationMs - elapsed) / 1000));

  ui.progressFill.style.width = `${progress * 100}%`;
  ui.progressTrack.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  ui.countdownText.textContent = `${remainingSeconds} s`;

  if (progress < 1) {
    state.exposureFrameId = window.requestAnimationFrame(updateCountdown);
  }
}

function playExerciseDemo(exercise) {
  if (state.exposureFrameId !== null) {
    window.cancelAnimationFrame(state.exposureFrameId);
    state.exposureFrameId = null;
  }
  state.exposureTimerId = null;
  startPlaybackFromBeat(exercise, 0);
}

function startPlaybackFromBeat(exercise, startBeat, triggerAtClick = false) {
  const beatDuration = 60 / getPlaybackBpm(exercise);
  const totalBeats = Math.max(...exercise.notes.map((note) => note.start + note.duration));
  const remainingDuration = Math.max(0, (totalBeats - startBeat) * beatDuration);
  state.playbackStartBeat = startBeat;
  state.playbackTotalBeats = totalBeats;
  state.playbackBeatDuration = beatDuration;
  state.playbackStartedAt = performance.now();
  state.isPlayingDemo = true;
  ui.statusPill.textContent = "Tocando";
  ui.messageBox.textContent = "Escute a melodia. Toque em qualquer nota para voltar àquele ponto.";
  ui.countdown.hidden = false;
  ui.countdownLabel.textContent = "Reprodução";
  updatePlaybackProgress();

  exercise.notes.forEach((note) => {
    if (note.start < startBeat - 0.0001) return;
    if (triggerAtClick && Math.abs(note.start - startBeat) < 0.0001) {
      triggerPianoNote(note.midi, note.duration * beatDuration);
      return;
    }
    const timer = window.setTimeout(() => triggerPianoNote(note.midi, note.duration * beatDuration), (note.start - startBeat) * beatDuration * 1000);
    state.playbackTimerIds.push(timer);
  });

  const endTimer = window.setTimeout(() => {
    state.isPlayingDemo = false;
    state.playbackFrameId = null;
    ui.countdown.hidden = true;
    ui.statusPill.textContent = "Concluído";
    ui.messageBox.textContent = "A audição terminou. Toque em uma nota para retomá-la dali, repita ou escolha o próximo exercício.";
    openModal("A audição terminou. Quer ouvir este exercício novamente ou seguir para o próximo?");
  }, remainingDuration * 1000 + 250);

  state.playbackTimerIds.push(endTimer);
}

function updatePlaybackProgress() {
  if (!state.isPlayingDemo) return;
  const elapsedSeconds = (performance.now() - state.playbackStartedAt) / 1000;
  const currentBeat = Math.min(state.playbackTotalBeats, state.playbackStartBeat + elapsedSeconds / state.playbackBeatDuration);
  const progress = state.playbackTotalBeats > 0 ? currentBeat / state.playbackTotalBeats : 1;
  const remainingSeconds = Math.max(0, Math.ceil((state.playbackTotalBeats - currentBeat) * state.playbackBeatDuration));
  ui.progressFill.style.width = `${progress * 100}%`;
  ui.progressTrack.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  ui.countdownText.textContent = `${remainingSeconds} s`;
  state.playbackFrameId = window.requestAnimationFrame(updatePlaybackProgress);
}

function seekToBeat(beat, triggerAtClick = false) {
  if (!state.currentExercise) return;
  getAudioContext();
  clearPlaybackTimers();
  closeModal();
  startPlaybackFromBeat(state.currentExercise, beat, triggerAtClick);
}

function clearPlaybackTimers() {
  state.playbackTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  state.playbackTimerIds = [];
  if (state.playbackFrameId !== null) {
    window.cancelAnimationFrame(state.playbackFrameId);
    state.playbackFrameId = null;
  }
  stopActiveNotes();
  if (state.exposureTimerId !== null) {
    window.clearTimeout(state.exposureTimerId);
    state.exposureTimerId = null;
  }
  if (state.exposureFrameId !== null) {
    window.cancelAnimationFrame(state.exposureFrameId);
    state.exposureFrameId = null;
  }
  ui.countdown.hidden = true;
  state.isPlayingDemo = false;
}

function stopActiveNotes() {
  state.activeOscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // O oscilador pode já ter terminado naturalmente.
    }
  });
  state.activeOscillators = [];
}

function advanceExercise(offset) {
  if (!state.currentExercise) return;
  const groupIndexes = EXERCISES
    .map((exercise, index) => exercise.group === state.currentExercise.group ? index : -1)
    .filter((index) => index >= 0);
  const currentPosition = groupIndexes.indexOf(state.currentExerciseIndex);
  const nextPosition = (currentPosition + offset + groupIndexes.length) % groupIndexes.length;
  const nextIndex = groupIndexes[nextPosition];
  setExercise(nextIndex, true);
}

function openModal(text) {
  ui.modalText.textContent = text;
  ui.modal.classList.remove("hidden");
}

function closeModal() {
  ui.modal.classList.add("hidden");
}

function renderScore() {
  const exercise = state.currentExercise;
  if (!exercise || !window.ABCJS) {
    ui.staff.textContent = "Não foi possível carregar o renderizador de partituras. Verifique sua conexão com a internet e recarregue a página.";
    return;
  }

  const abc = exerciseToAbc(exercise);
  const compactLayout = window.matchMedia("(max-width: 680px)").matches;
  const staffWidth = Math.max(240, ui.staff.clientWidth - 24);
  window.ABCJS.renderAbc(ui.staff, abc, {
    responsive: "resize",
    staffwidth: compactLayout ? Math.max(620, staffWidth) : 1100,
    scale: compactLayout ? 1.4 : 1.35,
    paddingtop: 12,
    paddingbottom: 12,
    foregroundColor: "#111",
    clickListener: (abcElement) => {
      const startChar = abcElement?.startChar;
      const mappedBeat = state.scoreNotePositions.get(startChar);
      const beat = Number.isFinite(mappedBeat) ? mappedBeat : startChar === 0 ? 0 : null;
      if (Number.isFinite(beat)) seekToBeat(beat, true);
    }
  });
}

function getPlaybackBpm(exercise) {
  return state.playbackBpmOverride ?? exercise.bpm;
}

function exerciseToAbc(exercise) {
  const totalBeats = Math.max(...exercise.notes.map((note) => note.start + note.duration));
  const measureCount = Math.ceil(totalBeats / 4);
  const trebleNotes = exercise.notes.filter((note) => note.hand === "right" || (!note.hand && note.midi >= 60));
  const bassNotes = exercise.notes.filter((note) => note.hand === "left" || (!note.hand && note.midi < 60));

  const header = [
    `X:1`,
    `T:${exercise.name}`,
    `M:4/4`,
    `L:1/4`,
    `Q:1/4=${getPlaybackBpm(exercise)}`,
    `%%score { (treble) | (bass) }`,
    `V:treble clef=treble`,
    `V:bass clef=bass`,
    `K:${exercise.key}`
  ].join("\n");
  const treble = buildVoiceTokens(trebleNotes, measureCount, exercise.key);
  const bass = buildVoiceTokens(bassNotes, measureCount, exercise.key);
  const treblePrefix = "[V:treble] ";
  const bassPrefix = "[V:bass] ";
  const trebleOffset = header.length + 1 + treblePrefix.length;
  const bassOffset = trebleOffset + treble.text.length + 1 + bassPrefix.length;
  state.scoreNotePositions = new Map([
    ...treble.notePositions.map(({ offset, beat }) => [trebleOffset + offset, beat]),
    ...bass.notePositions.map(({ offset, beat }) => [bassOffset + offset, beat])
  ]);
  const firstScoreNote = treble.notePositions[0] || bass.notePositions[0];
  if (firstScoreNote) {
    state.scoreNotePositions.set(0, firstScoreNote.beat);
    state.scoreNotePositions.set(header.length + 1, firstScoreNote.beat);
  }
  return `${header}\n${treblePrefix}${treble.text}\n${bassPrefix}${bass.text}`;
}

function buildVoiceTokens(notes, measureCount, key) {
  const beatsPerMeasure = 4;
  const totalBeats = measureCount * beatsPerMeasure;
  const segments = [];
  let activeNote = null;

  for (let beat = 0; beat < totalBeats - 0.0001;) {
    const noteAtBeat = notes.find((note) => Math.abs(note.start - beat) < 0.0001);
    if (noteAtBeat) activeNote = noteAtBeat;

    const beatsToBarline = beatsPerMeasure - (beat % beatsPerMeasure);
    const soundingNote = activeNote && beat < activeNote.start + activeNote.duration ? activeNote : null;
    const nextNoteStart = notes
      .map((note) => note.start)
      .filter((start) => start > beat + 0.0001)
      .sort((left, right) => left - right)[0];
    const noteRemaining = soundingNote
      ? activeNote.start + activeNote.duration - beat
      : (nextNoteStart ?? totalBeats) - beat;
    const duration = Math.min(noteRemaining, beatsToBarline);
    if (duration <= 0) break;
    const pitch = soundingNote ? abcPitch(soundingNote.midi, key) : "z";
    const tie = soundingNote && beat + duration < activeNote.start + activeNote.duration ? "-" : "";
    segments.push({
      text: `${pitch}${abcLength(duration)}${tie}`,
      start: beat,
      end: beat + duration,
      isNote: Boolean(soundingNote),
      noteStart: soundingNote && Math.abs(beat - soundingNote.start) < 0.0001 ? beat : null
    });
    beat += duration;
    if (Math.abs(beat % beatsPerMeasure) < 0.0001) segments.push({ text: "|", isBarline: true });
  }

  let text = "";
  const notePositions = [];
  let previous = null;
  segments.forEach((segment) => {
    if (text) {
      const pairedEighths = previous?.isNote && segment.isNote
        && Math.abs((previous.end - previous.start) - 0.5) < 0.0001
        && Math.abs((segment.end - segment.start) - 0.5) < 0.0001
        && Math.floor(previous.start) === Math.floor(segment.start);
      text += pairedEighths ? "" : " ";
    }
    const offset = text.length;
    text += segment.text;
    if (segment.noteStart !== null) notePositions.push({ offset, beat: segment.noteStart });
    previous = segment;
  });

  return { text, notePositions };
}

function abcLength(quarterBeats) {
  const eighthUnits = Math.round(quarterBeats * 2);
  if (eighthUnits === 2) return "";
  if (eighthUnits === 1) return "/2";
  if (eighthUnits % 2 === 0) return String(eighthUnits / 2);
  return `${eighthUnits}/2`;
}

function abcPitch(midi, key) {
  const spellings = FLAT_KEYS.has(key)
    ? [["C", ""], ["D", "b"], ["D", ""], ["E", "b"], ["E", ""], ["F", ""], ["G", "b"], ["G", ""], ["A", "b"], ["A", ""], ["B", "b"], ["B", ""]]
    : [["C", ""], ["C", "#"], ["D", ""], ["D", "#"], ["E", ""], ["F", ""], ["F", "#"], ["G", ""], ["G", "#"], ["A", ""], ["A", "#"], ["B", ""]];
  const [letter, accidental] = spellings[midi % 12];
  const keyAlteration = (KEY_SIGNATURES[key] || {})[letter] || "";
  const abcAccidental = accidental === keyAlteration ? "" : accidental === "#" ? "^" : accidental === "b" ? "_" : "=";
  const octave = Math.floor(midi / 12) - 1;
  const pitch = octave >= 5 ? letter.toLowerCase() : letter;
  const octaveMark = octave < 4 ? ",".repeat(4 - octave) : "'".repeat(Math.max(0, octave - 5));

  return `${abcAccidental}${pitch}${octaveMark}`;
}

function triggerPianoNote(midi, durationSeconds) {
  const audioContext = getAudioContext();
  const now = audioContext.currentTime;
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  const partials = [
    { ratio: 1, level: 0.32 },
    { ratio: 2.01, level: 0.11 },
    { ratio: 3.98, level: 0.045 },
    { ratio: 6.02, level: 0.018 }
  ];
  const decayTime = Math.max(0.015, Math.min(0.35, durationSeconds * 0.55));

  partials.forEach(({ ratio, level }) => {
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const partialFrequency = frequency * ratio;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(partialFrequency, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(level, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.16), now + decayTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    oscillator.connect(envelope);
    envelope.connect(state.masterGain);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.01);
    state.activeOscillators.push(oscillator);
    oscillator.addEventListener("ended", () => {
      state.activeOscillators = state.activeOscillators.filter((active) => active !== oscillator);
    }, { once: true });
  });

}

function getAudioContext() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
    const compressor = state.audioContext.createDynamicsCompressor();
    state.masterGain = state.audioContext.createGain();
    state.masterGain.gain.value = state.volumeLevel;
    compressor.threshold.value = -8;
    compressor.knee.value = 4;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    state.masterGain.connect(compressor);
    compressor.connect(state.audioContext.destination);
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  return state.audioContext;
}

init();
