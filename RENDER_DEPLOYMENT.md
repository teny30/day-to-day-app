# Deploying "Day to Day" on Render

This guide outlines how to easily deploy the **Day to Day** application on [Render](https://render.com). The project includes a pre-configured `render.yaml` (Blueprint) for 1-click infrastructure setup.

---

## Option 1: 1-Click Blueprint Deployment (Recommended)

1. **Push your code to GitHub / GitLab**.
2. Go to the [Render Dashboard](https://dashboard.render.com/) and log in.
3. Click the **New +** button in the top right and select **Blueprint**.
4. Connect your code repository.
5. Render will automatically read `render.yaml` and discover:
   - **Web Service**: `day-to-day-web` (Python application)
   - **Database**: `day-to-day-db` (Free-tier PostgreSQL instance)
   - **Environment Variables**: `DATABASE_URL` (automatically linked to the PostgreSQL instance) and `SECRET_KEY` (automatically generated).
6. Click **Apply**. Render will deploy your database and web service automatically!

---

## Option 2: Manual Web Service Setup

If you prefer to configure the Web Service manually on Render:

1. Click **New +** -> **Web Service**.
2. Connect your repository.
3. Configure the following settings:
   - **Name**: `day-to-day-web`
   - **Environment**: `Python 3`
   - **Region**: Select your preferred region (e.g. Oregon, Frankfurt, Singapore)
   - **Branch**: `main` (or your default branch)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --chdir todo_list app:app`
4. Under **Environment Variables**, add:
   - `PYTHON_VERSION`: `3.11.0`
   - `SECRET_KEY`: `your-random-secret-key-here` (or let Render generate one)
   - `DATABASE_URL`: *(Optional)* If using a PostgreSQL database, paste the External Database URL here. If left blank, the app defaults to SQLite.
5. Click **Create Web Service**.

---

## Pre-Configured Deployment Features

- **Automated Database Schema**: Database tables (`User`, `Task`) are automatically created when the app boots up (`db.create_all()`).
- **PostgreSQL & SQLite Dual Compatibility**: Automatically converts `postgres://` connection strings to `postgresql://` required by SQLAlchemy.
- **Production WSGI Server**: Uses `gunicorn` for high performance and stability in production.
- **PWA & Mobile Ready**: Fully compatible with ServiceWorkers and mobile PWA manifest standard.
