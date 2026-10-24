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
  playbackTimerIds: [],
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
  modal: document.getElementById("modal"),
  modalText: document.getElementById("modalText"),
  modalRepeatBtn: document.getElementById("modalRepeatBtn"),
  modalNextBtn: document.getElementById("modalNextBtn"),
  settingsModal: document.getElementById("settingsModal"),
  settingsForm: document.getElementById("settingsForm"),
  exposureInput: document.getElementById("exposureInput"),
  tempoModeInput: document.getElementById("tempoModeInput"),
  playbackBpmInput: document.getElementById("playbackBpmInput"),
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
  ui.settingsForm.addEventListener("submit", saveSettings);
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
}

function openSettings() {
  ui.exposureInput.value = String(state.exposureSeconds);
  ui.tempoModeInput.value = state.playbackBpmOverride === null ? "exercise" : "custom";
  ui.playbackBpmInput.value = String(state.playbackBpmOverride ?? 90);
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
  try {
    window.localStorage.setItem("sightReadingExposureSeconds", String(value));
    if (state.playbackBpmOverride === null) {
      window.localStorage.removeItem("sightReadingPlaybackBpm");
    } else {
      window.localStorage.setItem("sightReadingPlaybackBpm", String(state.playbackBpmOverride));
    }
  } catch {
    // A configuração ainda vale nesta sessão, mesmo se o armazenamento estiver indisponível.
  }

  closeSettings();
  if (state.currentExercise) renderScore();
  ui.messageBox.textContent = `Tempo de observação configurado para ${value} segundos.`;
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
  ui.messageBox.textContent = "Escolha outro exercício para iniciar ou toque em “Repetir” para ouvir este.";
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
  ui.countdown.hidden = true;

  const beatDuration = 60 / getPlaybackBpm(exercise);
  const totalDuration = Math.max(...exercise.notes.map((note) => note.start + note.duration)) * beatDuration;

  state.isPlayingDemo = true;
  ui.statusPill.textContent = "Tocando";
  ui.messageBox.textContent = "Escute a melodia acompanhando a partitura.";

  exercise.notes.forEach((note) => {
    const timer = window.setTimeout(() => triggerPianoNote(note.midi, note.duration * beatDuration), note.start * beatDuration * 1000);
    state.playbackTimerIds.push(timer);
  });

  const endTimer = window.setTimeout(() => {
    state.isPlayingDemo = false;
    ui.statusPill.textContent = "Concluído";
    ui.messageBox.textContent = "A audição terminou. Você pode repetir ou escolher o próximo exercício.";
    openModal("A audição terminou. Quer ouvir este exercício novamente ou seguir para o próximo?");
  }, totalDuration * 1000 + 250);

  state.playbackTimerIds.push(endTimer);
}

function clearPlaybackTimers() {
  state.playbackTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  state.playbackTimerIds = [];
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
  window.ABCJS.renderAbc(ui.staff, abc, {
    responsive: "resize",
    staffwidth: 1100,
    scale: 1.35,
    paddingtop: 12,
    paddingbottom: 12,
    foregroundColor: "#111"
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

  return [
    `X:1`,
    `T:${exercise.name}`,
    `M:4/4`,
    `L:1/4`,
    `Q:1/4=${getPlaybackBpm(exercise)}`,
    `%%score { (treble) | (bass) }`,
    `V:treble clef=treble`,
    `V:bass clef=bass`,
    `K:${exercise.key}`,
    `[V:treble] ${buildVoiceTokens(trebleNotes, measureCount, exercise.key)}`,
    `[V:bass] ${buildVoiceTokens(bassNotes, measureCount, exercise.key)}`
  ].join("\n");
}

function buildVoiceTokens(notes, measureCount, key) {
  const beatsPerMeasure = 4;
  const totalBeats = measureCount * beatsPerMeasure;
  const tokens = [];
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
    tokens.push(`${pitch}${abcLength(duration)}${tie}`);
    beat += duration;
    if (Math.abs(beat % beatsPerMeasure) < 0.0001) tokens.push("|");
  }

  return tokens.join(" ");
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
    { ratio: 1, level: 0.16 },
    { ratio: 2.01, level: 0.055 },
    { ratio: 3.98, level: 0.022 },
    { ratio: 6.02, level: 0.009 }
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
    envelope.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSeconds + 0.01);
  });

}

function getAudioContext() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  return state.audioContext;
}

init();
