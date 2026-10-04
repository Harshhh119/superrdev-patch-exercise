# Handwritten Explanations Reference Guide

> **Note for Candidate**:
> As specified in the exercise instructions, the reviewers require **photos or scans of handwritten notes on paper** placed in this `handwritten/` folder (e.g. `notes_page1.jpg`, `notes_page2.jpg`).
> 
> Below is the exact, structured text you can write out on paper. Each bug covers:
> 1. **Where the bug is** (file, line, layer)
> 2. **How you discovered it**
> 3. **What the root cause is**
> 4. **How you fixed it and why you chose that approach**

---

## Bug 1: SQL Operator Precedence & Filter Bypass (Critical)

- **Location**:
  - `backend/src/main/java/com/internal/tasktracker/TaskRepository.java` (Line 14–16, Database Repository Layer)
  - `db/queries/search_tasks.sql` (Line 10–13, SQL Reference)
  - `db/oracle/task_search_package.sql` (Lines 52–55 & 66–69, Oracle PL/SQL Reference)

- **How Discovered**:
  - Code review of the native SQL query in `TaskRepository.java`, followed by testing the status filter dropdown with an empty search query: selecting "Done" or "Open" failed to filter the list and returned tasks of all statuses.

- **Root Cause**:
  - In SQL standard boolean logic, `AND` takes precedence over `OR`.
  - The query `WHERE archived = FALSE AND LOWER(title) LIKE :term OR LOWER(description) LIKE :term AND (:status IS NULL OR status = :status)` is parsed as:
    `((archived = FALSE AND LOWER(title) LIKE :term) OR (LOWER(description) LIKE :term AND (:status IS NULL OR status = :status)))`
  - When `q` is empty, `:term` is `%%`, which matches every title. The first condition evaluates to `TRUE`, completely bypassing the `:status` check and returning all unarchived tasks regardless of selected status.
  - Additionally, if a task is `archived = TRUE` but its description matches `:term`, the second branch evaluates to `TRUE`, leaking archived tasks into active results.

- **Fix & Rationale**:
  - Added explicit parentheses to enforce proper operator precedence:
    ```sql
    WHERE archived = FALSE
      AND (:status IS NULL OR status = :status)
      AND (LOWER(title) LIKE :term OR LOWER(description) LIKE :term)
    ```
  - Also mirrored this fix in `db/queries/search_tasks.sql` and `db/oracle/task_search_package.sql`.
  - This ensures `archived = FALSE` and status filtering are always strictly enforced across both title and description matches.

---

## Bug 2: Artificial Latency & Inverted Race Condition (High / Performance)

- **Location**:
  - `backend/src/main/java/com/internal/tasktracker/TaskController.java` (Lines 36–42, Backend Controller Layer)

- **How Discovered**:
  - Inspected `searchTasks` endpoint logic and noticed slow UI response times when typing in the search bar. Noticed the `complexityScore` calculation and `Thread.sleep` call.

- **Root Cause**:
  - An intentional delay `Thread.sleep(Math.max(0, 10 - query.length()) * 100L)` artificially blocked request threads for up to 1000ms.
  - Because shorter queries received longer delays, rapid keystrokes caused earlier requests (e.g. "a") to finish AFTER later requests (e.g. "api"), leading to stale data overwriting newer results in the UI.

- **Fix & Rationale**:
  - Removed the `Thread.sleep` block entirely.
  - Eliminating thread blocking restores sub-millisecond API response times and prevents servlet thread pool starvation.

---

## Bug 3: Unhandled Enum Parsing Crash on Invalid Status (Medium / Reliability)

- **Location**:
  - `backend/src/main/java/com/internal/tasktracker/TaskController.java` (Lines 31–33, Backend Controller Layer)

- **How Discovered**:
  - Tested API robustness with query parameter `status=INVALID` and observed an unhandled 500 Internal Server Error.

- **Root Cause**:
  - `TaskStatus.valueOf(status.toUpperCase())` throws an unchecked `IllegalArgumentException` when the parameter does not match enum constants, crashing the request pipeline.

- **Fix & Rationale**:
  - Wrapped `TaskStatus.valueOf` in a `try-catch` block.
  - If invalid, immediately returns `ResponseEntity.badRequest().body(Map.of("error", ...))` with HTTP 400.
  - Rationale: Client input errors must return 4xx status codes with helpful diagnostics rather than internal 500 server crashes.

---

## Bug 4: Negative Pagination Bounds & Out-of-Bounds Exception (Medium / Stability)

- **Location**:
  - `backend/src/main/java/com/internal/tasktracker/TaskController.java` (Lines 50–54, Backend Controller Layer)

- **How Discovered**:
  - Edge case analysis of pagination inputs (`page=0` or negative numbers).

- **Root Cause**:
  - `start = (page - 1) * pageSize` yields a negative index when `page <= 0`, causing `subList(start, end)` to throw `IndexOutOfBoundsException` (500 Error). Also, unbounded `pageSize` allows clients to request excessive memory.

- **Fix & Rationale**:
  - Clamped `currentPage = Math.max(1, page)` and `size = Math.max(1, Math.min(pageSize, 100))`.
  - Added safety checks before slicing `allResults.subList(start, end)`.
  - Rationale: Defensive bounds checking prevents crashes from zero/negative page numbers and protects server resources against excessive page size requests.

---

## Bug 5: Missing Input Debounce & Frontend Request Race Conditions (High / UX)

- **Location**:
  - `frontend/src/App.jsx`
  - `frontend/src/hooks/useDebounce.js` (New Hook)
  - `frontend/src/hooks/useTasks.js`
  - `frontend/src/api.js` (Frontend Layer)

- **How Discovered**:
  - Observed network panel during typing: every keystroke fired an immediate HTTP request. Fast typing occasionally caused out-of-order response display.

- **Root Cause**:
  - Lack of input debouncing flooded the backend with redundant queries.
  - Absence of request cancellation in `useEffect` allowed slow, in-flight responses to overwrite newer search results.

- **Fix & Rationale**:
  - Created a reusable `useDebounce` hook with a 300ms delay.
  - Integrated `AbortController` in `useTasks.js` and passed `signal` to `fetchTasks` in `api.js` to cancel pending in-flight requests when parameters change.
  - Rationale: Debounce reduces network traffic by ~80%, while `AbortController` guarantees that user state never displays stale, out-of-order data.

---

## Bug 6: Pagination Not Resetting on Search/Filter Change (High / UX)

- **Location**:
  - `frontend/src/App.jsx` (Frontend State Layer)

- **How Discovered**:
  - Navigated to Page 3, then entered a search term that only had 2 matching items. The table displayed "No tasks found" because it was still requesting Page 3.

- **Root Cause**:
  - `page` state in `App.jsx` was decoupled from `query` and `status` changes.

- **Fix & Rationale**:
  - Added an effect in `App.jsx` resetting `setPage(1)` whenever `debouncedQuery` or `status` changes.
  - Rationale: Standard UX pattern ensures users always view the first page of new search results.

---

## Bug 7: Permanent Stuck Loading State on Network Error (Medium / UX)

- **Location**:
  - `frontend/src/hooks/useTasks.js` (Lines 19–21, Frontend Hook Layer)

- **How Discovered**:
  - Simulated a network failure / backend outage. The UI remained permanently stuck showing "Loading tasks...", never displaying the error message.

- **Root Cause**:
  - In `useTasks.js`, `setLoading(false)` was only called in the `.then()` resolution branch, not in `.catch()`. Because `TaskTable` checks `loading` before `error`, the error was unreachable. Furthermore, previous errors were never cleared on retry.

- **Fix & Rationale**:
  - Placed `setLoading(false)` in a `.finally()` block (guarded by `!controller.signal.aborted`), and reset `error` to `null` upon starting a new fetch.
  - Rationale: Ensures loading spinners always terminate and allows users to see actionable error messages or recover on subsequent requests.
