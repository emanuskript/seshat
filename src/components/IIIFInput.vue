<template>
  <div class="seshat-hero">
    <!-- Moving icon background -->
    <div class="bg-icons" aria-hidden="true"></div>

    <!-- Theme Toggle -->
    <div class="theme-toggle">
      <button
        class="theme-btn"
        @click="cycleTheme"
        :title="`Current: ${currentTheme}`"
      >
        <Sun v-if="currentTheme === 'light'" :size="20" />
        <Moon v-else-if="currentTheme === 'dark'" :size="20" />
        <Contrast v-else :size="20" />
      </button>
    </div>

    <div class="hero-main">
      <!-- Banner -->
      <section class="banner-card" role="region" aria-label="Start panel">
        <div class="brand">
          <img src="@/assets/logo.png" alt="Seshat logo" />
        </div>

        <div class="ribbon">
          <span>Provide a link or upload an image</span>
        </div>

        <div class="form">
          <!-- IIIF Link Input -->
          <label class="field">
            <Link :size="18" aria-hidden="true" />
            <input
              type="text"
              v-model="iiifLink"
              :disabled="fileName !== ''"
              placeholder="Enter IIIF Link"
              aria-label="IIIF Link"
            />
          </label>

          <!-- Upload -->
          <div class="upload">
            <label class="upload-btn" for="upload-file">
              <Upload :size="18" aria-hidden="true" />
              <span>Upload Images / PDF</span>
            </label>
            <input
              id="upload-file"
              class="file-input"
              type="file"
              accept="image/*,application/pdf"
              multiple
              @change="handleFileUpload"
            />
            <span class="file-name" :class="{ 'muted': !fileName }">
              {{ fileName || 'Supports: JPG, PNG, PDF (multiple files allowed)' }}
            </span>
          </div>

          <!-- Start -->
          <button class="cta" :disabled="isUploading" @click="startAnnotating">
            <span>{{ isUploading ? 'Uploading...' : 'Start Annotating' }}</span>
            <ArrowRight :size="18" aria-hidden="true" />
          </button>
        </div>

      </section>
    </div>
  </div>
</template>

<script>
import { Link, Upload, ArrowRight, Sun, Moon, Contrast } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

export default {
  name: "SeshatInput",
  components: { Link, Upload, ArrowRight, Sun, Moon, Contrast },
  setup() {
    const { currentTheme, setTheme } = useTheme()

    const cycleTheme = () => {
      const themes = ['light', 'dark', 'high-contrast']
      const currentIndex = themes.indexOf(currentTheme.value)
      const nextIndex = (currentIndex + 1) % themes.length
      setTheme(themes[nextIndex])
    }

    return { currentTheme, setTheme, cycleTheme }
  },
  data() {
    return {
      iiifLink: "",
      fileName: "",
      uploadedFiles: [],
      isUploading: false,
    };
  },
  methods: {
    async _readResponsePayload(response) {
      const text = await response.text();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { rawText: text };
      }
    },
    _formatUploadError(payload, status) {
      const proxyError = typeof payload?.rawText === 'string' && payload.rawText.startsWith('Proxy error');
      if (proxyError) {
        return 'Backend is unreachable via /ml proxy. Start the Python backend on port 5001 and retry.';
      }
      if (payload?.error) {
        return typeof payload.error === 'string' ? payload.error : (payload.error.message || `Upload failed (${status})`);
      }
      if (payload?.message) return payload.message;
      if (payload?.rawText) return payload.rawText;
      return `Upload failed (${status})`;
    },
    handleFileUpload(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      this.uploadedFiles = files;
      this.fileName = files.length === 1
        ? files[0].name
        : `${files.length} files selected`;
      this.iiifLink = "";
    },
    isValidIIIFLink(link) {
      return !!link && link.startsWith("http");
    },
    _getBackendBase() {
      const fromWindow = typeof window !== 'undefined' ? window.__PHAROSIGHT_API_BASE__ : null;
      if (fromWindow) return String(fromWindow).replace(/\/+$/, '');
      return '/ml';
    },
    async startAnnotating() {
      if (!(this.iiifLink || this.uploadedFiles.length)) {
        alert("Please provide a valid IIIF link or upload file(s).");
        return;
      }
      if (this.iiifLink) {
        if (!this.isValidIIIFLink(this.iiifLink)) {
          alert("Please provide a valid IIIF link (must start with http…).");
          return;
        }
        this.$router.push({ name: "IIIFViewer", params: { source: this.iiifLink } });
        return;
      }
      // Upload files to backend
      this.isUploading = true;
      try {
        const fd = new FormData();
        for (const f of this.uploadedFiles) fd.append("image", f);
        const base = this._getBackendBase();
        const res = await fetch(`${base}/prepare`, { method: "POST", body: fd });
        const data = await this._readResponsePayload(res);
        if (!res.ok || !data.ok) {
          throw new Error(this._formatUploadError(data, res.status));
        }
        const key = `job:${data.job_id}`;
        sessionStorage.setItem(key, JSON.stringify(data));
        this.$router.push({ name: "IIIFViewer", params: { source: key } });
      } catch (err) {
        alert("Upload failed: " + err.message);
      } finally {
        this.isUploading = false;
      }
    },
  },
};
</script>

<style scoped>
/* --- Layout shell --- */
.seshat-hero {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: hsl(var(--background));
}

/* Theme toggle button */
.theme-toggle {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
}
.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
}
.theme-btn:hover {
  background: hsl(var(--muted));
  transform: scale(1.05);
}

/* --- Animated icon background --- */
.bg-icons {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='240' height='240' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%231b3e83' fill-opacity='.07'%3E%3Cpath d='M48 24h48v8H48zM32 88l24-14 24 14-24 14z'/%3E%3Ccircle cx='180' cy='40' r='10'/%3E%3Cpath d='M176 120h8v48h-8z'/%3E%3Cpath d='M84 160c0-11 9-20 20-20s20 9 20 20-9 20-20 20-20-9-20-20zm-36 44l30-8 8 30-30 8z'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 240px 240px;
  animation: scroll-bg 20s linear infinite;
  pointer-events: none;
  opacity: 0.5;
}
@keyframes scroll-bg {
  from {
    background-position: 0 0;
  }
  to {
    background-position: -240px -240px;
  }
}

.hero-main {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(780px, 92vw);
}

/* --- Banner --- */
.banner-card {
  --logo-height: clamp(180px, 26vw, 320px);
  --logo-bottom-trim: calc(var(--logo-height) * 0.18);
  position: relative;
  width: 100%;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 18px;
  box-shadow: var(--shadow-lg, 0 14px 40px rgba(0, 0, 0, 0.12));
  padding: 24px;
}

/* --- Logo --- */
.brand {
  position: absolute;
  bottom: calc(100% - var(--logo-bottom-trim));
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  margin: 0;
  padding: 0;
  line-height: 0;
  pointer-events: none;
}
.brand img {
  display: block;
  height: var(--logo-height);
  width: auto;
  margin: 0;
  padding: 0;
  filter: drop-shadow(0 8px 18px rgba(22, 45, 90, 0.2));
  transition: filter 0.2s ease;
}

/* Ensure logo visibility on dark backgrounds */
.dark .brand img {
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.5)) brightness(1.15);
}
.high-contrast .brand img {
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.4)) contrast(1.2);
}

.ribbon {
  margin: -18px auto 18px;
  width: min(70%, 520px);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-weight: 700;
  text-align: center;
  border-radius: 14px;
  padding: 10px 16px;
  letter-spacing: 0.2px;
  box-shadow: 0 6px 0 hsl(var(--primary) / 0.3) inset;
}

.form {
  display: grid;
  gap: 12px;
}

/* Input field */
.field {
  display: flex;
  align-items: center;
  gap: 10px;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  padding: 10px 12px;
}
.field svg {
  color: hsl(var(--primary));
  flex-shrink: 0;
}
.field input {
  flex: 1;
  font-size: 15px;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 6px 4px;
  color: hsl(var(--foreground));
}
.field input::placeholder {
  color: hsl(var(--muted-foreground));
}

/* Upload row */
.upload {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 0.3);
  border-radius: 10px;
  padding: 9px 14px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}
.upload-btn:hover {
  background: hsl(var(--primary) / 0.15);
  transform: translateY(-1px);
}
.file-input {
  display: none;
}
.file-name {
  color: hsl(var(--foreground));
  font-size: 14px;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-name.muted {
  color: hsl(var(--muted-foreground));
}

/* CTA */
.cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: 1px solid hsl(var(--primary));
  border-radius: 12px;
  padding: 12px 16px;
  font-weight: 700;
  letter-spacing: 0.2px;
  cursor: pointer;
  box-shadow: var(--shadow-md, 0 6px 18px rgba(0, 0, 0, 0.15));
  transition: transform 0.06s ease, filter 0.15s ease;
}
.cta:hover {
  filter: brightness(0.95);
}
.cta:active {
  transform: translateY(1px);
}

@media (max-width: 640px) {
  .hero-main {
    width: min(560px, 94vw);
  }

  .banner-card {
    --logo-height: clamp(140px, 42vw, 220px);
    padding: 16px;
  }

  .ribbon {
    width: 100%;
    font-size: 14px;
  }
}

@media (max-height: 760px) {
  .seshat-hero {
    overflow: hidden;
  }

  .banner-card {
    --logo-height: clamp(140px, 30vh, 220px);
  }
}
</style>
