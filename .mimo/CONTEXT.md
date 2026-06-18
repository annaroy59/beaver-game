# Бобёр — контекст проекта

## Структура файлов
```
index.html          — точка входа
src/game.js         — вся логика игры (~2400 строк)
src/styles.css      — стили
tests/test.js       — 59 тестов (106 assertions)
reviews/reviews.js  — данные отзывов
package.json        — devDependencies: jsdom, canvas
.mimo/CONTEXT.md    — этот файл
```

## Запуск тестов
```bash
cmd /c "node tests/test.js"
```
В PowerShell всегда через `cmd /c`.

## Ключевые константы
- `GRID = 12`, `TILE = 50` (canvas 600×600)
- Скорость: слайдер 1-10, конвертация `sliderToDelay(val) = 350 - val * 30` (мс)

## Архитектура

### Игровой цикл
- `requestAnimationFrame` + `tickAccumulator` (НЕ setInterval)
- `renderFrame(now)` — рендер, `gameTick()` — логика
- `renderLoop` запускается в `init()` (обязательно!)

### Состояние
```js
beaver[]           // массив сегментов [{x,y}, ...]
direction          // текущее направление {x,y}
nextDirection      // следующее направление
food               // позиция еды {x,y}
powerups[]         // [{type, x, y, born}, ...]
bonuses = Set()    // активные бонусы ('shield')
teleporters[]      // [{behind, entry, dir, born, color}, ...]
```

### Система бонусов
- `powerups[]` — массив объектов `{type: 'shield'|'magnet', x, y, born}`
- `bonuses = new Set()` — активные ('shield', 'magnet')
- `spawnPowerup(type)` — спавн с проверками (нет дубликатов, shield не спавнится с активным)
- Магнит и щит независимы — могут быть активны одновременно
- `magnetBorn` — таймер магнита (10 сек)
- В `update()` проверка кукурузы ДО проверки столкновений (иначе не естся при щите)

### ИИ (autoPlay)
- `getTarget()` — ближайшая цель (еда или бонус)
- `teleporterShortcut()` — проверяет телепорт-маршруты
- `aiTeleporterUsed` — лимит 1 визит/тик (защита от зацикливания)

### Глаза следят за мышью
- `mouseX/mouseY` — позиция мыши на canvas
- Условие: `!gameRunning || paused`
- `renderFrame` рисует `draw()` когда игра не запущена (иначе глаза не обновляются)
- Обработчик мыши — ВНЕ обработчика клавиатуры

### Настройки
- `sliderToDelay(val)` / `delayToSlider(delay)` — конвертация ползунка
- `speedLabel(delay)` — текстовые метки (Тормозной...Безумный)
- Preview-анимация в настройках: `drawSpeedPreview()`

### Хелп
- Циклическая карусель: Управление / Механики / Автоигра
- Canvas-анимации: `helpLog`, `helpTeleport`, `helpCorn`
- Запускаются при открытии, останавливаются при закрытии
- Сбрасывается на слайд 0 при открытии

## Тесты
- `setup()` — создаёт JSDOM, подменяет localStorage
- `teardown()` — закрывает window
- `pressKey(key)` — dispatch keyboard event
- `runGameTicks(n)` — вызывает `gameTick()` n раз
- `getGameState()` — возвращает текущее состояние
- Телепорты отключаются в тестах где проверяется поведение на границах

## Известные подводные камни
- Телепорты спавнятся в `init()` — могут мешать тестам на границах
- `spawnFood`/`spawnPowerup` — бесконечный цикл если сетка заполнена
- `born` обязателен в телепортах (иначе NaN в анимации)
- Проверка кукурузы ПЕРЕД столкновениями в `update()`
- `renderLoop` запускается в `init()` (не в `startGame`)
- Обработчик мыши — после keydown, не внутри него
