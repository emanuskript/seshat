# Deploying the backend to Hugging Face Spaces

The repository now contains everything required to run the Flask backend inside
an HF Space (SDK **Python**). Follow the steps below to spin up the hosted API
and point the Vue frontend at it.

## 1. Prepare the repository

1. Commit the recent changes (root `requirements.txt`, `packages.txt`,
   `runtime.txt`, and `app.py`).
2. Push the branch to a Git remote you can access from Hugging Face.

## 2. Create a Space

1. Log in to [huggingface.co](https://huggingface.co) and click **New Space**.
2. Fill in:
   - **Space name**: e.g. `pharosight-backend`
   - **License/Visibility**: choose Public or Private as needed.
   - **Space SDK**: select **Python**.
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

## 4. Build expectations on HF

- `requirements.txt` is at the repo root and pulls in all Python dependencies.
- `packages.txt` installs the apt packages needed by OpenCV and Tesseract.
- `runtime.txt` pins Python 3.10 (the latest version currently supported by HF).
- `app.py` exposes the Flask app from `python-backend/simple_backend.py` and
  listens on the port provided by the platform (default 7860).

Once the files finish uploading/pushing, Space build logs will show:

1. System packages installing (from `packages.txt`).
2. `pip install -r requirements.txt`.
3. Execution of `python app.py` – when you see “Starting OCR-based scribe
   detection backend…” the API is ready.

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
- Each Space has limited RAM/CPU on the free tier. The backend now downsizes
  very large images automatically to avoid OOM crashes.
- Warm-up the Space by visiting `/health`: `curl https://<user>-<space>.hf.space/health`.

You can now replace the Render deployment with the HF Space endpoint.
