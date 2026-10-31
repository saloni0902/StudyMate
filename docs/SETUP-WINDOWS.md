# Setting up StudyMate on a new Windows laptop

This guide starts from a completely empty Windows 10 or 11 laptop and ends with StudyMate running at http://localhost:5173. It takes about **30–45 minutes**, most of it waiting for downloads.

You need:
- an internet connection
- about **4 GB** of free disk space (PyTorch alone is about 1 GB)
- your free Gemini API key (or make a new one in step 7)

All commands below are typed in **PowerShell**: press Start, type `PowerShell`, and open **Windows PowerShell**. Don't use "Run as administrator" unless a step says so.

---

## 1. Install Node.js (runs the backend and frontend)

1. Go to https://nodejs.org and download the **LTS** version, Windows Installer (`.msi`, 64-bit).
2. Run it and keep the defaults. Make sure **"Add to PATH"** stays ticked.
3. You don't need the "Tools for native modules" option.
4. **Close and reopen PowerShell**, so it sees the newly installed programs, then check:

```powershell
node -v
npm -v
```

You should see a version number for each (Node 20 or newer).

## 2. Install Python 3.12 (runs the AI service)

1. Go to https://www.python.org/downloads/windows/ and download the latest **Python 3.12.x**, "Windows installer (64-bit)". 3.12 is the safest choice for PyTorch and FAISS on Windows; 3.13 also works.
2. Run it and, on the **first screen**, tick **"Add python.exe to PATH"**. Then click **Install Now**.
3. If it offers to **"Disable path length limit"** at the end, click it.
4. Close and reopen PowerShell, then check:

```powershell
py -3.12 --version
```

You should see `Python 3.12.x`.

> If typing `python` opens the Microsoft Store instead, go to **Settings → Apps → Advanced app settings → App execution aliases** and turn off the two "python" aliases. The `py` command above is not affected.

## 3. Install Git (recommended, to download the code)

1. Download from https://git-scm.com/download/win and install with the default options.
2. Reopen PowerShell and check:

```powershell
git --version
```

## 4. Allow npm to run in PowerShell

Windows blocks scripts by default, which stops `npm` with "running scripts is disabled on this system". Allow scripts for your user only:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Answer `Y`.

## 5. Get the project code

Put the project in a short path that **isn't synced by OneDrive**, for example `C:\Projects\StudyMate`. OneDrive syncs Desktop and Documents by default, and syncing the database and thousands of package files causes "file in use" errors.

**Option A: from GitHub** (once the project is on GitHub):

```powershell
mkdir C:\Projects
cd C:\Projects
git clone https://github.com/<your-account>/<your-repo>.git StudyMate
cd StudyMate
```

**Option B: from a zip of the project folder.** Copy the zip to the laptop and extract it to `C:\Projects\StudyMate`. The zip should **not** contain these folders. They are big, belong to the Mac, and are recreated in the next step:
- `node_modules` (in the root, `backend` and `frontend`)
- `ai-service\.venv`
- `backend\.data`
- the `.env` files, which hold your secret keys

Then open PowerShell in the folder:

```powershell
cd C:\Projects\StudyMate
```

## 6. Install everything

Run these two commands from the project folder:

```powershell
npm install
npm run setup
```

`npm run setup` does all of this for you:
- creates `backend\.env` and `ai-service\.env` with fresh secret keys
- installs the backend and frontend packages
- creates the Python environment `ai-service\.venv` using Python 3.12
- installs the AI packages: FastAPI, PyMuPDF, PyTorch, sentence-transformers, FAISS and the Gemini SDK

It takes **10–20 minutes**, mostly downloading PyTorch. It finishes with "Setup done".

## 7. Add your Gemini key

1. Get a key at https://aistudio.google.com/apikey (sign in with Google → **Create API key** → copy it).
2. Open the AI service settings:

```powershell
notepad ai-service\.env
```

3. Paste the key after `GEMINI_API_KEY=` with no spaces or quotes, then save and close Notepad:

```
GEMINI_API_KEY=your-key-here
```

## 8. Start StudyMate

```powershell
npm run dev
```

This starts all three parts together; their log lines are labelled `ai`, `api` and `web`.

**The first start is slower:**
- **The database engine downloads.** The backend fetches MongoDB for Windows (~100 MB) on its first run. Wait for `StudyMate API running on http://localhost:5050`.
- **The embedding model downloads.** The AI service fetches MiniLM (~90 MB) the first time it's needed.
- **Windows Firewall may ask** about Node.js, Python or mongod. Choose **Allow** for **Private networks**. Everything runs on your own laptop, so blocking is also fine, but allowing avoids repeated prompts.

When you see `Local: http://localhost:5173/`, open **http://localhost:5173** in your browser.

To stop everything, press **Ctrl + C** in PowerShell. To start again later:

```powershell
cd C:\Projects\StudyMate
npm run dev
```

## 9. Check it works

1. Sign up with any name, email and password. This is your local account; it isn't sent anywhere.
2. On the dashboard, create a subject, e.g. "Operating Systems".
3. Open **Documents** and upload `samples\operating-systems-notes.pdf` from the project folder. Wait for the green **Ready** badge.
4. Open **Chat** and ask "What are the four conditions for deadlock?" You should get an answer with a "p. 3" citation.

Optionally, run the automated tests:

```powershell
npm test
```

These never call Gemini, so they don't use your quota.

---

## Where your data lives on Windows

| What | Folder |
| --- | --- |
| Database (accounts, subjects, quizzes…) | `backend\.data\mongo` |
| Uploaded PDFs | `backend\uploads` |
| Extracted text and the vector search index | `ai-service\data` |
| Secret keys | `backend\.env`, `ai-service\.env` |

A new laptop starts with an **empty** database. To bring your Mac's accounts and notes along, stop StudyMate on both machines and copy those three data folders (`backend\.data`, `backend\uploads`, `ai-service\data`) from the Mac. Also make sure both `.env` files have the **same `AI_SERVICE_KEY`**, and use the same `JWT_SECRET` if you want the copied accounts to stay logged in. Otherwise, sign up again and re-upload your PDFs.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `node`, `npm`, `py` or `git` "is not recognized" | Close and reopen PowerShell. If it still fails, reinstall that program and make sure "Add to PATH" is ticked. |
| "running scripts is disabled on this system" | Run step 4 (`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`). |
| `npm run setup` says "Python 3.12+ was not found" | Install Python from step 2, reopen PowerShell, check `py -3.12 --version`. |
| PyTorch error `DLL load failed` or `c10.dll` when the AI service starts | Install the Microsoft Visual C++ Redistributable (x64) from https://aka.ms/vs/17/release/vc_redist.x64.exe, then restart the laptop. |
| `pip` fails with "path too long" | Run the Python installer again → **Modify** → enable long paths, or move the project to a shorter folder like `C:\SM`. |
| The dashboard shows "AI service: unreachable" | The `ai` part didn't start. Look for the red error in the `ai` lines of the PowerShell window. |
| "Port 5173 / 5050 / 8008 is already in use" | Another copy is still running. Close the other PowerShell window, or restart the laptop. |
| "The Gemini API key is not set" | Step 7, then stop (Ctrl + C) and run `npm run dev` again. |
| "Today's free Gemini limit has been used up" | The free tier allows about 20 requests a day on the main model. Wait for the reset time shown. |
| Antivirus deletes or blocks `mongod.exe` | Allow it. It's the MongoDB server that the backend downloads for its local database. |
