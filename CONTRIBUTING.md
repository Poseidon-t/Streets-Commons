# Contributing to SafeStreets

Thank you for your interest in contributing to SafeStreets! This project aims to make walkability data transparent and accessible to everyone.

## Core Principles

1. **Never add fake metrics** — Every data point must come from a verifiable source
2. **Be transparent** — Always document data sources and methodology
3. **Test thoroughly** — All changes must pass existing tests
4. **Keep it simple** — Prefer clarity over cleverness

## Getting Started

### Prerequisites

- Node.js >= 22.12.0
- npm

### Local Setup

```bash
# Clone the repo
git clone https://github.com/Poseidon-t/Streets-Commons.git
cd Streets-Commons

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server (5 OSM metrics work with no API keys)
npm run dev
```

Visit `http://localhost:5174` to see the app running.

### Optional: Backend Setup

For satellite-based metrics (tree canopy, thermal comfort):

```bash
cd api
npm install
cp .env.example .env
# Configure Google Earth Engine credentials (see SETUP.md)
npm run dev
```

### Optional: CV Backend Setup

For AI-powered sidewalk validation:

```bash
cd cv-backend
pip install -r requirements.txt
python main.py
```

## Development Workflow

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/your-feature`
3. **Make your changes** following the code style below
4. **Run tests**: `npm test`
5. **Run linting**: `npm run lint`
6. **Commit** with a clear message describing your change
7. **Push** to your fork and open a **Pull Request**

## Code Style

- TypeScript strict mode
- React functional components with hooks
- Tailwind CSS for styling (no inline styles or CSS modules)
- Services in `src/services/` for API/data fetching
- Utilities in `src/utils/` for calculations and helpers
- Types in `src/types/index.ts`

## What to Contribute

Check the [issues](https://github.com/Poseidon-t/Streets-Commons/issues) page for tasks tagged:

- `good first issue` — Great for newcomers
- `help wanted` — We'd love community help on these
- `enhancement` — Feature ideas we've validated

### Ideas We'd Welcome

- Translations (i18n support)
- Accessibility improvements (WCAG compliance)
- New verifiable metrics backed by open data
- Mobile responsiveness improvements
- Documentation improvements
- Performance optimizations

### What We Won't Merge

- Metrics without verifiable data sources
- Estimated or proxy data presented as real measurements
- Changes that break existing tests
- Large refactors without prior discussion (open an issue first)

## Adding a New Metric

If you want to add a new walkability metric:

1. **Open an issue first** describing the metric, its data source, and scoring methodology
2. The data source must be freely accessible and verifiable
3. Add the service in `src/services/`
4. Add scoring logic in `src/utils/metrics.ts`
5. Add the TypeScript types in `src/types/index.ts`
6. Write tests for the scoring logic
7. Update the README data sources table

## Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:ui

# E2E tests (requires Playwright)
npx playwright test
```

## Reporting Issues

- Use the [bug report template](https://github.com/Poseidon-t/Streets-Commons/issues/new?template=bug_report.md) for bugs
- Use the [feature request template](https://github.com/Poseidon-t/Streets-Commons/issues/new?template=feature_request.md) for ideas
- Include steps to reproduce for bugs
- Include the address/location if the issue is data-related

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.

## Questions?

Open a [discussion](https://github.com/Poseidon-t/Streets-Commons/discussions) or reach out in the issues.
