const MENU_ITEMS = [
  {
    id: 'lerSelecaoDireitoPalavra',
    title: 'Ler texto selecionado palavra por palavra'
  },
  {
    id: 'lerSelecaoDireitoFrase',
    title: 'Ler texto selecionado por frase'
  }
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error('Não foi possível limpar o menu de contexto:', chrome.runtime.lastError.message);
      return;
    }

    for (const item of MENU_ITEMS) {
      chrome.contextMenus.create({
        ...item,
        contexts: ['selection']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Não foi possível criar a opção do menu de contexto:', chrome.runtime.lastError.message);
        }
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuItem = MENU_ITEMS.find(item => item.id === info.menuItemId);
  if (!menuItem) {
    return;
  }

  if (!tab || typeof tab.id !== 'number') {
    console.error('Não foi possível iniciar a leitura: a aba ativa não está disponível.');
    return;
  }

  executarNoSeparador(tab.id, 'start', [
    info.selectionText || '',
    menuItem.id === 'lerSelecaoDireitoFrase' ? 'frase' : 'palavra',
    0.95
  ]).catch(error => {
    console.error('Não foi possível iniciar a leitura do texto selecionado:', error);
  });
});

async function executarNoSeparador(tabId, operacao, argumentos) {
  const target = { tabId };

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
        ? leitor.start(args[0], args[1], args[2])
        : leitor.control(args[0]);
    },
    args: [operacao, argumentos]
  });

  if (resultado && resultado.result && resultado.result.status === 'no-selection') {
    console.warn('Não foi possível iniciar a leitura: nenhum texto foi selecionado.');
  }
}
