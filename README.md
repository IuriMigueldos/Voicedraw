# Leitor de Palavras em Voz

Extensão para Chrome que lê um texto selecionado em português, palavra por palavra ou frase por frase.

## Instalação

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha a pasta deste projeto.

## Como usar

- Selecione um texto em uma página e abra o popup pelo ícone da extensão para configurar o modo e a velocidade.
- Clique em **Ler Seleção**. Também é possível iniciar a leitura pelo menu de contexto com o botão direito.
- Use as setas **Direita/Esquerda** para avançar ou voltar, **Espaço** para pausar/continuar e **Esc** para parar.
- Os botões **Pausar**, **Continuar** e **Parar** também estão disponíveis no popup.

A leitura usa as vozes disponíveis no navegador. A voz em português do Brasil é priorizada quando estiver instalada; caso contrário, é escolhida outra voz em português ou a voz padrão.

O acesso ao texto ocorre somente quando a extensão é acionada e requer permissão para executar o leitor na página atual. Páginas internas do Chrome e algumas páginas protegidas não permitem a injeção de scripts.