# PodoPrev — Apoio à decisão e acompanhamento podológico

> TCC em Podologia · React + TypeScript + Firebase + Capacitor
> Um único app mobile (Android/iOS via Capacitor) para os dois papéis — podólogo e
> paciente —, cada um com sua própria tela inicial e barra de abas, com foco em
> pessoas diabéticas.

**PodoPrev não realiza diagnóstico médico e não é um formulário passivo.** É um
sistema de apoio à tomada de decisão: organiza informações do paciente, identifica
sinais de atenção, classifica um nível de atenção preventivo (não um risco médico) e
**transforma isso em ação** — dizendo ao profissional quem precisa de atenção hoje e
sugerindo o que fazer a seguir. Toda tela que exibe uma classificação reforça que ela
não substitui avaliação profissional presencial.

---

## 1. Princípio central: dados viram ação, não só cadastro

Um sistema que apenas registra anamneses e mostra uma lista de pacientes é, na
prática, um formulário bonito. O que torna o PodoPrev diferente é que **a tela
inicial não é uma lista de cadastros — é uma lista de tarefas**: `DashboardPage`
(`src/pages/Dashboard.tsx`) abre mostrando quem precisa de atenção *agora*, ordenado
por uma regra fixa de prioridade, com um botão de ação ao lado de cada nome. Ver
seção 3.

> O diferencial do aplicativo está na integração entre anamnese podológica adaptativa,
> classificação preventiva de nível de atenção, um painel de ação que prioriza
> pacientes automaticamente, acompanhamento fotográfico autorizado, sugestão de
> retorno e adequação aos princípios da LGPD. Diferente de sistemas voltados apenas
> para agenda e gestão financeira, a proposta prioriza a prevenção, a organização
> clínica e o acompanhamento de pacientes com maior nível de atenção, especialmente
> pessoas com diabetes. Além disso, o PodoPrev fecha o ciclo do cuidado: as
> orientações que o profissional registra no prontuário chegam ao paciente como
> lembretes reais no celular, transformando a orientação clínica em um hábito
> acompanhado, não em um papel esquecido na bolsa.

### Dois papéis, um único app mobile

Não existe "site do profissional" e "app do paciente" separados: é o mesmo app
instalado, com a mesma casca mobile (`MobileShell` — topo + barra de abas inferior,
sem sidebar nem layout de desktop). O que muda é a tela inicial e as abas disponíveis
depois do login, de acordo com o papel da conta:

| | Profissional | Paciente |
|---|---|---|
| Login | Conta própria, cadastro livre | Conta própria, criada com código de convite do profissional |
| Abas | Painel de ação, Pacientes | Início, Cuidados, Histórico |
| Vê | Todos os seus pacientes e atendimentos, priorizados | Só os próprios dados clínicos |
| Registra | Anamnese, sinais observados, orientações, conduta | Nada — só lê e marca cuidados como feitos localmente |
| Recebe | — | Lembretes locais no celular para cada orientação de cuidado |

## 2. Modelo híbrido: estrutura fixa + conteúdo flexível

Esse é o modelo de decisão que o sistema segue em toda tela clínica — e a resposta
para "isso não é só um formulário": parte da lógica é fixa e não pode ser alterada
pelo profissional; parte é intencionalmente editável, porque quem decide a conduta é
sempre o profissional, não o sistema.

| | Fixo (o sistema controla) | Flexível (o profissional controla) |
|---|---|---|
| Estrutura de coleta | Os grupos de perguntas da anamnese e os sinais do exame são sempre os mesmos (`domain/factories.ts`, `pages/visits/steps/`) | O profissional pode adicionar observações livres em qualquer campo de texto |
| Classificação | `calculateRiskScore` (`domain/riskScore.ts`) — soma de pontos fixos, mesma fórmula sempre. Não é editável na UI. | — (por design, sem exceção: é o núcleo defensável na banca) |
| Prioridade de pacientes | `computeActionStatus` / `sortByPriority` (`domain/actionQueue.ts`) decide sozinho quem aparece primeiro no Painel de Ação | — |
| Sugestão de retorno | `suggestReturnDate` calcula uma data a partir do nível de atenção (`domain/returnSuggestion.ts`) | O profissional sempre pode sobrescrever a data antes de salvar (`Visit.returnDate` ≠ `Visit.suggestedReturnDate`) |
| Orientações ao paciente | `deriveCareInstructions` pré-preenche uma lista a partir dos sinais observados (`domain/careInstructions.ts`) | O profissional edita o texto, a frequência, remove ou adiciona orientações manuais antes de salvar |
| Conduta / observações | — | Campo livre (`Visit.conduct`), nunca influencia o cálculo |

Na tela de resultado do atendimento (`StepResult.tsx`) essa fronteira é explícita na
interface: o bloco de pontuação e classificação traz "🔒 calculado automaticamente…
não editável", e o bloco de retorno/conduta traz "✏️ você pode ajustar — o sistema
sugere, você decide."

## 3. O Painel de Ação

`DashboardPage` (`src/pages/Dashboard.tsx`) é a tela mais importante do sistema — a
primeira coisa que o profissional vê depois do login. Em vez de estatísticas soltas,
ela é organizada como uma lista de tarefas priorizada:

1. **🔥 Precisa de atenção hoje** — pacientes com retorno atrasado, retorno marcado
   para hoje, ou que nunca tiveram um atendimento registrado. Esta é a seção em
   destaque (borda e sombra proeminentes).
2. **Alto nível de atenção** — pacientes cujo último atendimento indicou atenção alta,
   mesmo que o retorno ainda não tenha vencido.
3. **Atendimentos recentes** — referência rápida dos últimos atendimentos, no rodapé.

Cada linha traz nome, situação (`"Retorno atrasado há 6 dias"`, `"Nunca avaliado"`…),
o nível de atenção e dois botões de ação: **Registrar atendimento** e **Ver
histórico**. `PatientListPage` usa a mesma lógica de prioridade para ordenar a lista
completa de pacientes — a organização por prioridade não é exclusiva do painel.

A lógica que decide a prioridade é **fixa e não configurável**, em
`src/domain/actionQueue.ts`:

```
atrasado (retorno já passou)     → prioridade 0 (mais urgente)
hoje (retorno é hoje)            → prioridade 1
sem_atendimento (nunca avaliado) → prioridade 2
alto (atenção alta, em dia)      → prioridade 3
em_dia (tudo certo)              → prioridade 4
```

Dentro de cada grupo, quem está mais atrasado (ou tem retorno mais próximo) aparece
primeiro. Essa função pura (`computeActionStatus` + `sortByPriority`) é o mesmo tipo
de código defensável na banca que `calculateRiskScore`: determinística, testável,
sem I/O.

## 4. Arquitetura

```
UI (pages/components)
   │  usa hooks (useAuth) e chama funções de acesso a dados
   ▼
Domain (src/domain) — regras de negócio puras, sem I/O
   │  calculateRiskScore, computeActionStatus/sortByPriority, suggestReturnDate,
   │  hasCriticalAlert, deriveCareInstructions…
   ▼
Firebase layer (src/firebase) — uma função por operação, por coleção
   │  patients.ts, visits.ts, consents.ts, photos.ts, professionals.ts,
   │  patientAccounts.ts, patientInvites.ts
   ▼
Firebase (Auth + Firestore + Storage)

Mobile layer (src/mobile) — só relevante para o app do paciente
   │  notifications.ts → @capacitor/local-notifications (agenda lembretes no celular)
```

A camada `domain/` é o núcleo defensável na banca: são funções puras e testáveis
(`calculateRiskScore`, `classifyRisk`, `computeActionStatus`, `sortByPriority`,
`suggestReturnDate`, `hasCriticalAlert`, `deriveCareInstructions`) que não dependem de
Firebase nem de React. Toda a lógica clínica e de priorização do app está ali,
isolada da UI — é também onde a linha entre "fixo" e "flexível" (seção 2) é
literalmente traçada em código: essas funções nunca recebem um parâmetro de
override do profissional, só dados de entrada.

### Estrutura de pastas

```
src/
├── main.tsx                  # bootstrap: Router + AuthProvider
├── App.tsx                   # definição de rotas (profissional + paciente)
├── firebase/
│   ├── config.ts             # inicialização do Firebase (lê .env.local)
│   ├── patients.ts           # CRUD de pacientes
│   ├── visits.ts             # CRUD de atendimentos + listVisitsByProfessional/latestVisitByPatient (base do painel)
│   ├── consents.ts           # termos de consentimento LGPD
│   ├── photos.ts             # upload de fotos (Storage) + metadados (Firestore)
│   ├── professionals.ts      # perfil do profissional autenticado
│   ├── patientAccounts.ts    # perfil da conta do paciente
│   └── patientInvites.ts     # geração/resgate do código de convite do paciente
├── context/
│   └── AuthContext.tsx       # login único para os dois papéis; cadastro separado por papel
├── domain/
│   ├── riskScore.ts          # Nível de Atenção — cálculo FIXO, não editável
│   ├── actionQueue.ts        # Prioridade de pacientes no Painel de Ação — cálculo FIXO
│   ├── returnSuggestion.ts   # sugestão de retorno por nível de atenção (editável pelo profissional)
│   ├── alertChecklist.ts     # checklist de sinais de alerta
│   ├── careInstructions.ts   # deriva orientações de cuidado a partir dos sinais observados
│   └── factories.ts          # objetos vazios (anamnese, sinais, checklist…)
├── mobile/
│   └── notifications.ts      # agenda lembretes locais no celular (Capacitor)
├── types/index.ts            # todos os tipos do domínio
├── lib/
│   ├── cpf.ts                # máscara e validação de CPF
│   └── pdf.ts                # geração do relatório em PDF (jsPDF)
├── components/
│   ├── layout/MobileShell.tsx   # casca única: topo + barra de abas inferior
│   ├── layout/AppShell.tsx      # MobileShell configurado para o profissional
│   ├── layout/PatientShell.tsx  # MobileShell configurado para o paciente
│   ├── ProtectedRoute.tsx       # guarda de rota do profissional
│   ├── ProtectedPatientRoute.tsx # guarda de rota do paciente
│   ├── RoleRedirect.tsx         # decide para onde mandar o usuário logado ("/")
│   └── ui/                      # YesNoToggle, RiskBadge, SignaturePad
└── pages/
    ├── auth/                 # Login, Register (profissional), ForgotPassword
    ├── Dashboard.tsx          # Painel de Ação (ver seção 3)
    ├── patients/              # PatientList, PatientForm, PatientRecord (prontuário), ConsentPage
    ├── visits/                 # NewVisitWizard + steps/ (Anamnese, Sinais observados, Fotos, Orientações, Resultado)
    └── patientApp/              # PatientLogin, PatientRegister, PatientHome, PatientCare, PatientHistory
```

### Por que um "wizard" de atendimento em vez de telas soltas?

Anamnese, sinais observados e classificação acontecem **na mesma consulta**, em
sequência, e a classificação depende dos dados de todas elas. Por isso
`NewVisitWizard.tsx` implementa cinco passos de um único fluxo
(`/app/patients/:id/visits/new`): Anamnese → Sinais observados → Fotos →
Orientações ao paciente → Resultado (nível de atenção). Isso evita dados órfãos (uma
anamnese sem sinais registrados, por exemplo) e reflete melhor o atendimento real.
Cada etapa continua sendo um componente isolado e testável (`pages/visits/steps/*`).

O passo "Sinais observados" (`StepSignals.tsx`) substitui deliberadamente um
mapeamento visual por região do pé por um checklist simples de sinais gerais (ferida,
rachadura, calo, micose, unha encravada, secreção, vermelhidão, dor) mais a
informação de qual pé foi afetado. A estrutura fica fixa e simples de auditar; a
complexidade de um mapa clicável por região não muda a classificação nem a decisão —
só adicionaria fricção à tela mais usada do fluxo.

O passo "Orientações ao paciente" é pré-preenchido automaticamente por
`domain/careInstructions.ts` a partir dos sinais observados (ex.: rachadura →
sugestão de hidratação 3x/dia) e da anamnese (diabetes → cuidados gerais), mas o
profissional sempre revisa, edita ou remove antes de salvar — é o exemplo mais claro
do modelo híbrido da seção 2: o sistema propõe, o profissional decide.

## 5. Modelagem do banco de dados (Cloud Firestore)

Coleções no nível raiz. Documentos clínicos (`patients`, `visits`, `photos`) são
filtrados por dono (`professionalId`) e, adicionalmente, liberados para leitura ao
paciente vinculado (`linkedUserId`) — ver `firestore.rules`:

| Coleção | Campo-chave | Descrição |
|---|---|---|
| `users` | id do doc = uid do profissional | Perfil profissional (nome, e-mail, registro) |
| `patientAccounts` | id do doc = uid do paciente | Perfil da conta do paciente no app mobile, vinculada a um `patientId` |
| `patientInvites` | `code` (id do doc) | Código de convite gerado pelo profissional; resgatado uma única vez no cadastro do paciente |
| `patients` | `professionalId`, `linkedUserId?` | Ficha cadastral do paciente. Exclusão é lógica (`isActive=false`) para preservar histórico |
| `visits` | `patientId`, `professionalId` | Um atendimento completo: anamnese + fatores de risco + diabetes + sinais observados + checklist de alerta + nível de atenção + conduta + **orientações de cuidado** + retorno |
| `consents` | `patientId`, `type: 'dados'\|'imagem'` | Termos LGPD assinados — registro imutável, um novo consentimento gera um novo documento |
| `photos` | `patientId`, `visitId`, `professionalId` | Metadados da foto; o arquivo em si fica no Firebase Storage |

Detalhes de cada campo estão em `src/types/index.ts` (única fonte de verdade dos tipos,
compartilhada por toda a aplicação).

### Por que `visits` concentra anamnese + sinais + checklist + score?

Cada atendimento é um documento imutável no tempo: ele representa "o que se sabia
sobre o paciente naquele dia". Separar em coleções diferentes exigiria juntar tudo de
novo por data toda vez que se quisesse montar a timeline, o PDF ou o Painel de Ação —
sem ganho real, já que nenhuma dessas partes é reaproveitada fora do contexto do
atendimento em que foi coletada.

## 6. Lógica do nível de atenção

Implementada em `src/domain/riskScore.ts`, função pura `calculateRiskScore` — parte
**fixa** do sistema, não editável pelo profissional:

| Sinal | Pontos |
|---|---|
| Possui diabetes | +20 |
| Histórico de ferida nos pés | +20 |
| Amputação prévia | +30 |
| Dormência / perda de sensibilidade | +20 |
| Formigamento frequente | +10 |
| Alteração de cor nos pés | +15 |
| Alteração de temperatura nos pés | +15 |
| Dificuldade de cicatrização | +20 |
| Ferida aberta (identificada nos sinais observados/checklist) | +30 |
| Secreção ou mau cheiro | +25 |
| Rachadura profunda | +10 |
| Calçado inadequado | +5 |
| Deformidade nos pés | +10 |
| Idade acima de 60 anos | +10 (calculado automaticamente a partir da data de nascimento) |
| Baixa mobilidade | +10 |
| Tabagismo | +10 |

Classificação: **0–20 → atenção baixa (verde)** · **21–50 → atenção média
(amarelo/laranja)** · **51+ → atenção alta (vermelho)**. Cada faixa carrega uma
mensagem explicativa em linguagem não clínica (ex.: *"Paciente apresenta múltiplos
sinais que exigem maior acompanhamento e atenção prioritária"*), e o aviso fixo
`ATTENTION_DISCLAIMER` — *"Esta classificação não é um diagnóstico..."* — aparece em
toda tela que mostra o resultado.

A sugestão de retorno (`domain/returnSuggestion.ts`) deriva diretamente do nível de
atenção (60–90 / 30 / 7–15 dias) e é sempre editável manualmente pelo profissional
antes de salvar o atendimento. A priorização de pacientes no Painel de Ação (seção 3)
é construída em cima dessa mesma data de retorno mais o nível de atenção.

## 7. Conta do paciente, convite e lembretes no celular

### Vínculo da conta (sem depender do e-mail já cadastrado)

O paciente não escolhe seu próprio vínculo — isso evitaria ambiguidade se dois
profissionais cadastrarem pacientes com o mesmo e-mail. Em vez disso:

1. No prontuário, o profissional clica em "Gerar código de convite"
   (`PatientRecord.tsx`), que cria um documento em `patientInvites` com um código de 6
   caracteres e o repassa ao paciente (verbalmente, papel, WhatsApp — fora do escopo do
   app).
2. O paciente instala o app, abre o cadastro (`PatientRegister.tsx`) e informa o código.
3. `AuthContext.registerPatient` cria a conta no Firebase Auth, resgata o convite
   (transação que marca `used=true` e impede reuso) e grava `patients.linkedUserId = uid`
   — é esse campo que as regras do Firestore usam para liberar a leitura dos próprios
   dados clínicos ao paciente.

### Orientações de cuidado → lembretes no celular

`domain/careInstructions.ts` converte sinais observados em orientações com uma
frequência diária sugerida (ex.: rachadura → "Hidratar os pés", 3x/dia). O
profissional revisa essa lista no passo "Orientações" do wizard antes de salvar o
atendimento; ela fica gravada em `visits.careInstructions`.

No app do paciente, a tela "Cuidados" (`PatientCare.tsx`) lê a última visita e mostra essa
lista. Na tela inicial (`PatientHome.tsx`), o botão "Ativar lembretes" chama
`mobile/notifications.ts`, que:

1. Pede permissão de notificação (`LocalNotifications.requestPermissions`).
2. Distribui os horários de cada orientação dentro do período 08h–21h (ex.: 3x/dia vira
   08h, 14h30, 21h) e agenda notificações **locais recorrentes diárias** com
   `@capacitor/local-notifications` — cada uma repete automaticamente todo dia no mesmo
   horário, sem precisar de servidor.
3. Ao ativar novamente (nova visita, nova orientação), cancela os lembretes antigos e
   reagenda os atuais.

**Importante para a demonstração no TCC:** notificações locais recorrentes só funcionam
no app compilado e instalado (`npx cap run android`, ou um APK gerado pelo Android
Studio) — no navegador (`npm run dev`), o botão "Ativar lembretes" mostra o aviso "só
funciona no aplicativo instalado no celular", porque não há como o navegador manter um
alarme em segundo plano depois que a aba fecha.

## 8. Geração de relatório PDF

`src/lib/pdf.ts` usa `jsPDF` para montar, no navegador (sem backend), um PDF com: dados
do paciente, data do atendimento, profissional responsável, queixa principal, resumo
da anamnese, sinais observados no exame, nível de atenção (pontuação e classificação),
fotos autorizadas (baixadas do Storage e embutidas como imagem), conduta, orientações,
sugestão de retorno e o aviso legal final. É disparado pelo botão "Gerar relatório
PDF" em cada item da timeline de evolução (`PatientRecord.tsx`).

## 9. LGPD

Dois termos independentes, cada um vira um documento próprio em `consents`:

1. **Dados pessoais e de saúde** — obrigatório existir antes de qualquer atendimento
   ser referenciado a um paciente com significado clínico (a UI não impede o cadastro
   sem ele, mas a tela de consentimento é acessível a um clique do prontuário).
2. **Uso de imagem** — condição obrigatória, verificada em tempo real
   (`hasActiveConsent`), para liberar a etapa de fotos do atendimento. Sem esse termo
   assinado, a etapa de fotos do wizard mostra apenas o aviso e um atalho para assinar o
   termo — o upload fica bloqueado.

Cada termo registra nome e CPF do paciente (snapshot no momento da assinatura), data,
checkbox de concordância e uma assinatura digital simples (canvas `SignaturePad.tsx`,
salva como PNG em base64 dentro do próprio documento).

## 10. Como rodar o projeto

### Pré-requisitos
- Node.js 20+ e npm
- Uma conta Google e um projeto no [Firebase Console](https://console.firebase.google.com/)
- Para compilar o app mobile: [Android Studio](https://developer.android.com/studio) (Android) — build para iOS exige um Mac com Xcode, não coberto aqui

### 1. Configurar o Firebase e iterar no navegador

`npm run dev` continua sendo a forma mais rápida de desenvolver — abre a mesma casca
mobile (`max-width: 520px`) dentro do navegador, então dá pra testar as duas telas de
login (profissional e paciente) e todo o fluxo sem precisar recompilar o app nativo a
cada mudança. É só para iteração: o produto final é o app instalado (passo 2).

```bash
# 1. Instalar dependências
npm install

# 2. Criar um projeto no Firebase Console e ativar:
#    - Authentication > Sign-in method > E-mail/senha
#    - Firestore Database (modo produção)
#    - Storage

# 3. Copiar as credenciais do app (Configurações do projeto > Seus apps > SDK setup)
copy .env.example .env.local
# preencher .env.local com VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN etc.

# 4. Publicar regras e índices (requer firebase-tools: npm i -g firebase-tools)
firebase login
firebase use --add           # selecione o projeto criado no passo 2
firebase deploy --only firestore:rules,firestore:indexes,storage

# 5. Rodar em desenvolvimento
npm run dev
```

O app inicia em `/login` (tela do profissional). Crie a primeira conta profissional pela
tela de cadastro, cadastre um paciente, gere um código de convite no prontuário dele e use
esse código em `/patient/register` para testar o cadastro do lado do paciente.

### 2. Compilar o app mobile de verdade (Android)

O projeto Android já está gerado em `android/` (via `@capacitor/android`) e serve tanto a
tela do profissional quanto a do paciente — é um único APK/app instalado. Para rodar num
emulador ou celular conectado:

```bash
# 1. Gerar o build web e sincronizar com o projeto nativo
npm run cap:sync

# 2. Abrir no Android Studio (permite rodar, depurar e gerar o APK)
npm run cap:open:android

# — ou, com um emulador/dispositivo já conectado, rodar direto pela linha de comando:
npm run cap:run:android
```

Sempre que o código em `src/` mudar, rode `npm run cap:sync` de novo antes de testar no
app — o Capacitor empacota o build de `dist/`, não o código-fonte. Build para iOS exige
um Mac com Xcode (`npx cap add ios`), não coberto neste ambiente de desenvolvimento.

## 11. Dependências principais

| Pacote | Uso |
|---|---|
| `react`, `react-dom`, `react-router-dom` | UI e roteamento (SPA) |
| `firebase` | Auth, Firestore, Storage (SDK client-side) |
| `jspdf` | Geração do relatório PDF no navegador |
| `date-fns` | Utilitários de data (formatação, cálculos auxiliares) |
| `uuid` | Geração do `visitId` no cliente antes de salvar o atendimento |
| `@capacitor/core`, `@capacitor/cli` | Empacotam o app web como app mobile nativo |
| `@capacitor/android` | Projeto Android gerado (pasta `android/`) |
| `@capacitor/local-notifications` | Lembretes locais recorrentes no celular do paciente |
| `typescript`, `vite` | Build e tipagem |

## 12. Telas implementadas

**Profissional:** Login · Cadastro profissional · Recuperar senha · **Painel de ação**
(quem precisa de atenção hoje, alto nível de atenção, atendimentos recentes) · Lista
de pacientes ordenada por prioridade · Cadastro/edição de paciente · Prontuário do
paciente (abas: dados — com geração de código de convite —, histórico/evolução,
fotos, consentimentos) · Termo LGPD (dados + imagem) · Wizard de novo atendimento
(anamnese adaptativa → sinais observados → fotos → orientações ao paciente →
resultado/nível de atenção) · Geração de relatório PDF a partir de qualquer
atendimento da timeline.

**Paciente:** Login · Cadastro com código de convite · Início (nível de atenção atual
em linguagem simples, próximo retorno, botão para ativar lembretes) · Cuidados (lista
de orientações com frequência diária) · Histórico (timeline dos atendimentos +
download do PDF).

Ambos os conjuntos de telas rodam dentro da mesma casca mobile (`MobileShell`) — nenhuma
tela do profissional usa mais layout de site desktop.

## 13. O que foi deliberadamente deixado de fora

Por decisão de escopo (ver seção 2), o sistema **não** implementa:

- Diagnóstico médico ou qualquer linguagem que sugira um.
- Lógica clínica complexa além da soma de pontos fixa e auditável.
- Personalização total do sistema pelo profissional (a estrutura de coleta e o
  cálculo são sempre os mesmos entre atendimentos e entre profissionais).
- Mapeamento visual complexo por região do pé — substituído por um checklist simples
  de sinais gerais (seção 4), que alimenta a mesma classificação com muito menos
  fricção na tela mais usada do fluxo.

## 14. Sugestões de melhorias futuras

- **Persistir os cuidados marcados como feitos** — hoje a marcação em "Cuidados" fica só
  no aparelho do paciente (`useState` local); não há como o profissional ver a adesão.
- **Comparação de fotos lado a lado** ao longo do tempo (hoje as fotos ficam listadas
  na aba "Fotos" e no PDF; falta uma visão de comparação temporal dedicada).
- **Assinatura do paciente vinculada por token** (o paciente assina no próprio celular via
  link temporário, em vez de assinar no aparelho do profissional).
- **Exportação do prontuário completo** (não só de um atendimento) em um único PDF.
- **Notificação de retorno via push** — hoje só as orientações de cuidado viram lembrete;
  a data de retorno em si não dispara nada, embora já determine a prioridade no Painel de Ação.
- **Build iOS** — o projeto Capacitor está pronto para `npx cap add ios`, mas isso exige
  um Mac com Xcode, não disponível neste ambiente de desenvolvimento.
- **Multiusuário por clínica** (hoje cada conta profissional só vê seus próprios
  pacientes; não há conceito de equipe/clínica compartilhando uma base).
- **Testes automatizados** para `domain/riskScore.ts` e `domain/actionQueue.ts` — são
  as funções mais fáceis de testar isoladamente (entrada/saída determinística) e as
  mais importantes de garantir corretas, por serem a parte fixa e não editável do sistema.

## 15. Avisos legais exibidos no app

- Junto ao nível de atenção: *"Esta classificação não é um diagnóstico. É uma
  ferramenta de apoio à organização do acompanhamento, construída a partir de sinais
  informados e observados — a decisão clínica é sempre do profissional."*
- Ao identificar um sinal de alerta: *"Atenção: sinal de alerta identificado.
  Recomenda-se orientar o paciente a buscar avaliação com profissional de saúde
  habilitado."*
- No rodapé do relatório PDF: *"Documento gerado para fins de acompanhamento
  podológico. Não substitui diagnóstico ou prescrição médica."*
