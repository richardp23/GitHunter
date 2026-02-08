# PowerPoint Add-in + Netlify Web App Architecture

## Overview

This document describes an architecture where a **web app deployed on Netlify** controls a **PowerPoint JavaScript add-in running locally on a user’s machine**, without requiring direct network access to the user’s computer.

The recommended approach uses a **thin PowerPoint add-in** paired with a **cloud-hosted web app and serverless backend**, with the add-in polling for commands.

---

## Key Constraints

* PowerPoint add-ins:

  * Run inside an embedded browser environment
  * Can make **outbound HTTPS requests**
  * **Cannot accept inbound connections** from the internet
* Netlify-hosted apps:

  * Are publicly reachable
  * Support serverless functions (HTTP-based)
  * Do **not** support persistent WebSockets

**Result:**
The add-in must initiate all communication.

---

## Recommended Architecture (Pure Netlify)

### High-Level Diagram

```
[ Web App UI (Netlify) ]
            |
            v
[ Netlify Functions (API) ]
            ^
            |
[ PowerPoint Add-in (Local) ]
            |
            v
[ Office.js APIs ]
```

---

## Roles and Responsibilities

### PowerPoint Add-in

* Runs locally inside PowerPoint (Desktop or Web)
* Minimal UI or no UI
* Responsibilities:

  * Authenticate with backend
  * Register a session
  * Poll for commands
  * Execute commands using Office.js
  * Report success/failure

### Web App (Netlify Frontend)

* Primary user interface
* Responsible for:

  * User interactions
  * Defining desired presentation changes
  * Submitting commands to backend
  * Displaying execution status

### Netlify Functions (Backend)

* Central command authority
* Responsibilities:

  * Authentication
  * Session tracking
  * Command queueing
  * Returning commands to add-ins
  * Storing execution results

---

## Communication Model: Polling

### Why Polling?

Polling is the most reliable and firewall-friendly option:

* Works behind corporate firewalls
* No persistent connections required
* Fully supported by Netlify Functions
* Simple to implement and debug

---

## Command Flow

1. **Add-in starts**

   * Authenticates with backend
   * Registers a session (user + presentation)

2. **Add-in polls for commands**

   ```
   GET /.netlify/functions/commands?sessionId=abc123
   ```

3. **Backend responds**

   ```json
   {
     "commandId": "cmd-001",
     "action": "insertText",
     "payload": {
       "slideIndex": 1,
       "text": "Hello from Netlify"
     }
   }
   ```

4. **Add-in executes command**

   * Uses Office.js APIs
   * Applies changes in PowerPoint

5. **Add-in reports result**

   ```
   POST /.netlify/functions/command-result
   ```

6. **Backend marks command complete**

---

## Polling Strategy

Recommended defaults:

* Poll interval: **2–5 seconds**
* Exponential backoff on errors
* Immediate re-poll after executing a command

This provides near-real-time behavior without excessive load.

---

## Security Considerations

* Use OAuth or token-based auth
* Issue a session token when the add-in loads
* Scope commands to:

  * User
  * Session
  * Presentation
* All requests over HTTPS
* Validate command ownership on backend

---

## What This Architecture Enables

* Remote control of PowerPoint from a web app
* Complex UI without Office add-in limitations
* Centralized business logic
* Easier iteration and deployment
* Multi-device or collaborative scenarios (with session tracking)

---

## Limitations

* Backend cannot directly modify PowerPoint
* All PowerPoint changes must be executed by the add-in
* Polling introduces slight latency (usually acceptable)
* Netlify Functions are stateless (external storage needed for queues)

---

## Why This Is the Best “Pure Netlify” Option

| Criteria                | Polling on Netlify |
| ----------------------- | ------------------ |
| Works behind firewalls  | ✅                  |
| No extra infrastructure | ✅                  |
| Supported by Netlify    | ✅                  |
| Easy to reason about    | ✅                  |
| Real-time enough for UX | ✅                  |
| WebSockets required     | ❌                  |

---

## Summary

A **Netlify-hosted web app + polling PowerPoint add-in** is a clean, scalable, and production-ready architecture.

* Treat the add-in as a **PowerPoint driver**
* Treat Netlify as the **control plane**
* Keep Office.js logic thin and focused
* Let your web app do the heavy lifting

This pattern is widely used in professional PowerPoint automation tools and scales well as features grow.
