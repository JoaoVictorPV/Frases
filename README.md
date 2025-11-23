# Gerenciador de Frases Radiológicas

## 1. Visão Geral do Projeto

Este projeto é uma aplicação web desenvolvida para criar, gerenciar e organizar um acervo de frases utilizadas em laudos radiológicos. A ferramenta permite ao usuário adicionar novas frases de forma intuitiva através de uma interface gráfica, que gera automaticamente um alias (código de atalho) com base em uma lógica pré-definida.

O objetivo é facilitar a expansão e manutenção do acervo de frases, que posteriormente pode ser utilizado em programas expansores de texto, otimizando a elaboração de laudos.

## 2. Lógica de Geração de Aliases

O coração do sistema é a sua lógica inteligente para a criação de aliases. Cada alias é uma representação compacta e única de uma frase, seguindo uma fórmula precisa para garantir organização e escalabilidade.

A fórmula do alias é: **(Identificador de Tipo) + (3 Letras do Segmento) + (Número da Estrutura) + (Letra Sequencial)**

#### Componentes do Alias:

1.  **Identificador de Tipo (1º caractere):**
    *   `_` (Underline): Indica uma frase extensa, parte do corpo do laudo.
    *   `|` (Barra Vertical): Indica uma frase de conclusão, geralmente um resumo diagnóstico.

2.  **Segmento Anatômico (3 letras):**
    *   Representa a área do corpo à qual a frase se refere (ex: `omb` para Ombro, `joe` para Joelho).

3.  **Identificador de Estrutura (1 número):**
    *   Define a estrutura anatômica específica dentro do segmento.
        *   `1`: Osso
        *   `2`: Articulações
        *   `3`: Tendões e Ligamentos
        *   `4`: Miscelânea (outras estruturas)
        *   `5`: Máscaras / Técnica (textos padrão, informações sobre contraste, etc.)

4.  **Letra Sequencial (1 letra):**
    *   `a, b, c, ...`: Diferencia as várias frases. A lógica de atribuição depende do tipo de frase:
        *   **Para Corpo do Laudo (`_`):** A aplicação calcula e atribui esta letra **automaticamente**, pegando a próxima letra disponível na sequência para garantir que não haja duplicatas.
        *   **Para Conclusão (`|`):** O usuário deve inserir **manualmente** a letra correspondente à frase do corpo do laudo à qual esta conclusão se refere. Um campo específico aparecerá na interface para esta finalidade.

#### Exemplos Práticos:

*   `_omb1a`: A **primeira** (`a`) frase do **corpo do laudo** (`_`) referente a **osso** (`1`) do **ombro** (`omb`).
*   `|joe3b`: A **segunda** (`b`) frase de **conclusão** (`|`) referente a **tendões/ligamentos** (`3`) do **joelho** (`joe`).
*   `_mao5c`: A **terceira** (`c`) **máscara** (`5`) para a **mão** (`mao`).

## 3. Arquitetura da Aplicação

A aplicação é construída com uma arquitetura cliente-servidor simples e robusta.

*   **Backend:** Desenvolvido em **Python** com o microframework **Flask**. É responsável por toda a lógica de negócio:
    *   Ler e escrever no arquivo de dados (`frases.json`).
    *   Gerar os aliases automaticamente.
    *   Servir a interface do usuário (frontend).
*   **Frontend:** Construído com **HTML, CSS e JavaScript puros**. Garante uma interface leve, rápida e responsiva.
    *   **HTML (`index.html`):** Estrutura a página.
    *   **CSS (`style.css`):** Estiliza a aplicação para uma aparência moderna e profissional.
    *   **JavaScript (`script.js`):** Controla toda a interatividade, como carregar dados, preencher menus, enviar o formulário e atualizar a visualização do acervo em tempo real.
*   **Arquivo de Dados (`frases.json`):** Um arquivo JSON armazena todas as frases de forma estruturada, espelhando a lógica de Segmentos e Estruturas.

## 4. Estrutura de Pastas

O projeto está organizado da seguinte forma:

```
/GerenciadorDeFrases/
|
|--- backend/
|    |--- app.py             # Servidor Flask
|    |--- frases.json        # Banco de dados das frases
|
|--- frontend/
|    |--- index.html         # Página principal
|    |--- css/
|    |    |--- style.css      # Estilos
|    |--- js/
|         |--- script.js      # Lógica do frontend
|
|--- iniciar.bat             # Script para iniciar a aplicação
|--- README.md               # Esta documentação
```

## 5. Como Utilizar a Aplicação

Para executar o gerenciador, basta seguir um único passo:

1.  **Execute o arquivo `iniciar.bat` com um duplo clique.**

O script fará o seguinte automaticamente:
*   Verificará e instalará as dependências necessárias do Python (Flask).
*   Iniciará o servidor backend em uma janela de terminal. **(Importante: esta janela deve permanecer aberta enquanto você usa a aplicação).**
*   Abrirá a interface da aplicação no seu navegador Google Chrome.

A aplicação estará pronta para uso no endereço `http://127.0.0.1:5000`.

## 6. Funcionalidades Adicionais

### Exportação para TXT

A aplicação permite exportar todo o acervo de frases para um único arquivo `.txt`.

*   **Como usar:** Clique no botão "Exportar para TXT", localizado no canto superior direito da seção "Acervo de Frases".
*   **Formato:** O arquivo gerado (`frases_exportadas.txt`) conterá todas as frases, organizadas por segmento e ordenadas alfabeticamente por seus aliases. O formato é limpo e ideal para leitura ou importação em outros sistemas.

### Segurança de Dados

**Nota sobre Substituição de Conclusões:** Para evitar a perda acidental de dados, a aplicação pedirá uma confirmação caso você tente adicionar uma conclusão (`|`) com um alias que já existe. A frase só será substituída se você confirmar a ação.
