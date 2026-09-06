.DEFAULT_GOAL := help
PYTHON ?= .venv/bin/python
PIP ?= .venv/bin/pip

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-14s\033[0m %s\n", $$1, $$2}'

venv: ## Create the virtualenv and install Python dependencies
	python3 -m venv .venv
	$(PIP) install -r requirements.txt -r requirements-dev.txt

install: venv ## Install backend + frontend dependencies
	cd frontend && npm install

dev: ## Run API (:5000) and UI (:5173) together
	./dev.sh

api: ## Run only the Flask API
	$(PYTHON) run.py

ui: ## Run only the Vite dev server
	cd frontend && npm run dev

build: ## Build the front end into frontend/dist (served by Flask)
	cd frontend && npm run build

serve: build ## Build the UI and serve everything from Flask on :5000
	$(PYTHON) run.py

seed: ## Create the demo account with sample datasets and trained models
	$(PYTHON) scripts/seed_demo.py

test: ## Run backend + frontend test suites
	$(PYTHON) -m pytest tests -q
	cd frontend && npm test

test-api: ## Run only the backend tests
	$(PYTHON) -m pytest tests -q

test-ui: ## Run only the front-end component tests
	cd frontend && npm test

clean: ## Remove generated data (uploads, models, database)
	rm -rf instance frontend/dist

.PHONY: help venv install dev api ui build serve seed test test-api test-ui clean
