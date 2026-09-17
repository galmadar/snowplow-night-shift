import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  // Agent worktrees live under .claude/. Without this, their edits reload the
  // game being played on this server.
  server: { watch: { ignored: ['**/.claude/**'] } },
  test: { exclude: ['node_modules/**', '.claude/**', 'dist/**'] },
})
