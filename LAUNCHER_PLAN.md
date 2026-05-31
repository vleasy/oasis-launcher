# План разработки: Кастомный Minecraft Launcher

## Обзор
Кроссплатформенный лаунчер Minecraft с авторизацией через Microsoft, управлением версиями, автоматической установкой Fabric/Forge и встроенным визуальным модом (шейдерпак). Интерфейс в стиле Liquid Glass.

## Стек технологий

### Frontend (UI)
- **Tauri v2** — десктопный фреймворк (Rust + WebView)
- **React 19 + TypeScript** — UI-логика
- **Framer Motion** — анимации Liquid Glass
- **Tailwind CSS 4** — стилизация
- **Jotai / Zustand** — управление состоянием

### Backend (ядро лаунчера)
- **Rust** — core-логика (скачивание, распаковка, запуск Minecraft)
- **Actix-Web / Axum** — REST API для внутренних нужд
- **SQLite (rusqlite)** — локальное хранилище (логин, настройки)

### Инструменты сборки
- **Tauri CLI** — сборка под Win/Mac/Linux
- **GitHub Actions** — CI/CD и автообновление
- **tauri-updater** — встроенный механизм автообновлений

## Архитектура

```
┌───────────────────────────────────────────┐
│            Tauri Shell (Rust)              │
│  ┌─────────────┐  ┌────────────────────┐  │
│  │  Tauri Core  │  │  Updater Module    │  │
│  │  (IPC bridge)│  │  (auto-update)     │  │
│  └──────┬──────┘  └────────────────────┘  │
│         │                                  │
│  ┌──────┴──────────────────────────────┐   │
│  │     Minecraft Manager (Rust)        │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │Version  │ │Mod     │ │Asset   │  │   │
│  │  │Manager  │ │Loader  │ │Manager │  │   │
│  │  │(Fabric/ │ │(Forge/ │ │(JSON,  │  │   │
│  │  │ Vanilla)│ │Fabric) │ │ JARs)  │  │   │
│  │  └────────┘ └────────┘ └────────┘  │   │
│  └─────────────────────────────────────┘   │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │   Auth Manager (MS OAuth 2.0)       │  │
│  │   (Device Code Flow + Token Store)   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │   Token Vault (безопасное хранение)  │  │
│  │   (Windows: Credential Manager,      │  │
│  │    macOS: Keychain, Linux: Secret    │  │
│  │    Service / keyring)                │  │
│  └──────────────────────────────────────┘  │
└───────────────────────────────────────────┘
                    │ IPC
┌───────────────────────────────────────────┐
│         WebView (React Frontend)           │
│  ┌──────────────────────────────────────┐  │
│  │      Liquid Glass UI (Framer + CSS)  │  │
│  │  ┌──────────┐ ┌────────┐ ┌───────┐  │  │
│  │  │Dashboard │ │Versions│ │Settings│  │  │
│  │  │ (Play)   │ │Manager │ │  +     │  │  │
│  │  │          │ │        │ │Shaders│  │  │
│  │  └──────────┘ └────────┘ └───────┘  │  │
│  └──────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

### Ключевые модули (Rust):

| Модуль | Описание |
|--------|----------|
| `minecraft-manager` | Скачивание версий Minecraft (метаданные + JAR + assets) |
| `mod-loader` | Установка Fabric / Forge (загрузка installer, patching) |
| `auth-manager` | OAuth 2.0 Device Code Flow через Microsoft |
| `token-vault` | Шифрованное хранение токенов через OS-native хранилище |
| `shader-manager` | Управление шейдерпаками (установка, авто-применение) |
| `updater` | Проверка и скачивание новой версии лаунчера |
| `process-manager` | Запуск Minecraft JVM-процесса с правильными аргументами |

## Интеграция визуального мода (шейдерпак)

### Вариант: Встроенный шейдерпак (оптимальный)

Лаунчер поставляется с предустановленным шейдерпаком (например, Complementary Shaders или собственный облегчённый вариант на основе Iris):

1. **Автоматическая установка Iris Shader Mod** (Fabric-based):
   - Скачивает `iris-{version}.jar` из репозитория
   - Помещает в `mods/` директорию инстанса
   - Качает шейдерпак (ZIP) в `shaderpacks/`
2. **Запуск Minecraft** с профилем Fabric + Iris
3. **Авто-применение** — при первом запуске шейдерпак выбирается программно через options.txt или через API мода (Iris language provider)

Для Sodium + Iris в комплекте:
- `sodium-{version}.jar` — оптимизация производительности
- `iris-{version}.jar` — загрузчик шейдеров
- `shaderpack.zip` — кастомный/каноничный шейдерпак

### Альтернатива: Ресурспак + OptiFine
Если пользователь выбирает Forge — ставится OptiFine, шейдерпак кладётся в `shaderpacks/` и выбирается через `optionsshaders.txt`.

## Этапы разработки

### Phase 1: Костяк (MVP) — 1–2 недели
1. **Инициализация Tauri + React проекта**
2. **Rust Minecraft Manager**: скачивание метаданных версии (`version_manifest.json`), JAR, assets
3. **Запуск Vanilla Minecraft**: формирование JVM-аргументов, запуск процесса
4. **Простой UI**: кнопка Play, список версий (загружается из manifest)
5. **Token Vault**: интеграция с OS-native хранилищем (seed)

### Phase 2: Авторизация и моды — 2 недели
6. **MS OAuth 2.0 Device Code Flow**: получение токена, refresh, хранение
7. **Mod Loader Manager**: установка Fabric Loader через installer JAR
8. **Mod Manager**: скачивание и установка модов (Sodium, Iris) из репозитория
9. **Shader Manager**: установка шейдерпака, авто-выбор в профиле

### Phase 3: Liquid Glass UI — 1–2 недели
10. **Дизайн-система Liquid Glass**: тёмная тема, blur, glass-эффекты, анимации
11. **Экран Dashboard**: крупная кнопка Play, статус, превью последней версии
12. **Экран Version Manager**: дерево версий, создание инстансов, настройка модов
13. **Экран Settings**: учётная запись, Java path, память, шейдерпак
14. **Framer Motion анимации**: переходы между экранами, skeleton loading, morphing

### Phase 4: Полировка и автообновление — 1 неделя
15. **Auto-updater**: Tauri updater с проверкой версии на GitHub Releases
16. **Обработка ошибок**: crash-логи, fallback при сбое загрузки, retry с exponential backoff
17. **Progressive Web-кэш**: кэширование метаданных версий и модов (SQLite)
18. **Сборка под все платформы**: MSI (Windows), DMG (macOS), AppImage/DEB (Linux)

## Требования к безопасности
- **Токены** — только в OS-native хранилище (не в файлах, не в localStorage)
- **MS OAuth** — Device Code Flow, refresh token с ротацией
- **Java-процесс** — запуск с изолированными аргументами, без инъекций
- **Автообновление** — проверка подписи apk/exe/dmg перед установкой
- **Скачивание** — проверка SHA-1 хешей ассетов Minecraft
- **CSP** — strict Content-Security-Policy в WebView

## Тестирование
- **Unit (Rust)**: `cargo test` — модули auth, version-manager, token-vault
- **Unit (React)**: vitest — компоненты UI, состояния
- **Integration**: Tauri mock IPC — связка Rust + React
- **E2E**: сквозной запуск Minecraft и проверка логов

## Потенциальные риски
- **Риск**: Блокировка Microsoft OAuth для десктопного клиента
  - *Митигация*: Регистрация приложения в Azure AD как Desktop/Mobile
- **Риск**: Изменение версий Fabric/Forge ломает установку
  - *Митигация*: Версионирование loader'ов, fallback на стабильные сборки
- **Риск**: Tauri WebView не поддерживает некоторые CSS-эффекты Liquid Glass
  - *Митигация*: Использовать backdrop-filter, fallback на градиенты
- **Риск**: Юридические ограничения распространения модов
  - *Митигация*: Лаунчер скачивает моды из официальных источников (CurseForge, Modrinth API), не включая моды в бинарник
