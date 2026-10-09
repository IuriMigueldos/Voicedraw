const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');

startBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const modo = document.getElementById('modoLeitura').value;
  const velocidade = document.getElementById('velocidadeLeitura').value;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: iniciarLeitorNatural,
    args: [modo, Number(velocidade)]
  });
});

pauseBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: controlarLeitorNatural,
    args: ['pause']
  });
});

resumeBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: controlarLeitorNatural,
    args: ['resume']
  });
});

stopBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: controlarLeitorNatural,
    args: ['stop']
  });
});

function controlarLeitorNatural(acao) {
  const estado = window.__leitorNaturalState;

  if (!estado) {
    return;
  }

  if (acao === 'pause') {
    if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      estado.paused = true;
    }
    return;
  }

  if (acao === 'resume') {
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      estado.paused = false;
    }
    return;
  }

  if (acao === 'stop') {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (window._leitorKeyHandler) {
      window.removeEventListener('keydown', window._leitorKeyHandler);
      window._leitorKeyHandler = null;
    }
    window.__leitorNaturalState = null;
  }
}

function iniciarLeitorNatural(modo = 'palavra', velocidade = 0.95) {
  const selectedText = window.getSelection().toString().trim();

  if (!selectedText) {
    alert("Por favor, selecione um texto na página primeiro!");
    return;
  }

  let tokens = [];

  const nomePontuacao = {
    '.': 'ponto final',
    ',': 'vírgula',
    ';': 'ponto e vírgula',
    ':': 'dois pontos',
    '?': 'ponto de interrogação',
    '!': 'ponto de exclamação',
    '-': 'hífen',
    '—': 'travessão',
    '(': 'abre parênteses',
    ')': 'fecha parênteses',
    '"': 'aspas',
    "'": 'aspas simples',
    '“': 'abre aspas',
    '”': 'fecha aspas',
    '‘': 'abre aspas simples',
    '’': 'fecha aspas simples'
  };

  const pronunciaEspecial = {
    'logistico': 'logístico',
    'logística': 'logística',
    'logistico': 'logístico',
    'logístico': 'logístico'
  };

  if (modo === 'frase') {
    const frases = selectedText
      .split(/(?<=[.!?])\s+|\n+/)
      .map(frase => frase.trim())
      .filter(Boolean);

    tokens = (frases.length ? frases : [selectedText])
      .map(frase => {
        const rawTokens = frase.match(/[\wÀ-ÿ]+|[.,\/#!$%\^&\*;:{}=\-_`~()?"'“”‘’]/g) || [];
        return rawTokens.map(token => {
          const chave = token.toLowerCase();
          if (nomePontuacao[token]) return nomePontuacao[token];
          if (pronunciaEspecial[chave]) return pronunciaEspecial[chave];
          return token;
        }).join(' ');
      })
      .filter(Boolean);
  } else {
    const rawTokens = selectedText.match(/[\wÀ-ÿ]+|[.,\/#!$%\^&\*;:{}=\-_`~()?"'“”‘’]/g) || [];
    tokens = rawTokens.map(token => {
      const chave = token.toLowerCase();
      if (nomePontuacao[token]) return nomePontuacao[token];
      if (pronunciaEspecial[chave]) return pronunciaEspecial[chave];
      return token;
    });
  }

  const estado = {
    tokens,
    currentIndex: 0,
    velocidade,
    paused: false,
    modo
  };

  window.__leitorNaturalState = estado;

  function obterMelhorVozPtBr() {
    const voices = window.speechSynthesis.getVoices();

    let voz = voices.find(v => v.lang === 'pt-BR' && (v.name.includes('Natural') || v.name.includes('Online')));
    if (!voz) {
      voz = voices.find(v => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Microsoft')));
    }
    if (!voz) {
      voz = voices.find(v => v.lang === 'pt-BR');
    }
    if (!voz) {
      voz = voices.find(v => v.lang.startsWith('pt'));
    }

    return voz;
  }

  function falarToken(index) {
    if (!window.__leitorNaturalState) {
      return;
    }

    const state = window.__leitorNaturalState;
    if (index >= 0 && index < state.tokens.length) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(state.tokens[index]);
      const vozNatural = obterMelhorVozPtBr();
      if (vozNatural) {
        utterance.voice = vozNatural;
      }

      utterance.lang = 'pt-BR';
      utterance.rate = state.velocidade;
      utterance.pitch = 1.0;

      window.speechSynthesis.speak(utterance);
      state.currentIndex = index;
    }
  }

  const tocarPrimeiro = () => {
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        falarToken(0);
      };
    } else {
      falarToken(0);
    }
  };

  tocarPrimeiro();

  if (window._leitorKeyHandler) {
    window.removeEventListener('keydown', window._leitorKeyHandler);
  }

  window._leitorKeyHandler = (event) => {
    const state = window.__leitorNaturalState;
    if (!state) {
      return;
    }

    if (event.key === 'ArrowRight') {
      if (state.currentIndex < state.tokens.length - 1) {
        state.currentIndex++;
        falarToken(state.currentIndex);
      }
    } else if (event.key === 'ArrowLeft') {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        falarToken(state.currentIndex);
      }
    } else if (event.code === 'Space') {
      event.preventDefault();
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        state.paused = true;
      } else if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        state.paused = false;
      }
    } else if (event.key === 'Escape') {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (window._leitorKeyHandler) {
        window.removeEventListener('keydown', window._leitorKeyHandler);
        window._leitorKeyHandler = null;
      }
      window.__leitorNaturalState = null;
    }
  };

  window.addEventListener('keydown', window._leitorKeyHandler);
  alert("Modo de leitura ativado: " + (modo === 'frase' ? 'por frase' : 'palavra por palavra') + ". Use as setas do teclado para navegar.");
}