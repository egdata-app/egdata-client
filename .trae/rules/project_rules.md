1. Don't try to run commands to start the Tauri project as you can't check if it works or not.
2. Either only run the build (never the start command as it will conflict with the running `pnpm tauri dev` command) in the frontend for types/build working, or in `src-tauri` to run Rust commands.
3. For UI design, use always HeroUI.
4. Use, when possible, Tanstack tools, like query, store, etc...
