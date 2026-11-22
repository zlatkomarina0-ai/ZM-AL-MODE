# PLUTON — local-only execution contract

## Hard rule

PLUTON must not call external AI providers or third-party APIs. There is no automatic provider fallback, no API-key lookup, and no paid inference path in the PLUTON server.

## Local engine

- 100 registered agent IDs: `pluton-agent-001` through `pluton-agent-100`
- 30 deterministic local code modules, shared by the agent profiles
- Up to 3,000 possible agent-to-code assignments
- Tasks execute only when explicitly included in a `fleet` payload
- Unknown agent IDs and unknown code IDs are rejected
- Each task result reports `networkCalls: 0`

The implementations are shared to avoid storing 3,000 duplicate programs. The number 3,000 is assignment capacity, not 3,000 separate running processes.

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

## ZLATKO AI MODE — карта-палуба на проектот

Ова е организациска спецификација според проектната шема; улогите што сè уште немаат дефинирани функции не се претпоставуваат или измислуваат.

- **4 попа:** „чичиите штедачите“ — записано според формулацијата на сопственикот на проектот; деталната функција треба да остане неутврдена додека не е специфицирана.
- **4 валета / џандари:** чуварите на проектот.
- **Карти 2–10:** работниците.
- **2 активни аса засега:** улогите што веќе се активни во тековната шема.
- **Остануваат 2 аса и 4 дами:** резервирани улоги; нивните одговорности сè уште не се специфицирани.
- **Ас треф (♣):** четири работни линии, секоја со целен капацитет од 500.000 логички работнички единици: дежурство, пребарување натпревари/податоци, грубо пеглање/спојување и фино пеглање/проверка. Ова е целна архитектура, не тврдење дека два милиона одделни процеси се веќе имплементирани.
- **ZAMKA:** локална контролна карта за проверка на интегритетот на податоците.
- **Основно правило:** локален код и споделена логика; нема надворешни AI API-повици или автоматски provider fallback.

Не се доделуваат нови улоги на преостанатите аса или дами без проектната спецификација.


## Ас каро (♦) — локална подготовка на натпревари

- Операцијата е достапна преку `POST /api/pluton` со `{ "operation": "karo", "data": [...] }`.
- Ги нормализира текстуалните полиња, ги отстранува дупликатите по ID/шифра или комбинација домашен/гостински тим и датум, и ги означува записите без двата тима.
- Го праќа кандидатскиот список низ локалната ZAMKA проверка. Резултатот останува `held` ако има дупликати/невалидни натпревари или ако не е дадено `confirmed: true`.
- Работи локално и враќа `networkCalls: 0`; не презема билтени од интернет и не повикува надворешен API.
- Ова е прва работна имплементација на ас каро како подготовка и проверка на натпреварувачки податоци. Специфични правила за лиги, шифри и сезонски формати треба да се додаваат како што се дефинираат.


## Ас каро? Не — АРСЕНАЛ ОРУЖЈЕ (web research)

- Дефиниран е капацитет: 100 работници × 100 логички компјутери = 10.000 логички компјутерски слотови.
- Секој слот е предвиден да користи регистар до 1.000 веб-извори; ова е капацитет, не 10 милиони физички компјутери или активни пребарувања.
- Новата операција `arsenal` прикажува конфигурација, почетен список на прегледани домени и проверка дали домен е во allowlist.
- Почетниот allowlist содржи само мал број познати официјални/референтни извори. Не се тврди дека 1.000 веб-страници веќе се проверени. Останатите места мора да се пополнуваат и проверуваат пред да се дозволи автоматско преземање.
- Интернет и пребарување се исклучени по дифолт; потребна е посебна серверска имплементација што почитува robots.txt, ограничувања на брзина, приватност и без заобиколување на најави или paywall-и.
- DeepSeek е само опционална интеграциска точка, исклучена по дифолт. API-ключот, ако се вклучи, мора да биде runtime secret во серверската околина, никогаш во Git. Нема автоматски fallback.
- Самата конфигурација не отвора мрежни конекции и не создава/вклучува реални компјутери.
