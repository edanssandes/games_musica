(function () {
  const scale = [65, 67, 69, 70, 72, 74, 76, 77, 79, 81, 82];
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
    id: "hanon-01-f",
    group: "Clássicos · padrão de Hanon nº 1",
    key: "F",
    title: "3 · Fá maior",
    name: "Padrão de cinco dedos, mãos juntas",
    bpm: 72,
    notes
  });
})();