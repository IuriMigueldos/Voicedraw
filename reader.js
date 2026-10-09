(() => {
  if (window.VoicedrawReader) {
    return;
  }

  const STATE_KEY = '__voicedrawReaderState';
  const KEY_HANDLER_KEY = '__voicedrawReaderKeyHandler';
  const punctuationNames = {
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
  const specialPronunciations = {
    logistico: 'logístico',
    logística: 'logística',
    logístico: 'logístico'
  };

  function tokenize(text, mode) {
    if (mode === 'frase') {
      const sentenceSegmenter = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });
      const tokens = [];
      for (const line of text.split(/\n+/)) {
        for (const sentence of sentenceSegmenter.segment(line)) {
          const words = tokenizeWords(sentence.segment);
          if (words.length) {
            tokens.push(words.join(' '));
          }
        }
      }
      return tokens;
    }

    return tokenizeWords(text);
  }

  function tokenizeWords(text) {
    const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'word' });
    const tokens = [];

    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike) {
        tokens.push(specialPronunciations[segment.segment.toLowerCase()] || segment.segment);
        continue;
      }

      for (const character of Array.from(segment.segment)) {
        if (/\s/u.test(character)) {
          continue;
        }
        tokens.push(punctuationNames[character] || character);
      }
    }

    return tokens;
  }

  function removeKeyHandler() {
    const handler = window[KEY_HANDLER_KEY];
    if (handler) {
      window.removeEventListener('keydown', handler);
      window[KEY_HANDLER_KEY] = null;
    }
  }

  function stop() {
    const state = window[STATE_KEY];
    removeKeyHandler();

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (state) {
      clearVoiceWait(state);
    }

    window[STATE_KEY] = null;
  }

  function clearVoiceWait(state) {
    if (state.voicesChangedHandler) {
      window.speechSynthesis.removeEventListener('voiceschanged', state.voicesChangedHandler);
      state.voicesChangedHandler = null;
    }
    if (state.voiceTimer) {
      window.clearTimeout(state.voiceTimer);
      state.voiceTimer = null;
    }
  }

  function findPortugueseVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(voice =>
      voice.lang === 'pt-BR' && /natural|online/i.test(voice.name)
    ) || voices.find(voice =>
      voice.lang === 'pt-BR' && /google|microsoft/i.test(voice.name)
    ) || voices.find(voice =>
      voice.lang === 'pt-BR'
    ) || voices.find(voice =>
      voice.lang.toLowerCase().startsWith('pt')
    );
  }

  function speak(index, state) {
    if (window[STATE_KEY] !== state || index < 0 || index >= state.tokens.length) {
      return;
    }

    clearVoiceWait(state);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(state.tokens[index]);
    const voice = findPortugueseVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = 'pt-BR';
    utterance.rate = state.speed;
    utterance.pitch = 1;

    state.currentIndex = index;
    window.speechSynthesis.speak(utterance);
  }

  function isEditableTarget(target) {
    return target instanceof Element && (
      target.isContentEditable ||
      target.matches('input, textarea, select, [role="textbox"]')
    );
  }

  function start(text, mode = 'palavra', speed = 0.95) {
    const selectedText = typeof text === 'string' ? text.trim() : '';
    if (!selectedText) {
      return { status: 'no-selection' };
    }

    const tokens = tokenize(selectedText, mode);
    if (!tokens.length) {
      return { status: 'no-readable-text' };
    }

    stop();
    const state = {
      tokens,
      currentIndex: 0,
      speed: Number.isFinite(speed) ? speed : 0.95,
      paused: false,
      mode,
      voicesChangedHandler: null,
      voiceTimer: null
    };
    window[STATE_KEY] = state;

    if (window.speechSynthesis.getVoices().length) {
      speak(state.currentIndex, state);
    } else {
      state.voicesChangedHandler = () => speak(state.currentIndex, state);
      window.speechSynthesis.addEventListener('voiceschanged', state.voicesChangedHandler);
      state.voiceTimer = window.setTimeout(() => speak(state.currentIndex, state), 1000);
    }

    removeKeyHandler();
    window[KEY_HANDLER_KEY] = event => {
      if (window[STATE_KEY] !== state || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'ArrowRight' && state.currentIndex < state.tokens.length - 1) {
        event.preventDefault();
        speak(state.currentIndex + 1, state);
      } else if (event.key === 'ArrowLeft' && state.currentIndex > 0) {
        event.preventDefault();
        speak(state.currentIndex - 1, state);
      } else if (event.code === 'Space' && !event.repeat) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          state.paused = false;
          event.preventDefault();
        } else if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          state.paused = true;
          event.preventDefault();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', window[KEY_HANDLER_KEY]);

    return { status: 'started', tokenCount: tokens.length };
  }

  function startFromSelection(mode = 'palavra', speed = 0.95) {
    const selection = window.getSelection();
    return start(selection ? selection.toString() : '', mode, speed);
  }

  function control(action) {
    const state = window[STATE_KEY];
    if (!state) {
      return { status: 'inactive' };
    }

    if (action === 'pause') {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        state.paused = true;
      }
      return { status: state.paused ? 'paused' : 'inactive' };
    }

    if (action === 'resume') {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        state.paused = false;
        return { status: 'resumed' };
      }
      return { status: 'inactive' };
    }

    if (action === 'stop') {
      stop();
      return { status: 'stopped' };
    }

    return { status: 'unsupported-action' };
  }

  window.VoicedrawReader = { start, startFromSelection, control };
})();
