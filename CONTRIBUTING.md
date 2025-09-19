# Contributing to CanvasPal

Thanks for your interest in improving CanvasPal! This guide explains the project workflow and the expectations we have for contributors. If anything is unclear, feel free to open an issue or start a discussion before you begin coding.

---

## Code of Conduct

- Be respectful and inclusive. The project welcomes contributors of all backgrounds and experience levels.
- Assume positive intent and collaborate openly. If discussions get heated, take a step back and refocus on the problem.
- Report unacceptable behavior to the maintainers so it can be addressed quickly.

---

## Getting Set Up

1. **Fork** the repository and clone your fork locally.  
   ```bash
   git clone https://github.com/<your-username>/canvas-pal.git
   cd canvas-pal
   ```
2. **Install prerequisites** (see `README.md` for details):
   - Node.js 20+
   - Python 3.10+
   - Canvas API credentials and Perplexity API key
3. **Install dependencies**:
   ```bash
   npm install
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. **Environment variables**: create `.env.local` with the keys described in `README.md`.
5. **Run the stack**:
   ```bash
   npm run dev            # Next.js client + API
   .venv/bin/python api/tool.py  # Python bridge (in a separate shell)
   ```

---

## Branching & Workflow

- Create branches from `main` using the format `type/short-description` (for example, `feat/course-filters` or `fix/tool-error-handling`).
- Keep your branch focused on a single change set. Open separate branches for unrelated fixes.
- Sync with `main` frequently to avoid merge conflicts:
  ```bash
  git fetch origin
  git rebase origin/main
  ```

---

## Coding Guidelines

- **TypeScript & Next.js**: Favor functional components and hooks. Keep server/client boundaries clear.
- **Styling**: Reuse existing Tailwind utility tokens. Add new design tokens thoughtfully.
- **Python bridge (`api/tool.py`)**: Maintain consistent logging and error handling. Prefer helper functions over in-line logic for repeated patterns.
- Add concise comments only when intent is not obvious from the code.

---

## Testing & Validation

- Run the linter before pushing:
  ```bash
  npm run lint
  ```
- If your change touches the Python bridge, add or update unit tests (coming soon) or provide manual verification steps in the PR.
- Manually exercise user flows affected by your change (e.g., log in, kick off a study plan, verify streaming responses).
- Update documentation (`README.md`, `CONTRIBUTING.md`, in-app help) when behavior or configuration changes.

---

## Commit & PR Checklist

- Use [Conventional Commits](https://www.conventionalcommits.org/) where practical (`feat:`, `fix:`, `docs:`, etc.).
- Write clear, concise commit messages focused on _why_ the change is needed.
- Before opening a PR, ensure:
  - [ ] Branch is rebased on `origin/main`.
  - [ ] Linting passes locally.
  - [ ] New environment variables, scripts, or migrations are documented.
  - [ ] UI changes include screenshots or animated GIFs when relevant.
- In your PR description, include testing notes and any follow-up tasks.

---

## Reporting Issues & Feature Requests

- Search existing issues before filing a new one.
- When reporting a bug, include reproduction steps, expected vs. actual behavior, and logs if available.
- For feature ideas, explain the user problem first. Proposed solutions are welcome but not required.

---

## License

By contributing to CanvasPal you agree that your contributions will be licensed under the project’s [MIT License](LICENSE).

Thanks again for contributing—your help makes CanvasPal better for every student! 🚀

