# Controle de Acordos · Carteira Ailos

Mesmo sistema do UNICRED (operador, administrador, preventivo e aba WhatsApp), agora com as cooperativas da Ailos:
TRANSPOCRED, VIACREDI AV, ACREDICOOP, CREDICOMIN, CREDICREA, CREDIFOZ, VIACREDI, CREVISC, ACENTRA, UNILOS, EVOLUA, CIVIA.

Nada daqui aponta para o banco, a planilha ou o Apps Script antigos. Para colocar no ar:

1. **Banco (Neon):** crie um projeto novo e copie a string de conexão. As tabelas são criadas sozinhas no primeiro acesso (`schema.sql` serve de referência).
2. **Vercel:** importe este repositório e cadastre as variáveis `DATABASE_URL`, `ADMIN_SENHA`, `PREV_SENHA` e `SYNC_KEY`.
3. **WhatsApp (Render):** crie um Web Service com a pasta `whatsapp-service` (usa o `Dockerfile`).
4. **Google Sheets/Drive (opcional, só se quiser o histórico do WhatsApp):** publique `google-ailos.gs` como Apps Script (web app) e cadastre `GOOGLE_URL` e `GOOGLE_KEY` na Vercel e no Render. Sem isso o resto funciona normalmente.

Os bloqueios de cooperativa por operador (`BLOQUEIOS` em `api/index.js`) começam vazios.
