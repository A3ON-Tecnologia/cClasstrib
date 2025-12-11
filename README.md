## Análise Tributária por NCM / CFOP / cClasstrib

Aplicação web para consolidar a tributação de produtos a partir de uma planilha XLSX (NCM/CFOP/cClasstrib).  
O frontend é React + Vite, o backend é um pequeno servidor Express que recebe a planilha, processa os dados (via `xlsx`) e devolve um JSON consolidado para a interface.

---

## 1. Pré‑requisitos

- **Node.js** 20+ (recomendado LTS)
- **pnpm** 10+ (o projeto já traz a versão recomendada em `package.json`)
- Git (opcional, apenas para versionamento)

Verifique:

```bash
node -v
pnpm -v
```

Se não tiver o `pnpm` instalado:

```bash
npm install -g pnpm
```

---

## 2. Instalação do projeto

Dentro da pasta do projeto (`cclassnovo`):

```bash
pnpm install
```

Isso baixa todas as dependências de **client** (React/Vite/Tailwind, etc.) e do **server** (Express, Multer, XLSX, etc.).

---

## 3. Scripts principais

### Ambiente de desenvolvimento

```bash
pnpm dev
```

- Sobe o **Vite** com o frontend em modo desenvolvimento (`http://localhost:5173` por padrão).
- O servidor Express é usado apenas após o build; em desenvolvimento, a API principal utilizada é o endpoint `/upload` exposto pela mesma stack Vite/Express conforme configuração atual.

> Dica: se o navegador não abrir automaticamente, acesse manualmente `http://localhost:5173`.

### Build de produção

```bash
pnpm build
```

Esse comando:

1. Gera o bundle do **frontend** (Vite) em `dist/public`.
2. Faz o bundle do **servidor** (`server/index.ts`) com **esbuild** para `dist/index.js`.

### Executar em modo produção

Depois do `pnpm build`:

```bash
pnpm start
```

- Sobe o servidor Express a partir de `dist/index.js`.
- Servirá os arquivos estáticos do frontend e os endpoints de upload.
- A porta padrão é `3000` (configurada em `server/index.ts` via `process.env.PORT || 3000`).

### Outros scripts úteis

- **Checagem TypeScript**

  ```bash
  pnpm check
  ```

  Roda o TypeScript em modo **`--noEmit`** para validar os tipos sem gerar arquivos.

- **Formatar código**

  ```bash
  pnpm format
  ```

  Roda o **Prettier** em todo o projeto.

- **Preview de build**

  ```bash
  pnpm preview
  ```

  Sobe um servidor de preview usando o bundle gerado pelo `pnpm build`.

---

## 4. Arquitetura do projeto

Estrutura de diretórios (nível superior):

- `client/` – código do frontend (React + Vite + Tailwind + Radix UI)
  - `src/pages/Home.tsx` – tela principal de análise (upload, cards, tabela por NCM/CFOP, paginação, etc.)
  - `src/App.tsx`, `src/main.tsx` – bootstrap do React.
- `server/` – backend em Node/Express
  - `index.ts` – servidor principal.  
    - Rota `POST /upload`: recebe a planilha XLSX (via `multer`), consolida os dados (`xlsx`), calcula o resumo e devolve um JSON.
    - Rota `GET *`: entrega `index.html` para o frontend em produção.
- `shared/` – utilitários e tipos compartilhados (se houver).
- `dist/` – saída de build (frontend + backend) gerada por `pnpm build`.

---

## 5. Fluxo de uso da aplicação

1. **Acessar a aplicação**
   - Em dev: `pnpm dev` e abrir `http://localhost:5173`.
   - Em produção: `pnpm build && pnpm start` e abrir `http://localhost:3000`.

2. **Upload da planilha**
   - Na tela inicial, use o botão **Procurar** para selecionar um arquivo `.xlsx`.
   - Em seguida, clique em **Enviar planilha** para enviar o arquivo ao backend.

3. **Formato esperado da planilha**
   - Planilha principal deve conter colunas (podem variar levemente nos nomes; o backend normaliza):
     - `NCM` / `CodigoNCM`
     - `CFOP` / `CodigoCFOP`
     - `cClasstrib_sugerido` / `cClasstrib`
     - `status`
     - `descricao` / `descricaoProduto`
     - `nome_produto` / `nomeProduto`
   - Opcionalmente, uma aba **EMPRESA** (ou `Empresa` / `empresa`) com:
     - **A1** – nome da empresa
     - **A2/B2** – partes do CNPJ (concatenadas no backend)

4. **Resultado após o upload**
   - Cards de resumo são preenchidos:
     - Total de combinações NCM × CFOP.
     - Quantidade com cClasstrib definido.
     - Quantidade com cClasstrib ausente.
   - Lista de NCMs:
     - Agrupadas com borda lateral colorida.
     - Botão para expandir CFOPs e ver o cClasstrib sugerido.
     - Paginação a cada 10 NCMs.
   - Bloco final exibe NCM/CFOP com cClasstrib = N/A.

5. **Exportar para Excel**
   - No canto superior direito do header há o botão **Exportar para Excel**.
   - Ele exporta a consolidação atual (após upload) em uma planilha `analise_tributaria.xlsx`.

> Importante: na versão atual, **nenhum dado é carregado automaticamente** na abertura da página.  
> Os cards e listas são preenchidos apenas depois que uma planilha é enviada com sucesso.

---

## 6. Dependências principais

### Backend

- `express` – servidor HTTP.
- `multer` – upload de arquivos (buffer em memória).
- `xlsx` – leitura e manipulação da planilha XLSX.

### Frontend

- `react`, `react-dom` – base da UI.
- `vite` – bundler/servidor de desenvolvimento.
- `lucide-react` – ícones (CheckCircle, ChevronDown, etc.).
- `wouter` – roteamento leve (simples SPA).
- `tailwindcss` + `@tailwindcss/vite` + `tailwindcss-animate` – estilização utilitária.
- `@radix-ui/*` – componentes acessíveis de UI.
- `react-hook-form`, `zod`, `@hookform/resolvers` – formulários e validação (caso expandidos em telas futuras).
- `sonner` – toasts/avisos (se utilizados).

### Ferramentas de build e dev

- `esbuild` – bundle do servidor.
- `typescript` – tipagem estática.
- `vitest` – testes (se desejar escrever testes unitários).
- `prettier` – formatação de código.

---

## 7. Variáveis de ambiente

Atualmente o projeto usa apenas:

- `PORT` (opcional) – porta do servidor Express em produção.  
  Se não informado, usa `3000`.

Exemplo de execução com porta customizada:

```bash
PORT=4000 pnpm start
```

No Windows PowerShell:

```powershell
$env:PORT=4000
pnpm start
```

---

## 8. Comandos rápidos (resumo)

- Instalar dependências:

  ```bash
  pnpm install
  ```

- Desenvolvimento:

  ```bash
  pnpm dev
  ```

- Build + produção:

  ```bash
  pnpm build
  pnpm start
  ```

- Preview do build:

  ```bash
  pnpm preview
  ```

- Checar tipos:

  ```bash
  pnpm check
  ```

- Formatar código:

  ```bash
  pnpm format
  ```

---

## 9. Possíveis extensões

Algumas ideias caso você queira evoluir o projeto:

- Persistência dos uploads (guardar últimos JSON gerados em disco ou banco).
- Filtros avançados (por NCM, CFOP, status).
- Exportar relatórios separados (somente ausentes, somente múltiplos, etc.).
- Tela de configuração para mapear colunas da planilha de forma dinâmica.

Este README deve servir como guia completo para instalar, rodar e entender a estrutura do projeto na sua máquina local.
