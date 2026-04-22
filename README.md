<p align="center">
  <img src=".github/assets/logo.webp" width="280px" alt="moVoice logo">
</p>

<p align="center">
  <strong>Dictate and convert speech into text.</strong>
</p>

<p align="center">
    <a href="https://github.com/topics/mobrowser">
      <img src="https://img.shields.io/badge/built%20with-mobrowser-blue.svg?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGlkPSJMYXllcl8xIiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA3Mi42IDgyLjEiPjxkZWZzPjxzdHlsZT4uc3Qwe2ZpbGw6I2ZmZn08L3N0eWxlPjwvZGVmcz48ZyBpZD0ibG9nb21hcmsiPjxwYXRoIGlkPSJQYXRoNSIgZD0iTS43IDYxLjFjLS40LS43LS42LTEuNS0uNy0yLjRWMjMuNWMwLTEuOSAxLjMtNC4yIDIuOS01LjNsLjMtLjJMMzMuMi43YzEuNi0uOSA0LjItMSA2LS4ybC4zLjIgMzAgMTcuNGMuOC41IDEuNSAxLjIgMiAybC4yLjRjLjUuOC44IDEuOC45IDIuN3YzNS4yYzAgMS0uMyAxLjktLjcgMi43bC0uMi40LS4yLjRjLS40LjctMSAxLjMtMS43IDEuOGwtLjMuMi0zMCAxNy40Yy0xLjYuOS00LjIgMS02IC4ybC0uMy0uMkwzLjEgNjMuOGMtLjgtLjUtMS41LTEuMi0yLTJsLS4yLS40LS4yLS40WiIgc3R5bGU9ImZpbGw6IzRmOTRmZiIvPjxnIGlkPSJHcm91cCI+PHBhdGggaWQ9IlNoYXBlNCIgZD0iTTU4LjIgMzYuNUg0NC43Yy0uNCAwLS44LjItMSAuNC0uMy4zLS40LjctLjQgMS4xdjEzLjRjMCAuNCAwIC44LjQgMS4xLjMuMy43LjQgMSAuNGgxMy41Yy40IDAgLjgtLjIgMS0uNC4zLS4zLjQtLjcuNC0xLjFWMzhjMC0uNCAwLS44LS40LTEuMS0uMy0uMy0uNy0uNC0xLS40Wm0tMi45IDEyLjFjMCAuNS0uMy45LS43LjloLTYuMmMtLjQgMC0uNy0uNC0uNy0uOXYtNy43YzAtLjUuMy0uOS43LS45aDYuMmMuNCAwIC43LjQuNy45djcuN1oiIGNsYXNzPSJzdDAiLz48cGF0aCBpZD0iUmVjdGFuZ2xlIiBkPSJNNDMuNiAyOS45aDE1Ljh2My44SDQzLjZ6IiBjbGFzcz0ic3QwIi8+PHBhdGggaWQ9IlBhdGg2IiBkPSJNMTIgMjkuNmg4bDUuNyAxNi43IDUuNi0xNi43aDcuNXYyMy4zaC01VjM1LjdoLS4xbC01LjkgMTcuMmgtNC41bC02LTE3LjJoLS4ydjE3LjJIMTJWMjkuNnoiIGNsYXNzPSJzdDAiLz48L2c+PC9nPjwvc3ZnPg==" alt="Built with MoBrowser"></a>
    <a href="https://github.com/topics/typescript">
      <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
    </a>
    <a href="https://github.com/topics/vite">
      <img src="https://img.shields.io/badge/Vite-007ACC?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
    </a>
    <a href="https://github.com/topics/react">
      <img src="https://img.shields.io/badge/React-007ACC?style=for-the-badge&logo=react&logoColor=white" alt="React"/>
    </a>
</p>

## Screenshots

<img src=".github/assets/board.webp" width="23%"></img> 
<img src=".github/assets/editing.webp" width="23%"></img> 
<img src=".github/assets/published.webp" width="23%"></img> 
<img src=".github/assets/settings.webp" width="23%"></img> 

## Features

- Press a shortcut to record; press again to stop and paste text into the focused window.
- Local speech-to-text recognition, no internet required.
- Menu bar tray with quick access to recording, settings, and history.
- Transcription history with audio playback and per-session metadata.

## Requirements

- Node.js 24+

## Running

To run the application, execute the following commands:

```bash
npm install

# Runs the application in the dev mode wit UI auto-reload enabled.
npm run dev
```

## Building

To build the application, run the following commands:

```bash
npm install

# Builds the application bundle for the platform it's launched on.
npm run build
```

If you need to sign and notarize the application, see the [.github/workflows/build.yml](.github/workflows/build.yml) 
for a ready-to-use script that works on macOS and Windows.

## Speech Recognition

moVoice transcribes audio either with a local Whisper model or the built-in macOS speech engine.

**Built-in macOS recognition** requires no setup and works out of the box. Select it in **Settings → Models** to use it without downloading anything.

**Local Whisper models** run entirely on-device with no internet connection. To use one:

1. Open **Settings → Models**
2. Choose a model and click **Download**
3. Once downloaded, the model becomes active automatically

Several models are available, trading off size, speed, and accuracy. The active model is clearly marked in the list.
