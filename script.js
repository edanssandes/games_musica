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

// Harmônicos, corpo, decaimento e cauda próprios de cada instrumento sintetizado.
const PIANO_TIMBRES = {
  grand: { partials: [[1, 1], [2.002, 0.32], [3.006, 0.14], [4.012, 0.06], [6.024, 0.025]], body: 0.55, decay: 2.4, release: 0.65, attack: 0.006 },
  soft: { partials: [[1, 1], [2.001, 0.18], [3.004, 0.045], [4.008, 0.015]], body: 0.65, decay: 3.2, release: 0.9, attack: 0.012 },
  bright: { partials: [[1, 1], [2.003, 0.5], [3.009, 0.24], [4.018, 0.12], [6.036, 0.055]], body: 0.45, decay: 1.8, release: 0.45, attack: 0.004 },
  sustained: { partials: [[1, 1], [2.001, 0.25], [3.004, 0.09], [4.009, 0.035]], body: 0.8, decay: 6, release: 2.4, attack: 0.009 },
  felt: { partials: [[1, 1], [2, 0.11], [3.002, 0.025]], body: 0.75, decay: 4.5, release: 1.5, attack: 0.02 },
  electric: { partials: [[1, 1], [2, 0.12], [3, 0.3], [7, 0.12]], body: 0.7, decay: 4, release: 1.8, attack: 0.007 }
};

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
  groupExerciseIndexes: new Map(),
  audioContext: null,
  pianoBus: null,
  masterGain: null,
  activeOscillators: [],
  audioPreviewActive: false,
  volumeLevel: 1.5,
  noteSizeLevel: 1.15,
  audioTimbre: "grand",
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
  fullscreenPrevBtn: document.getElementById("fullscreenPrevBtn"),
  fullscreenRepeatBtn: document.getElementById("fullscreenRepeatBtn"),
  fullscreenNextBtn: document.getElementById("fullscreenNextBtn"),
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
  noteSizeInput: document.getElementById("noteSizeInput"),
  noteSizeValue: document.getElementById("noteSizeValue"),
  timbreInput: document.getElementById("timbreInput"),
  testSoundBtn: document.getElementById("testSoundBtn"),
  soundPreviewStatus: document.getElementById("soundPreviewStatus"),
  noteSizePreview: document.getElementById("noteSizePreview"),
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
  return Promise.all(files.map((filePath) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // Fetch in parallel but execute in manifest order.
    script.async = false;
    script.src = new URL(filePath, document.baseURI).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${filePath}`));
    document.head.appendChild(script);
  })));
}

function populateGroupOptions() {
  const groups = [...new Set(EXERCISES.map((exercise) => exercise.group))];
  state.groupExerciseIndexes = new Map(groups.map((group) => [
    group,
    EXERCISES.reduce((indexes, exercise, index) => {
      if (exercise.group === group) indexes.push(index);
      return indexes;
    }, [])
  ]));
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

  ui.fullscreenPrevBtn.addEventListener("click", () => advanceExercise(-1));
  ui.fullscreenRepeatBtn.addEventListener("click", startExerciseFlow);
  ui.fullscreenNextBtn.addEventListener("click", () => advanceExercise(1));

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
  ui.noteSizeInput.addEventListener("input", updateNoteSizePreview);
  ui.testSoundBtn.addEventListener("click", previewPianoSound);
  ui.settingsForm.addEventListener("submit", saveSettings);
  ui.fullscreenBtn.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) unlockScreenOrientation();
    updateFullscreenButton();
  });
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
    const storedVolume = window.localStorage.getItem("sightReadingVolume");
    const savedVolume = Number(storedVolume);
    if (storedVolume !== null && Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 2) {
      state.volumeLevel = savedVolume;
    }
  } catch {
    state.volumeLevel = 1.5;
  }
  try {
    const savedNoteSize = Number(window.localStorage.getItem("sightReadingNoteSize"));
    if (Number.isFinite(savedNoteSize) && savedNoteSize >= 0.9 && savedNoteSize <= 1.4) {
      state.noteSizeLevel = savedNoteSize;
    }
  } catch {
    state.noteSizeLevel = 1.15;
  }
  try {
    const savedTimbre = window.localStorage.getItem("sightReadingTimbre");
    if (Object.hasOwn(PIANO_TIMBRES, savedTimbre)) state.audioTimbre = savedTimbre;
  } catch {
    state.audioTimbre = "grand";
  }
  ui.volumeInput.value = String(Math.round(state.volumeLevel * 100));
  ui.noteSizeInput.value = String(Math.round(state.noteSizeLevel * 100));
  ui.timbreInput.value = state.audioTimbre;
  updateNoteSizePreview();
  updateVolumePreview();
}

function openSettings() {
  ui.exposureInput.value = String(state.exposureSeconds);
  ui.tempoModeInput.value = state.playbackBpmOverride === null ? "exercise" : "custom";
  ui.playbackBpmInput.value = String(state.playbackBpmOverride ?? 90);
  ui.volumeInput.value = String(Math.round(state.volumeLevel * 100));
  ui.noteSizeInput.value = String(Math.round(state.noteSizeLevel * 100));
  ui.timbreInput.value = state.audioTimbre;
  ui.soundPreviewStatus.textContent = "Use “Testar som” para comparar o volume e o timbre antes de salvar.";
  ui.settingsModal.classList.remove("hidden");
  updateNoteSizePreview();
  updateVolumePreview();
  updateTempoInputState();
  ui.exposureInput.focus();
}

function updateTempoInputState() {
  ui.playbackBpmInput.disabled = ui.tempoModeInput.value !== "custom";
  ui.playbackBpmInput.required = !ui.playbackBpmInput.disabled;
}

function closeSettings() {
  if (state.audioPreviewActive) stopActiveNotes();
  ui.settingsModal.classList.add("hidden");
  ui.volumeInput.value = String(Math.round(state.volumeLevel * 100));
  ui.volumeValue.textContent = `${Math.round(state.volumeLevel * 100)}%`;
  ui.noteSizeInput.value = String(Math.round(state.noteSizeLevel * 100));
  ui.timbreInput.value = state.audioTimbre;
  updateNoteSizePreview();
  if (state.masterGain) {
    state.masterGain.gain.setTargetAtTime(state.volumeLevel, state.audioContext.currentTime, 0.025);
  }
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
  state.noteSizeLevel = Number(ui.noteSizeInput.value) / 100;
  state.audioTimbre = ui.timbreInput.value;
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
    window.localStorage.setItem("sightReadingNoteSize", String(state.noteSizeLevel));
    window.localStorage.setItem("sightReadingTimbre", state.audioTimbre);
  } catch {
    // A configuração ainda vale nesta sessão, mesmo se o armazenamento estiver indisponível.
  }

  closeSettings();
  if (state.currentExercise) renderScore();
  ui.messageBox.textContent = `Configurações salvas. Volume: ${Math.round(state.volumeLevel * 100)}%; notas: ${Math.round(state.noteSizeLevel * 100)}%; timbre: ${ui.timbreInput.selectedOptions[0].textContent}.`;
}

function updateVolumePreview() {
  const percent = Number(ui.volumeInput.value);
  ui.volumeValue.textContent = `${percent}%`;
  if (state.masterGain && Number.isFinite(percent)) {
    state.masterGain.gain.setTargetAtTime(percent / 100, state.audioContext.currentTime, 0.025);
  }
}

function updateNoteSizePreview() {
  const percent = Number(ui.noteSizeInput.value);
  ui.noteSizeValue.textContent = `${percent}%`;
  if (!ui.settingsModal.classList.contains("hidden") && window.ABCJS) {
    window.ABCJS.renderAbc(ui.noteSizePreview, "X:1\nM:4/4\nL:1/4\nK:C\nC D E F |", {
      scale: 1.45 * percent / 100,
      staffwidth: 200,
      paddingtop: 8,
      paddingbottom: 8,
      foregroundColor: "#111"
    });
  }
}

async function previewPianoSound() {
  try {
    // Inicializar/resumir no próprio clique evita bloqueios de autoplay.
    const audioContext = getAudioContext();
    await audioContext.resume();
    clearPlaybackTimers();
    closeModal();
    state.audioPreviewActive = true;
    const timbre = ui.timbreInput.value;
    triggerPianoNote(60, 1.4, timbre);
    triggerPianoNote(64, 1.4, timbre);
    triggerPianoNote(67, 1.4, timbre);
    ui.statusPill.textContent = "Teste de som";
    ui.soundPreviewStatus.textContent = `Teste: ${ui.timbreInput.selectedOptions[0].textContent}, volume ${ui.volumeInput.value}%. Ajuste o volume enquanto o acorde soa ou teste novamente.`;
  } catch (error) {
    console.error("Falha no teste de som:", error);
    ui.soundPreviewStatus.textContent = "Não foi possível iniciar o áudio. Confira o som e as permissões deste navegador.";
  }
}

async function toggleFullscreen() {
  const appShell = document.querySelector(".app-shell");
  if (appShell.classList.contains("focus-mode")) {
    appShell.classList.remove("focus-mode");
    document.body.classList.remove("focus-mode-active");
    unlockScreenOrientation();
    updateFullscreenButton();
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      if (!appShell.requestFullscreen) throw new Error("Fullscreen API indisponível");
      await appShell.requestFullscreen();
      await lockScreenOrientation();
    }
  } catch (error) {
    appShell.classList.add("focus-mode");
    document.body.classList.add("focus-mode-active");
    await lockScreenOrientation();
  }
  updateFullscreenButton();
}

async function lockScreenOrientation() {
  try {
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch (error) {
    // Alguns navegadores só permitem o bloqueio em tela cheia ou não oferecem essa API.
  }
}

function unlockScreenOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch (error) {
    // A orientação volta ao controle do dispositivo mesmo se o navegador não aceitar unlock.
  }
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
  state.audioPreviewActive = false;
}

function advanceExercise(offset) {
  if (!state.currentExercise) return;
  const groupIndexes = state.groupExerciseIndexes.get(state.currentExercise.group) || [];
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
  const compactLayout = window.matchMedia("(max-width: 680px), (pointer: coarse) and (max-height: 500px)").matches;
  const fullscreenLayout = Boolean(document.fullscreenElement) || document.querySelector(".app-shell").classList.contains("focus-mode");
  const staffStyle = window.getComputedStyle(ui.staff);
  const staffWidth = Math.max(240, ui.staff.clientWidth - parseFloat(staffStyle.paddingLeft) - parseFloat(staffStyle.paddingRight));
  const baseScale = compactLayout ? (fullscreenLayout ? 1.8 : 1.65) : 1.45;
  const scale = baseScale * state.noteSizeLevel;
  window.ABCJS.renderAbc(ui.staff, abc, {
    // Um SVG responsivo ajusta a largura e anula visualmente a escala.
    // Manter as dimensões reais; a área da partitura oferece rolagem se necessário.
    staffwidth: Math.max(240, staffWidth / scale - 40),
    wrap: { minSpacing: 1.8, maxSpacing: 2.7, preferredMeasuresPerLine: 4 },
    scale,
    paddingtop: 12,
    paddingbottom: 12,
    foregroundColor: "#111",
    clickListener: (abcElement) => {
      const startChar = abcElement?.startChar;
      const mappedBeat = state.scoreNotePositions.get(startChar);
      if (Number.isFinite(mappedBeat)) seekToBeat(mappedBeat, true);
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
      noteStart: soundingNote ? soundingNote.start : null
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
    if (Number.isFinite(segment.noteStart)) {
      // ABCJS includes the preceding space in startChar after voice markers
      // and barlines. Offset -1 addresses the space in the voice prefix.
      if (offset === 0 || text[offset - 1] === " ") {
        notePositions.push({ offset: offset - 1, beat: segment.noteStart });
      }
      for (let characterOffset = 0; characterOffset < segment.text.length; characterOffset += 1) {
        notePositions.push({ offset: offset + characterOffset, beat: segment.noteStart });
      }
    }
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

function triggerPianoNote(midi, durationSeconds, timbre = state.audioTimbre) {
  const audioContext = getAudioContext();
  const now = audioContext.currentTime;
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);
  const profile = PIANO_TIMBRES[timbre] || PIANO_TIMBRES.grand;
  const hold = Math.max(0.04, durationSeconds);
  const decayTime = Math.min(0.22, hold * 0.4);
  const weightSum = profile.partials.reduce((sum, [, weight]) => sum + weight, 0);

  profile.partials.forEach(([ratio, weight]) => {
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const partialFrequency = frequency * ratio;
    if (partialFrequency >= audioContext.sampleRate / 2) return;
    // Reserva dinâmica para acordes e para o volume de até 200%.
    const level = 0.24 * weight / weightSum;
    const harmonicDecay = profile.decay / Math.sqrt(ratio);
    const bodyLevel = level * profile.body / Math.sqrt(ratio);
    const heldLevel = Math.max(0.00002, bodyLevel * Math.exp(-(hold - decayTime) / harmonicDecay));
    const release = profile.release / Math.sqrt(ratio);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(partialFrequency, now);
    envelope.gain.setValueAtTime(0.00001, now);
    envelope.gain.exponentialRampToValueAtTime(level, now + Math.min(profile.attack, decayTime / 2));
    envelope.gain.exponentialRampToValueAtTime(bodyLevel, now + decayTime);
    envelope.gain.exponentialRampToValueAtTime(heldLevel, now + hold);
    envelope.gain.exponentialRampToValueAtTime(0.00001, now + hold + release);

    oscillator.connect(envelope);
    envelope.connect(state.pianoBus);
    oscillator.start(now);
    oscillator.stop(now + hold + release + 0.02);
    state.activeOscillators.push(oscillator);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      envelope.disconnect();
      state.activeOscillators = state.activeOscillators.filter((active) => active !== oscillator);
    }, { once: true });
  });

}

function getAudioContext() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
    const compressor = state.audioContext.createDynamicsCompressor();
    state.pianoBus = state.audioContext.createGain();
    state.masterGain = state.audioContext.createGain();
    state.masterGain.gain.value = getCurrentVolume();
    const bassBoost = state.audioContext.createBiquadFilter();
    bassBoost.type = "lowshelf";
    bassBoost.frequency.value = 220;
    bassBoost.gain.value = 2;
    compressor.threshold.value = -12;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    // Volume DEPOIS do compressor: a compressão não deve compensar o controle.
    state.pianoBus.connect(bassBoost);
    bassBoost.connect(compressor);
    compressor.connect(state.masterGain);
    state.masterGain.connect(state.audioContext.destination);
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  return state.audioContext;
}

function getCurrentVolume() {
  return ui.settingsModal.classList.contains("hidden")
    ? state.volumeLevel
    : Number(ui.volumeInput.value) / 100;
}

init();
