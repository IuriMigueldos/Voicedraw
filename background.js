// Cria as opções no menu de contexto do botão direito
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lerSelecaoDireitoPalavra",
    title: "Ler texto selecionado palavra por palavra",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "lerSelecaoDireitoFrase",
    title: "Ler texto selecionado por frase",
    contexts: ["selection"]
  });
});

// Quando o utilizador clica na opção do botão direito
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lerSelecaoDireitoPalavra") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: iniciarLeitorNatural,
      args: [info.selectionText, "palavra", 0.95]
    });
  }

  if (info.menuItemId === "lerSelecaoDireitoFrase") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: iniciarLeitorNatural,
      args: [info.selectionText, "frase", 0.95]
    });
  }
});

// A lógica de leitura melhorada
function iniciarLeitorNatural(selectedText, modo = "palavra", velocidade = 0.95) {
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

  if (modo === "frase") {
    const frases = selectedText
      .split(/(?<=[.!?])\s+|\n+/)
      .map(frase => frase.trim())
      .filter(Boolean);

    const frasesComPontuacao = (frases.length ? frases : [selectedText.trim()])
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

    tokens = frasesComPontuacao;
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
    if (index >= 0 && index < tokens.length) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(tokens[index]);
      const vozNatural = obterMelhorVozPtBr();
      if (vozNatural) {
        utterance.voice = vozNatural;
      }

      utterance.lang = 'pt-BR';
      utterance.rate = velocidade;
      utterance.pitch = 1.0;

      window.speechSynthesis.speak(utterance);
      estado.currentIndex = index;
    }
  }

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      falarToken(estado.currentIndex);
    };
  } else {
    falarToken(estado.currentIndex);
  }

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
      window.speechSynthesis.cancel();
      window.removeEventListener('keydown', window._leitorKeyHandler);
      window._leitorKeyHandler = null;
      window.__leitorNaturalState = null;
    }
  };

  window.addEventListener('keydown', window._leitorKeyHandler);
  console.log("Leitor ativado em modo: " + modo + ". Use as setas do teclado.");
}