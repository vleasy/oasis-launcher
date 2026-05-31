# Oasis Launcher Backend

## Стек
- **Node.js 22** + **TypeScript 5**
- **Fastify 5** — HTTP-сервер
- **Prisma 6** — ORM (PostgreSQL)
- **Redis 7** — кэширование (Mojang manifest)
- **Docker Compose** — PostgreSQL + Redis

## Быстрый старт

### 1. Запуск инфраструктуры (Docker)

```bash
docker compose up -d
```

Поднимает:
- PostgreSQL 16 (порт `5432`, БД `oasis_launcher`, юзер `oasis`/`oasis_pass`)
- Redis 7 (порт `6379`)

### 2. Настройка окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`, особенно:
- `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` — сгенерируйте случайные строки (минимум 32 символа)
- `CORS_ORIGIN` — список доменов фронтенда

### 3. Установка зависимостей и миграции

```bash
npm install
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Запуск dev-сервера

```bash
npm run dev
```

Сервер запустится на `http://localhost:3000`.
Swagger-документация: `http://localhost:3000/docs`.

### 5. Тесты

```bash
npm test
```

## Структура проекта

```
src/
├── config/           # env, prisma, redis
├── modules/
│   ├── auth/         # Регистрация, логин, JWT (auth.schema.ts, auth.service.ts, auth.routes.ts)
│   ├── user/         # Профиль (user.routes.ts)
│   ├── accounts/     # Игровые аккаунты (accounts.routes.ts)
│   └── versions/     # Версии: vanilla (Mojang API) + custom (сборки)
├── middleware/        # auth, admin, validate
├── utils/            # jwt, hash, logger, errors
├── app.ts            # Fastify сборка
└── server.ts         # Точка входа
tests/
├── auth.test.ts      # Auth эндпоинты (register, login, refresh, logout)
├── accounts.test.ts  # Game accounts CRUD
├── versions.test.ts  # Версии + health check
└── setup.ts          # Конфигурация тестового окружения
prisma/
└── schema.prisma     # Схема БД
uploads/versions/     # Файлы кастомных сборок
```

## API Endpoints

### Auth (`/api/auth`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | `/auth/register` | Регистрация (email + пароль) | — |
| POST | `/auth/login` | Вход (email + пароль) | — |
| POST | `/auth/refresh` | Обновление токенов | — |
| POST | `/auth/logout` | Выход (отзыв refresh токена) | Bearer |

### Profile (`/api/profile`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | `/profile` | Данные профиля | Bearer |
| PUT | `/profile` | Обновление профиля | Bearer |
| PUT | `/profile/password` | Смена пароля | Bearer |
| DELETE | `/profile` | Удаление аккаунта | Bearer |

### Game Accounts (`/api/accounts`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | `/accounts` | Список аккаунтов | Bearer |
| POST | `/accounts` | Добавить аккаунт | Bearer |
| DELETE | `/accounts/:id` | Удалить аккаунт | Bearer |
| PUT | `/accounts/:id/primary` | Сделать основным | Bearer |

### Versions (`/api/versions`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| GET | `/versions` | Объединённый список | — |
| GET | `/versions/vanilla` | Официальные версии Minecraft | — |
| GET | `/versions/vanilla/:id` | Детали официальной версии | — |
| GET | `/versions/vanilla/:id/download` | Редирект на JAR | — |
| GET | `/versions/custom` | Кастомные сборки (пагинация) | — |
| GET | `/versions/custom/:id` | Детали сборки | — |
| GET | `/versions/custom/:id/download` | Скачать ZIP | — |

### Admin (`/api/admin`)
| Метод | Путь | Описание | Auth |
|-------|------|----------|------|
| POST | `/admin/versions` | Загрузить сборку (multipart) | Admin |
| PUT | `/admin/versions/:id` | Обновить метаданные | Admin |
| DELETE | `/admin/versions/:id` | Удалить сборку | Admin |
