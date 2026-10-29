# Controle de Acordos – Ailos (sistema separado e zerado)

Cópia independente do sistema de acordos. Não tem nenhum dado, nenhum operador e nenhum banco configurado.
Nada aponta para o sistema da Unicred: banco, senhas e Google próprios.

Cooperativas já cadastradas nas telas: **Transpocred, Credforce e Crevisk**.
Para adicionar outras depois, edite a lista `COOPERATIVAS` em `app.js` (admin) e em `operador/index.html` (operador).

## Passo a passo (Vercel + Neon)

1. **Neon** (neon.tech): crie um projeto **novo** e copie a *connection string* (começa com `postgresql://`).
2. **GitHub**: crie um repositório novo e suba todos os arquivos desta pasta.
3. **Vercel**: *Add New → Project* e importe o repositório. Antes de clicar em Deploy, em *Environment Variables*, crie:

   | Variável | O que colocar |
   |---|---|
   | `DATABASE_URL` | a connection string do Neon |
   | `ADMIN_SENHA` | a senha do administrador (o login é `admin`) |
   | `TOKEN_SECRET` | um texto aleatório com 30 caracteres ou mais (qualquer um, só não repita o do outro sistema) |
   | `PREV_SENHA` | senha do login `preventivo` (recomendado; se ficar vazia, o preventivo usa a senha do admin) |

4. **Deploy**. Abra o endereço e entre com `admin` e a senha que você definiu.
   As tabelas são criadas sozinhas no primeiro acesso.
5. Aba **Operadores**: cadastre cada operador com nome, login e CPF (a senha inicial são os 6 primeiros dígitos do CPF).

Telas: `/` administrador · `/operador` operador · `/preventivo` preventivo · `/whats` só o WhatsApp do operador.

## Aba "Carregar Base"

A planilha da base precisa ter estes títulos de coluna: `cooperativa`, `CLI_CPF_CNPJ`, `CLI_NOME`, `DIV_ATRASO`, `DIV_SALDO`
(e, se tiver, `nome_razao_social`, `telefone`, `possui_garantia`). Se a planilha da Ailos vier com outros títulos, é só avisar para ajustar.

## Opcional (pode ficar para depois, o sistema funciona sem)

- **WhatsApp**: a pasta `whatsapp-service` é um serviço separado, que precisa ficar ligado em algum servidor, com a variável `DATABASE_URL` igual à do Neon.
- **Google (arquivo de mídias e histórico do WhatsApp)**: a pasta `google-opcional` tem o script do Google Apps Script. Enquanto as variáveis `GOOGLE_URL` e `GOOGLE_KEY` não forem criadas, nada é enviado ao Google.
- **Espelho em planilha**: variável `SYNC_KEY` (16 caracteres ou mais) e o arquivo `google-opcional/sheets-sync.gs`.
- **Spotify no preventivo**: funciona na página `/preventivo`, cada pessoa informa o próprio Client ID do Spotify.
