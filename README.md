# CRADA Playables Cocos Creator 2D Template

## Description

This project is a template for creating 2D playables based on Cocos Creator. The template includes ready-made scripts for adaptive layout, localization, audio management, and integration with various advertising platforms.

## Scripts Structure

### 🎮 Core Playable Scripts

#### `playableCore/`
- **`playableCore.ts`** - Main class for getting parameters from playable version
- **`super_html_playable.ts`** - Integration with Super HTML SDK for various advertising platforms (IronSource, Google, AppLovin, Moloco)
- **`AudioManager.ts`** - Audio manager with sound and music support, automatic volume control
- **`SoundMuter.ts`** - Component for sound management
- **`StoreOpener.ts`** - Opening app store through Super HTML SDK

### 🎨 Layout Scripts

#### `layout/`
- **`AdaptiveLayout.ts`** - Adaptive layout with support for different screen sizes and orientations
- **`AdaptiveGridCorrector.ts`** - Grid correction for adaptive design
- **`CanvasResizer.ts`** - Automatic canvas resizing when resolution changes
- **`DynamicUI.ts`** - Base class for dynamic UI elements
- **`FillImage.ts`** - Component for filling image to container size
- **`FitImage.ts`** - Component for fitting image to container while preserving proportions
- **`GameOrientation.ts`** - Game orientation management (portrait/landscape)

### 🌍 Localization

#### `localization/`
- **`LocalizationCore.ts`** - Main class for loading localized resources
- **`Localizator.ts`** - Handles localization event distribution
- **`LocalizedSprite.ts`** - Component for localized sprites
- **`GameState.ts`** - Stores basic scene components

### 🎨 Skin Management

#### `localization/`
- **`SkinsCore.ts`** - Main class for loading skinned resources (works similarly to localization)
- **`SkinsManager.ts`** - Manages skin events and provides access to skinned sprites
- **`SkinnedSprite.ts`** - Component for applying skins to sprites
- **`SkinChecker.ts`** - Component for checking if the current skin matches a given key. If the skin doesn't match, the object will be disabled. Supports inverted logic and multiple skin keys (comma-separated)

Skin management works technically similar to localization. The skin name is determined as follows:
- **In Editor**: Uses the `defaultSkin` field from the Main component
- **In Built Version**: Uses the `skin` field from the versions configuration

Skins are loaded from bundles named `skin_{skinName}` (e.g., `skin_default`, `skin_test1`).

### 🛠️ Utilities

#### Main utilities
- **`Utils.ts`** - Collection of useful functions:
  - Array operations (`first`, `last`, `isEmpty`, `rfind`)
  - Child object search (`getChildByPath`, `getChildByName`)
  - Component retrieval (`getComponentInChildByName`, `getComponentInChildByPath`)
  - Animations (`colorTween`, `opacityTween`)
  - Time operations (`timeToString`, `timeToStringDotted`)
  - Opacity management (`getOpacity`, `setOpacity`)
  - Local storage (`playerInfoGetObject`, `playerInfoSet`)
  - Math functions (`remap`, `getScreenAspect`)

- **`property.ts`** - Extended @property decorator for Cocos Creator


## License

Project created for use within CRADA.

---

# CRADA Playables Cocos Creator 2D Template

## Описание

Этот проект представляет собой шаблон для создания 2D плейаблов на базе Cocos Creator. Шаблон содержит готовые скрипты для адаптивной верстки, локализации, аудио-менеджмента и интеграции с различными рекламными платформами.

## Структура скриптов

### 🎮 Основные скрипты плейабла

#### `playableCore/`
- **`playableCore.ts`** - Основной класс для получения параметров из версии плейабла
- **`super_html_playable.ts`** - Интеграция с Super HTML SDK для различных рекламных платформ (IronSource, Google, AppLovin, Moloco)
- **`AudioManager.ts`** - Менеджер аудио с поддержкой звуков и музыки, автоматическим управлением громкостью
- **`SoundMuter.ts`** - Компонент для управления звуком
- **`StoreOpener.ts`** - Открытие магазина приложений через Super HTML SDK

### 🎨 Версточные скрипты

#### `layout/`
- **`AdaptiveLayout.ts`** - Адаптивная верстка с поддержкой различных размеров экрана и ориентаций
- **`AdaptiveGridCorrector.ts`** - Коррекция сетки для адаптивного дизайна
- **`CanvasResizer.ts`** - Автоматическое изменение размера канваса при изменении разрешения
- **`DynamicUI.ts`** - Базовый класс для динамических UI элементов
- **`FillImage.ts`** - Компонент для заполнения изображения по размеру контейнера
- **`FitImage.ts`** - Компонент для подгонки изображения в контейнер с сохранением пропорций
- **`GameOrientation.ts`** - Управление ориентацией игры (портретная/альбомная)

### 🌍 Локализация

#### `localization/`
- **`LocalizationCore.ts`** - Основной класс для загрузки локализованных ресурсов
- **`Localizator.ts`** - Занимается рассылкой локализационных эвентов
- **`LocalizedSprite.ts`** - Компонент для локализованных спрайтов
- **`GameState.ts`** - Хранит базовые компоненты сцены

### 🎨 Скин-менеджмент

#### `localization/`
- **`SkinsCore.ts`** - Основной класс для загрузки скиновых ресурсов (работает аналогично локализации)
- **`SkinsManager.ts`** - Управляет событиями скинов и предоставляет доступ к скиновым спрайтам
- **`SkinnedSprite.ts`** - Компонент для применения скинов к спрайтам
- **`SkinChecker.ts`** - Компонент для проверки соответствия текущего скина заданному ключу. Если скин не соответствует ключу, объект будет отключен. Сверяет содержит ли ключ текущего скина ключ указанный в скин чекере. Таким образом можно использовать 1 чекер для нескольких скинов. Например ключ чекера Halloween, а ключи скинов Halloween_1, Halloween_2,Original, Default и тп

Скин-менеджмент работает технически почти как локализация. Имя скина определяется следующим образом:
- **В редакторе**: Используется поле `defaultSkin` из компонента Main
- **В собранной версии**: Используется поле `skin` из конфигурации версий

Скины загружаются из бандлов с именами `skin_{имяСкина}` (например, `skin_default`, `skin_test1`).

### 🛠️ Утилиты

#### Основные утилиты
- **`Utils.ts`** - Коллекция полезных функций:
  - Работа с массивами (`first`, `last`, `isEmpty`, `rfind`)
  - Поиск дочерних объектов (`getChildByPath`, `getChildByName`)
  - Получение компонентов (`getComponentInChildByName`, `getComponentInChildByPath`)
  - Анимации (`colorTween`, `opacityTween`)
  - Работа со временем (`timeToString`, `timeToStringDotted`)
  - Работа с прозрачностью (`getOpacity`, `setOpacity`)
  - Локальное хранилище (`playerInfoGetObject`, `playerInfoSet`)
  - Математические функции (`remap`, `getScreenAspect`)

- **`property.ts`** - Расширенный декоратор @property для Cocos Creator



## Лицензия

Проект создан для использования в рамках CRADA.
