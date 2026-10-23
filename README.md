# SyncPosture

**SyncPosture** is a privacy-first, real-time posture and eye wellness Chrome Extension. Using on-device computer vision models, it tracks ergonomic posture (slouching, leaning, craning) and monitors blink frequency to prevent digital eye strain—gently notifying you with audio chimes and progressive focus blur when your posture or blink rate needs correction.

---

## 🚀 Key Features

* **Real-Time Ergonomic Posture Tracking:** Accurately classifies good posture, forward slouching, and lateral leaning using anatomical keypoints (head, ears, shoulders, torso).
* **Eye Strain & Blink Rate Monitoring:** Detects natural blinks via real-time Eye Aspect Ratio (EAR), tracking blinks per minute (BPM) over a rolling 60-second window to alert on eye fatigue.
* **Non-Intrusive Bio-Feedback:**
  * **Audio Chimes:** Subtle audio alerts when poor posture or low blink rates are sustained.
  * **Progressive Visual Blur:** Seamlessly blurs the active webpage tab when severe slouching persists, encouraging you to sit upright.
* **100% On-Device & Private:** Powered entirely by WebAssembly and local GPU acceleration. **Zero video feeds, frames, or biometric data ever leave your computer.**

---

## 🛠️ Technology Stack & Frameworks

* **UI Framework:** [React 19](https://react.dev/) (`react`, `react-dom` v19.2)
* **Routing:** [React Router v7](https://reactrouter.com/) (`react-router-dom` v7.18)
* **Build Tool / Bundler:** [Vite 8](https://vitejs.dev/) (`vite` v8.2 with `@vitejs/plugin-react`)
* **Language:** [TypeScript](https://www.typescriptlang.org/) (`~6.0`)
* **Computer Vision & ML:** [Google MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision) (`@mediapipe/tasks-vision`)
* **Icons:** [Lucide React](https://lucide.dev/) (`lucide-react`)
* **Linter:** [Oxlint](https://oxc.rs/)

---

## 🔬 How Detection Works (Under the Hood)

SyncPosture runs a client-side computer vision pipeline leveraging **Google MediaPipe Tasks Vision** via WebAssembly (WASM) and WebGL GPU acceleration.

### 1. Ears & Head Position (Posture Classification)
* **Model:** `pose_landmarker_lite.task` (MediaPipe 33-point Pose model).
* **Anatomical Keypoints:**
  * **Left Ear:** Landmark `7`
  * **Right Ear:** Landmark `8`
  * **Nose:** Landmark `0`
  * **Shoulders:** Left `11` & Right `12`
  * **Hips:** Left `23` & Right `24`
* **Posture Metrics Calculation (`src/lib/posture/`):**
  * **Head Center:** Derived from the midpoint of `LEFT_EAR` and `RIGHT_EAR` (and `NOSE`).
  * **Forward Head Offset:** Measures the horizontal displacement between the head center and the midpoint between the shoulders, normalized by shoulder width.
  * **Head-Torso Alignment Angle:** Computes the angular alignment between the head-to-shoulder vector and the torso vector (hips to shoulders).
  * **Lateral & Shoulder Tilt:** Measures spine deviation from the vertical axis and shoulder line tilt from horizontal to catch sideways leaning.

### 2. Face Detection & Tracking
* **Model:** `blaze_face_short_range.tflite` via `FaceDetector`.
* **Function:** Tracks spatial bounding boxes and face presence in the camera frame at a relaxed cadence to optimize GPU and CPU overhead.

### 3. Eyes & Blink Detection
* **Model:** `face_landmarker.task` (468/478-point 3D Face Mesh).
* **6-Point Eye Landmarks per Eye (`src/lib/blink/blinkDetector.ts`):**
  * **Left Eye:** Outer corner (`33`), Inner corner (`133`), Upper/Lower pairs (`160` $\leftrightarrow$ `144` and `158` $\leftrightarrow$ `153`).
  * **Right Eye:** Inner corner (`362`), Outer corner (`263`), Upper/Lower pairs (`385` $\leftrightarrow$ `380` and `387` $\leftrightarrow$ `373`).
* **Eye Aspect Ratio (EAR):**
  $$\text{EAR} = \frac{\|p_{\text{top1}} - p_{\text{bottom1}}\| + \|p_{\text{top2}} - p_{\text{bottom2}}\|}{2 \cdot \|p_{\text{corner1}} - p_{\text{corner2}}\|}$$
* **Temporal State Machine & Alerting:**
  * **Thresholds:** Drops below `0.19` (closure) and recovers above `0.24` (opening) with hysteresis to prevent jitter.
  * **Duration Filtering:** Valid blinks are accepted only between `50ms` and `400ms` (disqualifying squints or resting closed eyes).
  * **BPM Rolling Window:** Computes blinks per minute over a 60-second rolling window with an initial 30-second observation phase.
  * **Low Blink Alert:** Triggers when the rolling rate drops strictly below `10 BPM` and persists beyond the hold debounce time.

---

## 📁 Repository Structure

```text
syncPosture/
├── public/                 # Static assets, icons, and WASM binaries
├── src/
│   ├── components/         # Reusable UI components (Modals, Privacy notices, Alerts)
│   ├── extension/          # Chrome Extension Manifest V3 entry points
│   │   ├── background.ts   # Service worker managing state, alarms, and messaging
│   │   ├── content.ts      # Content script injecting blur overlays into web pages
│   │   └── types.ts        # Shared extension message definitions
│   ├── lib/
│   │   ├── audio/          # Web Audio chime synthesis
│   │   ├── blink/          # Eye Aspect Ratio (EAR) & temporal blink detector
│   │   ├── hooks/          # React hooks (useVisionFeed, usePostureCalibration)
│   │   ├── mediapipe/      # MediaPipe WASM pipeline and canvas renderers
│   │   └── posture/        # Posture geometry, thresholds, and classifier
│   ├── monitor/            # Dedicated live posture & camera monitor dashboard
│   ├── pages/              # Extension pages (Dashboard, Settings, Analytics, Demo)
│   └── popup/              # Extension popup UI
├── tests/                  # Unit and integration tests (Node.js test runner)
├── manifest.json           # Chrome Extension Manifest V3 configuration
├── vite.config.ts          # Vite multi-page build configuration
└── package.json
```

---

## 🚦 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [npm](https://www.npmjs.com/)

### Installation & Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ka-rthik-l/syncPosture.git
   cd syncPosture
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run local dev server (for UI and dashboard testing):**
   ```bash
   npm run dev
   ```

4. **Run unit & integration tests:**
   ```bash
   npm test
   ```

5. **Build the Chrome Extension:**
   ```bash
   npm run build
   ```
   The compiled extension will be output to the `dist/` directory.

---

## 🧩 Loading into Google Chrome

1. Build the production files:
   ```bash
   npm run build
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked**.
5. Select the `dist/` directory inside your `syncPosture` project folder.
6. The **SyncPosture** icon will now appear in your browser toolbar!

---

## 🔒 Privacy & Security

* **Camera Stream Stays Local:** The camera feed is processed directly in the browser's memory using WebAssembly.
* **No Cloud Transmission:** No images, frames, landmark coordinates, or biometric identifiers are stored remotely or transmitted over the network.
* **Zero Telemetry on Biometrics:** Everything runs offline and on-device.
