"""Catalogue of models ML Studio can train.

Each entry describes the estimator factory plus a small hyper-parameter schema
that the front end renders automatically, so adding a new algorithm here makes
it instantly available in the UI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

CLASSIFICATION = "classification"
REGRESSION = "regression"


@dataclass(frozen=True)
class HyperParam:
    name: str
    label: str
    type: str  # "int" | "float" | "select"
    default: Any
    min: float | None = None
    max: float | None = None
    step: float | None = None
    options: list[str] = field(default_factory=list)
    help: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "label": self.label,
            "type": self.type,
            "default": self.default,
            "min": self.min,
            "max": self.max,
            "step": self.step,
            "options": self.options,
            "help": self.help,
        }


@dataclass(frozen=True)
class Algorithm:
    key: str
    label: str
    task: str
    description: str
    factory: Callable[..., Any]
    hyperparams: list[HyperParam] = field(default_factory=list)
    supports_proba: bool = False

    def build(self, params: dict | None = None):
        params = params or {}
        clean: dict[str, Any] = {}
        for spec in self.hyperparams:
            value = params.get(spec.name, spec.default)
            if value is None or value == "":
                continue
            if spec.type == "int":
                value = int(value)
            elif spec.type == "float":
                value = float(value)
            clean[spec.name] = value
        return self.factory(**clean)

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "label": self.label,
            "task": self.task,
            "description": self.description,
            "hyperparams": [h.to_dict() for h in self.hyperparams],
        }


_TREE_PARAMS = [
    HyperParam("n_estimators", "Trees", "int", 200, 10, 1000, 10, help="How many trees in the forest."),
    HyperParam("max_depth", "Max depth", "int", 12, 1, 60, 1, help="Deeper trees fit more, risk overfitting."),
]

_BOOST_PARAMS = [
    HyperParam("n_estimators", "Boosting rounds", "int", 150, 10, 800, 10),
    HyperParam("learning_rate", "Learning rate", "float", 0.1, 0.01, 1.0, 0.01),
    HyperParam("max_depth", "Max depth", "int", 3, 1, 20, 1),
]


ALGORITHMS: dict[str, Algorithm] = {
    # ----------------------------- classification ------------------------
    "logistic_regression": Algorithm(
        key="logistic_regression",
        label="Logistic Regression",
        task=CLASSIFICATION,
        description="Fast, interpretable linear baseline. Great first model.",
        factory=lambda **kw: LogisticRegression(max_iter=2000, **kw),
        hyperparams=[HyperParam("C", "Regularisation (C)", "float", 1.0, 0.01, 100.0, 0.01)],
        supports_proba=True,
    ),
    "random_forest_classifier": Algorithm(
        key="random_forest_classifier",
        label="Random Forest",
        task=CLASSIFICATION,
        description="Robust ensemble of decision trees, strong out of the box.",
        factory=lambda **kw: RandomForestClassifier(random_state=42, n_jobs=-1, **kw),
        hyperparams=_TREE_PARAMS,
        supports_proba=True,
    ),
    "gradient_boosting_classifier": Algorithm(
        key="gradient_boosting_classifier",
        label="Gradient Boosting",
        task=CLASSIFICATION,
        description="Sequentially corrects mistakes — usually the accuracy leader.",
        factory=lambda **kw: GradientBoostingClassifier(random_state=42, **kw),
        hyperparams=_BOOST_PARAMS,
        supports_proba=True,
    ),
    "decision_tree_classifier": Algorithm(
        key="decision_tree_classifier",
        label="Decision Tree",
        task=CLASSIFICATION,
        description="A single readable tree of if/else rules.",
        factory=lambda **kw: DecisionTreeClassifier(random_state=42, **kw),
        hyperparams=[HyperParam("max_depth", "Max depth", "int", 8, 1, 40, 1)],
        supports_proba=True,
    ),
    "knn_classifier": Algorithm(
        key="knn_classifier",
        label="K-Nearest Neighbours",
        task=CLASSIFICATION,
        description="Predicts from the most similar rows in the training set.",
        factory=lambda **kw: KNeighborsClassifier(**kw),
        hyperparams=[HyperParam("n_neighbors", "Neighbours (k)", "int", 5, 1, 50, 1)],
        supports_proba=True,
    ),
    "svm_classifier": Algorithm(
        key="svm_classifier",
        label="Support Vector Machine",
        task=CLASSIFICATION,
        description="Finds the widest margin between classes. Good on small data.",
        factory=lambda **kw: SVC(probability=True, random_state=42, **kw),
        hyperparams=[
            HyperParam("C", "Regularisation (C)", "float", 1.0, 0.01, 100.0, 0.01),
            HyperParam("kernel", "Kernel", "select", "rbf", options=["rbf", "linear", "poly", "sigmoid"]),
        ],
        supports_proba=True,
    ),
    # ------------------------------- regression --------------------------
    "linear_regression": Algorithm(
        key="linear_regression",
        label="Linear Regression",
        task=REGRESSION,
        description="The classic straight-line fit. Transparent and quick.",
        factory=lambda **kw: LinearRegression(**kw),
        hyperparams=[],
    ),
    "ridge_regression": Algorithm(
        key="ridge_regression",
        label="Ridge Regression",
        task=REGRESSION,
        description="Linear regression with shrinkage — handles correlated features.",
        factory=lambda **kw: Ridge(random_state=42, **kw),
        hyperparams=[HyperParam("alpha", "Alpha", "float", 1.0, 0.001, 100.0, 0.001)],
    ),
    "random_forest_regressor": Algorithm(
        key="random_forest_regressor",
        label="Random Forest",
        task=REGRESSION,
        description="Ensemble of trees that captures non-linear relationships.",
        factory=lambda **kw: RandomForestRegressor(random_state=42, n_jobs=-1, **kw),
        hyperparams=_TREE_PARAMS,
    ),
    "gradient_boosting_regressor": Algorithm(
        key="gradient_boosting_regressor",
        label="Gradient Boosting",
        task=REGRESSION,
        description="Boosted trees, typically the most accurate tabular regressor.",
        factory=lambda **kw: GradientBoostingRegressor(random_state=42, **kw),
        hyperparams=_BOOST_PARAMS,
    ),
    "decision_tree_regressor": Algorithm(
        key="decision_tree_regressor",
        label="Decision Tree",
        task=REGRESSION,
        description="A single tree of rules predicting a number.",
        factory=lambda **kw: DecisionTreeRegressor(random_state=42, **kw),
        hyperparams=[HyperParam("max_depth", "Max depth", "int", 8, 1, 40, 1)],
    ),
    "knn_regressor": Algorithm(
        key="knn_regressor",
        label="K-Nearest Neighbours",
        task=REGRESSION,
        description="Averages the target of the closest training rows.",
        factory=lambda **kw: KNeighborsRegressor(**kw),
        hyperparams=[HyperParam("n_neighbors", "Neighbours (k)", "int", 5, 1, 50, 1)],
    ),
    "svr": Algorithm(
        key="svr",
        label="Support Vector Regressor",
        task=REGRESSION,
        description="Margin-based regression, effective on small tidy datasets.",
        factory=lambda **kw: SVR(**kw),
        hyperparams=[
            HyperParam("C", "Regularisation (C)", "float", 1.0, 0.01, 100.0, 0.01),
            HyperParam("kernel", "Kernel", "select", "rbf", options=["rbf", "linear", "poly", "sigmoid"]),
        ],
    ),
}

DEFAULT_ALGORITHM = {
    CLASSIFICATION: "random_forest_classifier",
    REGRESSION: "random_forest_regressor",
}


def algorithms_for(task: str) -> list[Algorithm]:
    return [a for a in ALGORITHMS.values() if a.task == task]


def get_algorithm(key: str) -> Algorithm | None:
    return ALGORITHMS.get(key)


def catalogue() -> dict:
    return {
        CLASSIFICATION: [a.to_dict() for a in algorithms_for(CLASSIFICATION)],
        REGRESSION: [a.to_dict() for a in algorithms_for(REGRESSION)],
    }
