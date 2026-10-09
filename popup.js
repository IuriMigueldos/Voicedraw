const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');

async function executarNoSeparador(operacao, argumentos = []) {
  status.textContent = 'A processar...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== 'number') {
      throw new Error('A aba ativa não está disponível.');
    }

    const target = { tabId: tab.id };
    await chrome.scripting.executeScript({
      target,
      files: ['reader.js']
    });
    const [resultado] = await chrome.scripting.executeScript({
      target,
      func: (acao, args) => {
        const leitor = window.VoicedrawReader;
        if (!leitor) {
          throw new Error('A lógica do leitor não foi carregada.');
        }
        return acao === 'start'
          ? leitor.startFromSelection(args[0], args[1])
          : leitor.control(args[0]);
      },
      args: [operacao, argumentos]
    });

    if (!resultado || !resultado.result) {
      throw new Error('O leitor não retornou um resultado.');
    }
    apresentarResultado(resultado.result);
  } catch (error) {
    console.error('Não foi possível controlar o leitor de voz:', error);
    status.textContent = 'Não foi possível acessar esta página. Tente em uma página comum e recarregue-a.';
  }
}

function apresentarResultado(resultado) {
  switch (resultado.status) {
    case 'started':
      status.textContent = `Leitura iniciada (${resultado.tokenCount} itens). Use as setas para navegar.`;
      break;
    case 'no-selection':
      status.textContent = 'Selecione um texto na página antes de iniciar a leitura.';
      break;
    case 'no-readable-text':
      status.textContent = 'O texto selecionado não contém conteúdo que possa ser lido.';
      break;
    case 'paused':
      status.textContent = 'Leitura pausada.';
      break;
    case 'resumed':
      status.textContent = 'Leitura continuada.';
      break;
    case 'stopped':
      status.textContent = 'Leitura parada.';
      break;
    case 'inactive':
      status.textContent = 'Não há uma leitura ativa para controlar.';
      break;
    default:
      status.textContent = 'Não foi possível concluir a ação solicitada.';
  }
}

startBtn.addEventListener('click', () => {
  const mode = document.getElementById('modoLeitura').value;
  const speed = Number(document.getElementById('velocidadeLeitura').value);
  executarNoSeparador('start', [mode, speed]);
});

pauseBtn.addEventListener('click', () => executarNoSeparador('control', ['pause']));
resumeBtn.addEventListener('click', () => executarNoSeparador('control', ['resume']));
stopBtn.addEventListener('click', () => executarNoSeparador('control', ['stop']));
