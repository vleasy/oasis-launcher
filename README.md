# Oasis Launcher

![Version](https://img.shields.io/badge/version-1.0.0-8b5cf6?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-33-47848f?style=flat-square&logo=electron&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?style=flat-square&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)
![Windows](https://img.shields.io/badge/Windows-x64-0078d4?style=flat-square&logo=windows&logoColor=white)
![PRs](https://img.shields.io/badge/PRs-welcome-f97316?style=flat-square)
![Minecraft](https://img.shields.io/badge/Minecraft-1.16.5--1.21-6b21a8?style=flat-square&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij48cGF0aCBmaWxsPSIjZmZmIiBkPSJNMzIgMkwxNiAxMHY0NGwxNiA4IDE2LThWMTBMMzIgMnptMCA0bDEyIDZ2MzZMMzIgNTRsLTEyLTZ2LTM2eiIvPjwvc3ZnPg==)
![Chat](https://img.shields.io/badge/chat-friends--online-ec4899?style=flat-square)

Кастомный Minecraft лаунчер под Windows. Electron + Fastify + PostgreSQL. Liquid Glass - тёмная тема, полупрозрачные панели, blur. Своя экосистема: регистрация, друзья, чат, встроенный мод для синхронизации друзей прямо на сервере.

## Фичи

### Управление версиями

Скачивание, установка и запуск Minecraft с 1.16.5 по 1.21. Выбор между Vanilla, Fabric и Forge. Менеджер сохраняет версии локально, не качает одно и то же дважды. Можно запускать несколько инстансов одновременно.

### Аккаунты

Два режима:
- **Офлайн** - никаких аккаунтов, ввёл ник - играешь. Для пираток и локальных тестов.
- **Microsoft** - полноценная лицензия через OAuth 2.0. Токены хранятся безопасно, работают refresh.

### Друзья и чат

Собственная система регистрации и входа через API на VDS. После регистрации ты получаешь:
- **Список друзей** - добавляй по нику, смотри кто онлайн
- **Статусы** - онлайн, отошёл, не беспокоить, невидимка
- **Чат в лаунчере** - общайся не заходя в игру. Сообщения приходят даже когда Minecraft свернут
- **Профили** - аватарка, статус, любимая версия, количество часов. Настоящий профиль, не просто ник
- **Приглашения в игру** - нажал "Пригласить" у друга - ему приходит уведомление с кнопкой подключиться

### Визуальный мод (Oasis Client) (В разработке)

Вшивается в любую версию автоматически при запуске из лаунчера. Fabric-мод делает две вещи:

**1. Синхронизация друзей на сервере**
В игре появляется интерфейс друзей поверх экрана. Ты видишь, кто из твоих друзей сейчас на этом сервере - даже если они не в пати. Можно писать в чат лаунчера не выходя из игры, приглашать напрямую. Серверу не нужны плагины - мод общается с API Oasis через твой аккаунт.

**2. Визуальные улучшения**
Собственный шейдерпак, оптимизированный для производительности. Плавное освещение, тени, SSAO, блум. Настраивается прямо из интерфейса мода (кнопка O в игре). Работает на Iris + Sodium, так что без тормозов.

Мод ставится одной галочкой в лаунчере при выборе версии.

### Drag-and-drop

Перетащи в лаунчер:
- `.jar` - установится как мод в текущий профиль
- `.zip` с шейдерами - появится в списке шейдерпаков
- `.zip` с ресурспаком - появится в ресурспаках

Работает мгновенно, без копирования в папки .minecraft.

### Локальный сервер в один клик

Кнопка "Open to LAN" прямо в лаунчере. Запускает сервер с твоими настройками, друзья подключаются через список. Никаких конфигов server.properties, никакого портфорвардинга.

### Автообновление

Лаунчер проверяет новую версию при старте. Если есть - скачивает и заменяет себя. Без танцев с установщиком. Обновления выходят через GitHub Releases.

### API и бэкенд

Вся социальная часть живёт на VDS:
- **Fastify** - REST API для регистрации, друзей, чата
- **PostgreSQL + Prisma** - пользователи, друзья, сообщения, профили
- **Redis** - онлайн-статусы, pub/sub для сообщений реального времени

Связка из коробки: `.env.example` -> `.env`, `npx prisma migrate dev`, и бэкенд готов.

## Планируется

- Discord Rich Presence
- Скриншоты друзей в ленте активности
- Встроенный браузер скинов
- Сборки (модпаки одним кликом)
- Серверный плагин Oasis для расширенной синхронизации (белый список через друзей)


## Установка

Скачай последний релиз со страницы [Releases](https://github.com/your-org/oasis-launcher/releases):

```
Oasis-Launcher-Setup-1.0.0.exe
```

Запусти установщик, введи ник и играй.

### Сборка из исходников

```bash
git clone https://github.com/your-org/oasis-launcher.git
cd oasis-launcher
npm install
npm run build
```

### Запуск бэкенда

```bash
cd oasis-api
cp .env.example .env
npx prisma migrate dev
npm run dev
```

## Стек

| Слой | Технология |
|------|-----------|
| Десктоп | Electron |
| Ядро | Node.js |
| API | Fastify |
| База | PostgreSQL + Prisma |
| Кэш/Realtime | Redis |
| Визуальный мод | Fabric + Iris + Sodium |
| Сборка | electron-builder |

## Лицензия

AGPL-3.0 - можно форкать и модифицировать, но исходники обязаны быть открыты, а авторство сохранено.
