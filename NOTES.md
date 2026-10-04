# Notes

### Summary of Changes
- **Database / SQL & Oracle reference (`TaskRepository.java`, `search_tasks.sql`, `task_search_package.sql`)**: Fixed SQL operator precedence in `WHERE` clauses with explicit parentheses around status and title/description search. Restored status filtering on empty/title-matched queries and stopped archived tasks from leaking.
- **Backend Controller (`TaskController.java`)**: Removed the artificial `Thread.sleep` delay that bottlenecked queries. Added safe `TaskStatus` parsing returning HTTP 400 on invalid inputs. Clamped pagination parameters (`page >= 1`, bounded page size) to avoid `IndexOutOfBoundsException`.
- **Frontend (`App.jsx`, `useDebounce.js`, `useTasks.js`, `api.js`)**: Added a 300ms `useDebounce` hook to prevent keystroke flooding. Added `AbortController` in `useTasks` to prevent out-of-order race conditions. Ensured `loading` resets to `false` in `finally` upon errors, and reset pagination to page 1 when filters or query change.

### What I Chose Not to Change & Why
- **In-memory pagination in backend**: Retained in-memory slicing of `allResults` rather than introducing database-level `Pageable` to keep the patch focused and preserve existing API response contracts without unnecessary refactoring.
- **Global exception handlers / full CRUD**: Kept backend minimal and targeted to search/read without introducing unneeded boilerplate or endpoints.

### Biggest Remaining Risk
- **Unbounded in-memory query retrieval**: `searchTasks` loads all matching rows into memory before slicing. Under production data volume (100k+ tasks), this will cause significant database I/O, JVM memory pressure, and GC pauses. Moving to DB-level pagination (`LIMIT/OFFSET` or cursor pagination) is necessary for scale.

### Tools & AI Used
- Used Gemini to audit the codebase and draft the `useDebounce` hook. Manually refined the debounce delay to 300ms, architected the `AbortController` cancellation flow, and corrected the SQL operator precedence across H2 and Oracle artifacts.
