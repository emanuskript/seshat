# Deploying the backend to Hugging Face Spaces (Docker)

Hugging Face Spaces now runs this backend via a Docker container. Follow the
steps below to build and host the Flask API and then point the Vue frontend at
the new endpoint.

## 1. Prepare the repository

1. Commit the recent changes (`Dockerfile`, updated backend files, `app.py`, etc.).
2. Push the branch to a Git remote you can access from Hugging Face.

## 2. Create a Space

1. Log in to [huggingface.co](https://huggingface.co) and click **New Space**.
2. Fill in:
   - **Space name**: e.g. `pharosight-backend`
   - **License/Visibility**: choose Public or Private as needed.
   - **Space SDK**: select **Docker**.
3. Click **Create Space**.

## 3. Upload the backend

Option A – via Git push (recommended):

1. On the Space page, copy the Git command shown under “Use Git in your terminal”.
2. Add the Space as a new remote to this repository, e.g.:
   ```bash
   git remote add hf https://huggingface.co/spaces/<user>/<space-name>
   git push hf HEAD:main
   ```
   (Replace `<user>` and `<space-name>` with your values.)

Option B – manual upload:

1. Use the “Upload files” button inside the Space to upload the repository
   contents (including the `python-backend` folder) exactly as they exist here.

## 4. What happens during the build

- The Space reads `Dockerfile`, builds the image, installs apt dependencies
  (Tesseract/OpenCV libraries), installs Python packages from
  `python-backend/requirements.txt`, and copies the repository into `/app`.
- The container exposes port `7860` and launches `python app.py`, which in turn
  imports `python-backend/simple_backend.py` and starts the Flask server.
- When the logs show “Starting OCR-based scribe detection backend… Listening on
  http://0.0.0.0:7860”, the API is ready.

The public endpoint will be:

```
https://<user>-<space-name>.hf.space
```

The existing Flask routes are unchanged (`/health`, `/prepare`, `/analyze`, …),
so the analysis POST URL becomes:

```
https://<user>-<space-name>.hf.space/analyze
```

## 5. Point the Vue frontend at the new backend

Update your environment variables, e.g.:

```
VITE_PHAROSIGHT_API_BASE=https://<user>-<space-name>.hf.space
```

Then rebuild/restart the frontend dev server.

## 6. Operational notes

- Hugging Face Spaces provide ephemeral storage; the backend writes temporary
  files under `python-backend/static/runs`. These survive restarts but will be
  wiped if the Space is rebuilt.
- The Docker image ships with Tesseract and OpenCV system dependencies so OCR
-  features work out of the box. Runtime data (uploads, runs, PDFs) is written
  under `/tmp/pharosight-data`, which is writable on Hugging Face Spaces.
- Warm-up the Space by visiting `/health`: `curl https://<user>-<space>.hf.space/health`.

You can now rely on the Hugging Face Space endpoint for all backend traffic.
