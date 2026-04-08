# Crada Super Builder

Extension for Cocos Creator for building and uploading playable projects.

## Features

### Build
- Standard Cocos Creator build
- Creating Super-html builds based on build by platforms, versions and languages
- Uploading builds to sftp showcase
- Can clean folders before build

### Playable validation
- Searches for `playableCore.getParam()` calls in TS scripts and checks if such parameters exist in versions
- Checks for audio callbacks for music start (for platforms where music can't start on first click) and music end (on packshot)
- Checks SuperHTML callbacks: game_end and download;
- Shows warning if build files will exceed 4.5 MB after build

### Project information
- Loads data from `versions.cjs`
- Shows project parameters (suffix, client, languages, etc.)
- Displays version list

## Requirements

- Cocos Creator 3.8.6+
- Node.js
- `versions.cjs` file in project


## Installation

1. Copy extension folder to extensions folder in project root
2. Copy build-templates folder to project root
3. Open panel through menu panel - crada-super-builder
4. Make sure `versions.cjs` file exists
5. Select required build stages
6. Press "Build"

**Important:** Project must follow naming and file structure rules

## Files

**Input:**
- TypeScript files in assets folder
- versions.cjs
- build-templates/crada_playable_2D.json

**Output:**
- build/web-mobile
- dist/sftp
- HTML files on server

## Usage Rules

- Usage is restricted to Crada staff members only

---

# Crada Super Builder

Расширение для Cocos Creator для сборки и загрузки playable-проектов.

## Что умеет

### Сборка
- Стандартная сборка Cocos Creator
- Создание на основе билда Super-html билдов по площадкам, версиям и языкам
- Загрухка билдов на sftp витрину
- Может очищать папки перед сборкой

### Валидация плеебла
- Ищет вызовы `playableCore.getParam()` в TS скриптах и сверяет наличие таких параметров в версиях
- Проверяет наличие аудио коллбеков для старта музыки (на случай тех площадок, где нельзя стартовать музыку на первом клике) и завершения музыки (на пакшоте)
- Проверяет SuperHTML коллбеки: game_end и download;
- Выводит предупреждение, если файлы после сборки будут весить больше 4.5 МБ

### Информация о проекте
- Загружает данные из `versions.cjs`
- Показывает параметры проекта (suffix, client, языки и т.д.)
- Отображает список версий

## Требования

- Cocos Creator 3.8.6+
- Node.js
- Файл `versions.cjs` в проекте

## Установка

1. Скопировать папку расширения в папку extensions в корне проекта
2. Скопировать папку build-templates в корень проекта
3. Открыть панель через меню panel - crada-super-builder
4. Убедиться, что есть файл `versions.cjs`
5. Выбрать необходимые этапы сборки
6. Нажать "Build"

**Важно:** Проект должен соблюдать правила нейминга и расположения файлов

## Файлы

**Входные:**
- TypeScript файлы в папке assets
- versions.cjs
- build-templates/crada_playable_2D.json

**Выходные:**
- build/web-mobile
- dist/sftp
- HTML файлы на сервере

## Правила использования

- Использование разрешается только штатным сотрудникам Crada

---

**Author:** Georgii Gorshenin  

**Year:** 2025
