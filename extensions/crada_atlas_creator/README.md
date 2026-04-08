# 🎨 CRADA Spritesheet Creator

Расширение для Cocos Creator 3.8.7 для создания спрайт-атласов (sprite sheets) с файлами plist.

## Возможности

- ✅ Загрузка множества изображений (drag-drop или через диалог)
- ✅ Упаковка спрайтов в один атлас с использованием алгоритма MaxRects Bin Packing
- ✅ Генерация plist в формате, совместимом с Cocos Creator
- ✅ Настраиваемый размер атласа (512, 1024, 2048, 4096)
- ✅ Power of Two - размеры степени двойки
- ✅ Trim Alpha - обрезка прозрачных пикселей
- ✅ Настраиваемый отступ между спрайтами
- ✅ Предпросмотр атласа в реальном времени
- ✅ Экспорт PNG и Plist отдельно или вместе

## Установка

1. Скопируйте папку `crada_atlas_creator` в директорию `extensions` вашего проекта Cocos Creator
2. В Cocos Creator откройте **Extension → Extension Manager**
3. Найдите расширение **crada_atlas_creator** и включите его
4. Перезапустите Cocos Creator если требуется

## Использование

1. Откройте панель: **Panel → crada_atlas_creator → Sprite Atlas Creator**
2. Перетащите изображения в область загрузки или нажмите "Выбрать файлы"
3. Настройте параметры:
   - **Макс. ширина/высота** - максимальный размер атласа
   - **Отступ** - расстояние между спрайтами (рекомендуется 2px)
   - **Имя атласа** - название выходных файлов
   - **Power of Two** - размеры будут степенью двойки (рекомендуется)
   - **Trim Alpha** - обрезка прозрачных пикселей
4. Нажмите **"🔧 Упаковать атлас"**
5. Экспортируйте результат:
   - **💾 Скачать PNG** - только текстуру
   - **📄 Скачать Plist** - только описание спрайтов
   - **📦 Скачать всё** - оба файла

## Формат Plist

Сгенерированный plist совместим с форматом TexturePacker (format 3) и поддерживается Cocos Creator 3.x:

```xml
<dict>
    <key>frames</key>
    <dict>
        <key>sprite_name</key>
        <dict>
            <key>textureRect</key>
            <string>{{x,y},{width,height}}</string>
            <key>spriteSize</key>
            <string>{width,height}</string>
            <key>spriteSourceSize</key>
            <string>{originalWidth,originalHeight}</string>
            <key>spriteOffset</key>
            <string>{offsetX,offsetY}</string>
            <key>textureRotated</key>
            <false/>
        </dict>
    </dict>
    <key>metadata</key>
    <dict>
        <key>format</key>
        <integer>3</integer>
        <key>size</key>
        <string>{atlasWidth,atlasHeight}</string>
        <key>textureFileName</key>
        <string>atlas.png</string>
    </dict>
</dict>
```

## Использование в Cocos Creator

После экспорта:

1. Поместите `.png` и `.plist` файлы в папку `assets` вашего проекта
2. Cocos Creator автоматически распознает их как SpriteAtlas
3. Используйте спрайты из атласа в своих сценах и компонентах

## Разработка

```bash
# Установка зависимостей
npm install

# Компиляция TypeScript
npm run build
```

## Структура проекта

```
crada_atlas_creator/
├── source/
│   ├── main.ts              # Главный модуль расширения
│   └── panels/
│       └── default/
│           └── index.ts     # Логика панели
├── static/
│   ├── template/
│   │   └── default/
│   │       └── index.html   # HTML шаблон
│   └── style/
│       └── default/
│           └── index.css    # CSS стили
├── dist/                    # Скомпилированные файлы
├── i18n/                    # Локализация
└── package.json
```

## Лицензия

MIT License © CRADA
