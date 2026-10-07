# Stagehold: demo guide

A script for a live demo or a recorded walkthrough of about four minutes. Transactions on Studionet take 30 to 110 seconds each, so the plan below prepares the slow steps in advance and keeps the live part on what is worth watching: the panel deciding.

## 1. The story in one paragraph

Someone pays for a building they cannot stand in front of. Stagehold holds each stage's payment in a GEN escrow contract. The builder writes a short code on the finished work, photographs it, and a panel of GenLayer validators, each running its own model and chosen by the protocol, decides whether the stage is complete and the code is on the wall. A pass pays the builder when the result is final, even if the payer never touches the app.

## 2. Preparation (do this before the audience arrives)

| Item | Detail |
|---|---|
| Deployment | The site on Vercel (root directory `web`), or `npm run dev` in `web/` |
| Two browser profiles | One for the payer, one for the builder. Accounts are kept per browser, so separate profiles act as two people |
| A camera | A phone or laptop webcam, with permission granted. The camera requires HTTPS, which Vercel provides |
| A real wall | Chalk or a marker, and a wall or board that is part of the work. The code must be written on the work itself, large and clear, not on paper held up to the camera |
| An anchor photograph | One clear picture of the same site, taken beforehand |
| A funded job | Create and fund a job ahead of time (steps 3.1 and 3.2) so the live demo starts at the interesting part |

Tips for a reliable run:

- Use a two-word code such as `TREE BLUE`. Models read words far more reliably than random letters.
- Shoot in good light with the whole stage in frame. A dark or cropped frame is refused, which makes a good second demonstration of the panel being strict.
- Studionet allows about 30 requests a minute per client. Avoid clicking repeatedly while an action is in progress.

## 3. Walkthrough

### 3.1 Payer: create the job (prepared in advance)

1. Open `/builder` in the builder profile and copy the builder's address from the header chip.
2. Open `/payer` in the payer profile. Paste the builder's address, keep the 0.01 GEN attempt fee and the 30 day duration, and choose **Create job**.
3. Copy the builder link shown in the right column.

### 3.2 Payer: fund a stage and set the anchor (prepared in advance)

1. Tick **Roof**, set an amount such as 0.5 GEN, and choose the anchor photograph.
2. Choose **Deposit and fund**. The job panel now shows the amount held in escrow.

### 3.3 Live: issue the code (about 20 seconds)

1. In the payer profile, enter a code (or choose **Suggest two words**) and choose **Issue code**.
2. Say: the code is not a secret. It exists so the photograph is tied to this stage and this moment.

### 3.4 Live: register and shoot (about 30 seconds of work)

1. In the builder profile, open the job link. Choose **Register this browser** and **Add** attempt credits (this can be done in advance too).
2. Write the code on the wall. Choose **Start camera**, frame the whole stage with the code visible, and press the shutter.

### 3.5 Live: the panel decides (30 to 110 seconds)

1. Choose **Submit to the panel**. The activity bar shows the live consensus stage.
2. Say while waiting: five validators run different models; a photo tuned to one model does not carry over; text in the picture is scenery, not an instruction.
3. The result card shows three rows: stage complete, code written on the work, same site as the anchor ("not checked yet" while the site check is off). A pass shows **Accepted**.
4. The job panel then shows the stage **Paid** and the escrow back at 0 GEN once the result is final.

### 3.6 Optional: show it being strict

Take a second photograph with the code missing, or in poor light, and submit it. The panel answers "No" or "Unclear" and nothing is paid. One attempt fee is used.

### 3.7 Optional: the silent payer

On a separate **test job** (the **Advanced: test timing** option on the payer page, which gives a 40 second window), do not issue a code. In the builder profile choose **Request a code**, wait for the window, then **Unlock fallback code**. The builder gets a two-word code without the payer doing anything and can be paid the same way.

## 4. What to say about the limits

State these plainly; they are part of the design, not an afterthought.

- The web version cannot prove that a photograph came from a live camera. A gallery photo or a generated image looks the same to the contract. An attested mobile capture app is planned before real value is used.
- A photograph shows what is visible. It says nothing about title to the land, materials used or what is inside a wall.
- Studionet is a development network. Its GEN has no market value, and ordinary accounts are not credited, so payouts are shown through the contract's own balance.
- The panel has been tried on a small set of photographs and synthetic edits with a single model family. A study with real photographs and several model families is the next gate.
- Accounts are throwaway browser keys by default. A browser wallet can be connected from the account bar; that path was tested with a mock wallet, not a real MetaMask, so use the default accounts for a live demo.

## 5. If something goes wrong

| Symptom | Cause and remedy |
|---|---|
| "The validators could not agree" | The panel split and nothing was recorded or charged. Retake with better light or a clearer code and submit again |
| An action seems stuck | Wait: a judged transaction can take up to two minutes. The activity bar shows the stage the network reports |
| "network kept failing" | A transient network error; try again in a minute (Studionet rate limits at about 30 requests a minute) |
| The camera does not start | Camera permission or HTTPS missing. Allow the camera for the site |
| Fallback button disabled | The payer window has not passed yet. The page uses the job's own window (24 hours on a normal job, 40 seconds on a test job) |
| Code refused as not on the work | The code was over foliage or on a held-up sheet. Write it on a plain wall surface |
