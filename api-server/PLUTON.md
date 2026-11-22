# PLUTON — local-only execution contract

## Hard rule

PLUTON must not call external AI providers or third-party APIs. There is no automatic provider fallback, no API-key lookup, and no paid inference path in the PLUTON server.

## Local engine

- 1,000 registered agent IDs: `pluton-agent-0001` through `pluton-agent-1000`
- 30 deterministic local code modules, shared by the agent profiles
- Up to 30,000 possible agent-to-code assignments
- Tasks execute only when explicitly included in a `fleet` payload
- Unknown agent IDs and unknown code IDs are rejected
- Each task result reports `networkCalls: 0`

The implementations are shared to avoid storing 30,000 duplicate programs. The number 30,000 is assignment capacity, not 30,000 separate running processes.

## Local server routes

- `GET /health` reports that the server is in local-only mode.
- `POST /api/pluton` accepts local PLUTON operations such as `health`, `listCodes`, `fleet`, `normalize`, `deduplicate`, `compare`, `validateTeams`, and `mockApi`.
- Unsupported routes return 404. Unsupported PLUTON operations do not trigger a network request.

## Verify locally

Run:

```sh
npm run test:pluton
npm run build
```

Do not mark this work complete until both commands pass in a real Node.js environment. A missing CI run is not a passing test.

## ZAMKA integrity card

- `POST /api/pluton` with `{ "operation": "zamka", "data": [...] }` runs the ZAMKA card locally.
- It checks duplicate records, missing IDs, and empty fields.
- Results remain `held` by default. A result is marked `released` only when `confirmed: true` is supplied and no integrity issues are found.
- ZAMKA is a deterministic integrity gate, not an AI model; it performs zero network calls.
- The current checks are a first implementation and should be expanded with competition-specific match/data rules as those rules are defined.

## ZLATKO AI MODE — потврдена основна архитектура

Овој список ги запишува точно наведените улоги и капацитети. Не претпоставува дека проектните капацитети веќе се физички активни.

- **ZLATKO AI MODE:** централен систем.
- **1.000 профили — Шефови:** секој профил е посебен шеф во организациската шема.
- **Ас треф (♣) — работни единици:** цел од **2.000.000 логички работни единици по профил**. За 1.000 профили, вкупната целна скала е **2.000.000.000 логички работни единици**.
- **Ас каро (♦) — веб-извори / компјутери:** цел од **200.000.000 компјутерски слотови**, со **1.000 веб-страници по компјутерски слот**. Теоретски вкупно: **200.000.000.000 доделувања на веб-страници**.
- **Ас пик (♠) — PLUTON код:** локално извршување на код; не е систем за надворешни API-повици. PLUTON не треба да повикува надворешни AI API-и или да прави автоматски fallback.
- **Џокер 1:** **100 AI агенти/фирми**, плус **30 обични модели** од тие фирми. Ова е наведена целна конфигурација; интеграциите и активноста на моделите не се тврдат како веќе поставени.
- **4 попа:** „чичиите штедачите“ — деталната функција останува неутврдена додека не се специфицира.
- **4 валета / џандари:** чуварите на проектот.
- **Карти 2–10:** работници.
- **Џокер 2:** намерно оставен празен за следната спецификација на сопственикот на проектот.

### Технички статус

Бројките се целни логички капацитети, не доказ дека се веќе обезбедени милијарди процеси, 200 милиони физички компјутери или активни пребарувања. Во тековниот код PLUTON има 1.000 регистрирани профили и 30 локални код-модули што се споделуваат меѓу профилите. Интернет-пребарувањето останува исклучено по дифолт, а листата на прегледани веб-домени сè уште не содржи 1.000 потврдени страници.

## Ас каро (♦) — веб-истражување

- Конфигурацијата ја запишува целта од 200.000.000 компјутерски слотови и 1.000 веб-страници по слот.
- Почетниот allowlist содржи само мал број познати официјални/референтни извори; не се тврди дека 1.000 страници веќе се проверени.
- Интернет и пребарување се исклучени по дифолт; потребна е посебна серверска имплементација што почитува robots.txt, ограничувања на брзина и приватност, без заобиколување на најави или paywall-и.
- DeepSeek останува опционална интеграциска точка, исклучена по дифолт. API-ключот, ако се вклучи, мора да биде runtime secret во серверската околина, никогаш во Git. Нема автоматски fallback.


## Ас каро? Не — АРСЕНАЛ ОРУЖЈЕ (web research)

- Ас треф има 4 работни линии × 500.000 работници = 2.000.000 логички работнички единици.
- Според барањето за АРСЕНАЛ ОРУЖЈЕ: секој работник добива 100 компјутерски слотови, а секој компјутерски слот има капацитет за 1.000 веб-извори. Теоретски капацитет: 200.000.000 компјутерски слотови и 200.000.000.000 веб-изворни доделувања.
- Овие бројки се проектен капацитет, не тврдење дека реалните компјутери или пребарувања се активни.
- Новата операција `arsenal` прикажува конфигурација, почетен список на прегледани домени и проверка дали домен е во allowlist.
- Почетниот allowlist содржи само мал број познати официјални/референтни извори. Не се тврди дека 1.000 веб-страници веќе се проверени. Останатите места мора да се пополнуваат и проверуваат пред да се дозволи автоматско преземање.
- Интернет и пребарување се исклучени по дифолт; потребна е посебна серверска имплементација што почитува robots.txt, ограничувања на брзина, приватност и без заобиколување на најави или paywall-и.
- DeepSeek е само опционална интеграциска точка, исклучена по дифолт. API-ключот, ако се вклучи, мора да биде runtime secret во серверската околина, никогаш во Git. Нема автоматски fallback.
- Самата конфигурација не отвора мрежни конекции и не создава/вклучува реални компјутери.
