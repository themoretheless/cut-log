# CutLog

Два инструмента для тех, кто режет листовой материал (фанеру, МДФ, акрил) на
ЧПУ или лазере:

- **Оптимизатор раскроя** — раскладка списка прямоугольных деталей по листам с
  минимумом отходов (гильотинная упаковка, учёт реза, поворот деталей).
- **Конструктор коробки** — параметрическая коробка на шип-паз (5 стенок,
  опциональные полки и скос), 3D-просмотр и экспорт SVG под лазер.

Двуязычный интерфейс (русский / английский). Работает целиком в браузере —
геометрия и упаковка считаются на клиенте, ничего не загружается на сервер.

[English README](README.md)

> **Лицензия:** пока нет. Без файла `LICENSE` код по умолчанию «все права
> защищены» — смотреть можно, легально переиспользовать нельзя.

## Возможности

**Оптимизатор раскроя**
- Гильотинная упаковка (полки / свободные прямоугольники) с учётом реза и
  поворота деталей.
- 9 стратегий (3 эвристики размещения × 3 порядка сортировки) плюс **Auto**:
  прогоняет все и берёт результат с минимумом листов, затем с лучшей
  эффективностью.
- Пресеты листов, перетаскивание деталей, сохранение в localStorage, горячие
  клавиши, статистика эффективности и SVG-раскладка по каждому листу.

**Конструктор коробки**
- Геометрия шип-паз из ширины/высоты/глубины, толщины материала, реза, размера
  шипа, числа полок и скоса.
- Живой 3D-вид сборки (explode, орбита, галерея деталей) на three.js.
- Экспорт SVG по детали и по листу под лазерную резку.

## Архитектура

```
crates/
  core/   cutter-core  — оптимизатор раскроя + модели данных (чистый Rust, тесты)
  ui/     cutter-ui    — рендер SVG-результата + палитра
  cli/    cutter-cli   — JSON из stdin -> JSON/SVG в stdout
  wasm/   cutter-wasm  — поверхность wasm-bindgen (optimize/optimize_sync)
frontend/              — Vue 3 + TypeScript + Vite + three.js
  src/box/geometry.ts  — геометрия коробки (пути, 3D, раскрой) — единый источник правды
scripts/               — golden-фикстуры геометрии коробки; заметки по бенчмаркам
```

**Оптимизатор раскроя** написан на Rust и собирается в WebAssembly.
**Геометрия коробки** живёт в TypeScript (`src/box/geometry.ts`) — замеры
показали, что там она быстрее; см. [scripts/bench/BENCH.md](scripts/bench/BENCH.md).

## Сборка и запуск

Нужны: Rust (с таргетом `wasm32-unknown-unknown`), `wasm-pack`, `wasm-opt`,
Node 22+.

```bash
# 1. Собрать WebAssembly
cd crates/wasm
wasm-pack build --target web --release
wasm-opt -Oz --enable-bulk-memory pkg/cutter_wasm_bg.wasm -o pkg/cutter_wasm_bg.wasm

# 2. Скопировать во фронтенд
cd ../..
cp -r crates/wasm/pkg/* frontend/wasm/
cp crates/wasm/pkg/cutter_wasm_bg.wasm frontend/public/

# 3. Дев-сервер
cd frontend
npm install
npm run dev
```

`npm run build` собирает статику в `frontend/dist`.

## CLI

Оптимизатор работает и как самостоятельный CLI, читающий JSON из stdin:

```bash
echo '{
  "sheet_width": 2440, "sheet_height": 1220, "kerf": 3, "strategy": "Auto",
  "pieces": [
    { "label": "Полка", "width": 500, "height": 400, "quantity": 3 },
    { "label": "Бок",   "width": 800, "height": 600, "quantity": 2 }
  ]
}' | cargo run -p cutter-cli
```

Печатает раскладку в JSON, либо SVG, если в запросе `"svg": true`.

## Тесты

```bash
cargo test --workspace      # юнит-тесты оптимизатора
cd frontend && npm test     # golden-тесты геометрии коробки (vitest)
```

## Деплой

GitHub Actions собирает wasm и фронтенд и публикует `frontend/dist` на
GitHub Pages (`.github/workflows/`).
