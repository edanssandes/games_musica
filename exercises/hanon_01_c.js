(function () {
  const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77];
  const notes = [];
  const pattern = [0, 1, 2, 3, 4, 3, 2, 1];

  for (let phrase = 0; phrase < 4; phrase += 1) {
    pattern.forEach((degree, beat) => {
      const start = phrase * 4 + beat * 0.5;
      const midi = scale[phrase + degree];
      notes.push({ start, duration: 0.5, midi, hand: "right" });
      notes.push({ start, duration: 0.5, midi: midi - 12, hand: "left" });
    });
  }

  window.registerSightReadingExercise({
    id: "hanon-01-c",
    group: "Clássicos · padrão de Hanon nº 1",
    key: "C",
    title: "1 · Dó maior",
    name: "Padrão de cinco dedos, mãos juntas",
    bpm: 72,
    notes
  });
})();