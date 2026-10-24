# Leitura a Primeira Vista

Jogo de treino de leitura melódica em navegador, sem servidor e sem piano desenhado.

## Como usar

1. Abra o arquivo `index.html` no navegador.
2. Escolha um grupo de tonalidade e um exercício. A troca inicia automaticamente a contagem e a reprodução. “Repetir” reinicia o exercício atual.
3. Observe a partitura durante o tempo configurado.
4. Escute a melodia gerada pelo navegador acompanhando a partitura.
5. Ao fim, escolha repetir ou ir para o próximo exercício.

## Estrutura

- `index.html`: estrutura da página.
- `style.css`: visual do jogo.
- `script.js`: lógica do jogo, carregamento de exercícios, notação ABC e áudio.
- `exercises/manifest.js`: lista dos arquivos de exercício a carregar.
- `exercises/`: um arquivo JavaScript independente por exercício.

## Como adicionar mais exercícios

Crie um arquivo, por exemplo `exercises/novo_exercicio.js`, que registre um exercício:

```js
window.registerSightReadingExercise({
  id: "novo-01",
  group: "Lá maior · 3 sustenidos",
  key: "A",
  title: "1",
  name: "Arpejos e escala",
  bpm: 96,
  notes: [69, 73, 76, 81, 78, 76, 73, 69]
});
```

- Inclua o caminho do novo arquivo em `exercises/manifest.js`.
- `group` define a categoria que aparece no primeiro seletor; agrupe por tonalidade, armadura, nível ou outro critério.
- `key` é a tonalidade ABCJS usada na armadura. São aceitas tonalidades usuais como `C`, `G`, `D`, `A`, `F`, `Bb` e `Eb`.
- `bpm` define o andamento padrão deste exercício; em “Configurações” é possível usar o andamento dos exercícios ou aplicar um BPM personalizado.
- A forma compacta `notes: [69, 73, ...]` cria semínimas consecutivas. Os números são notas MIDI.
- Para personalizar ritmo, use objetos com `midi`, `duration` e opcionalmente `start`, medidos em tempos de semínima. Exemplo: `notes: [{ midi: 69, duration: 2 }, { midi: 73, duration: 0.5 }, { midi: 76, duration: 0.5 }]`.
- Para escolher a pauta/mão, acrescente `hand: "left"` ou `hand: "right"`. Para tocar as duas mãos juntas, coloque eventos das duas mãos com o mesmo `start`; para alternar por compasso, atribua os eventos de cada compasso a uma mão.

## Observações

- O áudio é sintetizado pela Web Audio API, sem arquivos MIDI externos ou samples grandes. O timbre é uma aproximação de piano por harmônicos e envelope percussivo, não uma gravação sampleada de grand piano.
- Há 40 exercícios: 30 em seis grupos de tonalidade (dó, sol, ré, fá, si bemol e mi bemol maiores), mais cinco de mãos alternadas e cinco de mãos simultâneas.
- ABCJS renderiza as partituras em pauta dupla, com clave de sol e de fá, armadura, barras de compasso e durações musicais. Notas abaixo do dó central vão para a clave de fá.
- A página não precisa de servidor, mas precisa de conexão com a internet para carregar ABCJS pelo CDN jsDelivr.
- O tempo padrão é 10 segundos. Use “Configurações” para escolher de 1 a 60 segundos; a escolha fica salva neste navegador.
- O BPM personalizado também fica salvo no navegador; ao escolher “Usar o andamento do exercício”, volta-se aos valores individuais dos arquivos.
