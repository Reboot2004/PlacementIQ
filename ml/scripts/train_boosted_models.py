"""
Pitch-aligned PlacementIQ training pipeline.

Architecture from the pitch deck:
- Stage 1: XGBoost institute-course prior score
- Stage 2: LightGBM student-level adjustment
- SHAP: ranked model drivers for auditability

Outputs:
- 3-month, 6-month, and 12-month placement probability models
- Expected salary model
- Saved SHAP explainers
- Metrics JSON
"""

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
import shap
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier


TARGETS = ["placed_3m", "placed_6m", "placed_12m"]

INSTITUTE_FEATURES = [
    "nirf_rank",
    "nirf_score",
    "institute_tier",
    "course",
    "placement_cell_index",
    "sector_demand_index",
    "historical_course_placement_rate",
]

STUDENT_FEATURES = INSTITUTE_FEATURES + [
    "normalized_cgpa_10",
    "backlogs",
    "internships",
    "certifications",
    "job_portal_activity",
    "interview_count",
    "loan_amount_lakh",
    "moratorium_days_left",
]

CATEGORICAL_FEATURES = ["institute_tier", "course"]


def preprocessor(features):
    numeric = [feature for feature in features if feature not in CATEGORICAL_FEATURES]
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )


def xgboost_prior():
    return XGBClassifier(
        n_estimators=260,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="logloss",
        random_state=42,
    )


def lightgbm_classifier():
    return LGBMClassifier(
        n_estimators=320,
        learning_rate=0.04,
        num_leaves=24,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        verbose=-1,
    )


def lightgbm_regressor():
    return LGBMRegressor(
        n_estimators=320,
        learning_rate=0.04,
        num_leaves=24,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        verbose=-1,
    )


def feature_names(pipeline):
    return pipeline.named_steps["prep"].get_feature_names_out().tolist()


def transformed_frame(pipeline, frame, features):
    transformed = pipeline.named_steps["prep"].transform(frame[features])
    return pd.DataFrame(transformed, columns=feature_names(pipeline), index=frame.index)


def add_stage1_priors(train_df, test_df, stage1_models):
    train_with_priors = train_df.copy()
    test_with_priors = test_df.copy()
    for target, model in stage1_models.items():
        prior_name = f"{target}_stage1_prior"
        train_with_priors[prior_name] = model.predict_proba(train_df[INSTITUTE_FEATURES])[:, 1]
        test_with_priors[prior_name] = model.predict_proba(test_df[INSTITUTE_FEATURES])[:, 1]
    return train_with_priors, test_with_priors


def classifier_metrics(model, frame, features, target):
    probabilities = model.predict_proba(frame[features])[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {
        "auc": round(float(roc_auc_score(frame[target], probabilities)), 4),
        "accuracy": round(float(accuracy_score(frame[target], predictions)), 4),
        "positive_rate": round(float(frame[target].mean()), 4),
    }


def train(args):
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(args.data)

    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df["placed_6m"])

    metrics = {
        "architecture": "Stage 1 XGBoost institute-course prior + Stage 2 LightGBM student adjustment + SHAP",
        "rows": int(len(df)),
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
        "targets": {},
    }

    stage1_models = {}
    for target in TARGETS:
        model = Pipeline([("prep", preprocessor(INSTITUTE_FEATURES)), ("model", xgboost_prior())])
        model.fit(train_df[INSTITUTE_FEATURES], train_df[target])
        stage1_models[target] = model
        metrics["targets"][target] = {"stage1_xgboost": classifier_metrics(model, test_df, INSTITUTE_FEATURES, target)}
        joblib.dump(model, output_dir / f"stage1_xgboost_{target}.pickle")

    train_df, test_df = add_stage1_priors(train_df, test_df, stage1_models)

    stage2_models = {}
    for target in TARGETS:
        features = STUDENT_FEATURES + [f"{target}_stage1_prior"]
        model = Pipeline([("prep", preprocessor(features)), ("model", lightgbm_classifier())])
        model.fit(train_df[features], train_df[target])
        stage2_models[target] = model
        metrics["targets"][target]["stage2_lightgbm"] = classifier_metrics(model, test_df, features, target)
        joblib.dump(model, output_dir / f"stage2_lightgbm_{target}.pickle")

        transformed = transformed_frame(model, train_df.sample(min(1000, len(train_df)), random_state=42), features)
        explainer = shap.TreeExplainer(model.named_steps["model"])
        shap_values = explainer.shap_values(transformed)
        joblib.dump(explainer, output_dir / f"shap_explainer_{target}.pickle")
        metrics["targets"][target]["shap_reference_rows"] = int(len(transformed))
        metrics["targets"][target]["shap_output_type"] = str(type(shap_values).__name__)

    salary_rows = train_df[train_df["actual_salary_lpa"] > 0].copy()
    salary_test_rows = test_df[test_df["actual_salary_lpa"] > 0].copy()
    salary_features = STUDENT_FEATURES + ["placed_6m_stage1_prior", "placed_12m_stage1_prior"]
    salary_model = Pipeline([("prep", preprocessor(salary_features)), ("model", lightgbm_regressor())])
    salary_model.fit(salary_rows[salary_features], salary_rows["actual_salary_lpa"])
    salary_predictions = salary_model.predict(salary_test_rows[salary_features])
    metrics["salary_model"] = {
        "model": "LightGBMRegressor",
        "mae_lpa": round(float(mean_absolute_error(salary_test_rows["actual_salary_lpa"], salary_predictions)), 4),
        "rmse_lpa": round(float(mean_squared_error(salary_test_rows["actual_salary_lpa"], salary_predictions) ** 0.5), 4),
        "test_rows": int(len(salary_test_rows)),
    }
    joblib.dump(salary_model, output_dir / "salary_lightgbm.pickle")
    salary_transformed = transformed_frame(salary_model, salary_rows.sample(min(1000, len(salary_rows)), random_state=42), salary_features)
    joblib.dump(shap.TreeExplainer(salary_model.named_steps["model"]), output_dir / "shap_explainer_salary.pickle")

    metadata = {
        "model_family": "XGBoost + LightGBM + SHAP",
        "stage1_features": INSTITUTE_FEATURES,
        "stage2_features": STUDENT_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "excluded_features": ["applicant_origin", "gpa_scale", "raw_gpa"],
        "gpa_feature_used": "normalized_cgpa_10",
        "targets": TARGETS,
        "salary_target": "actual_salary_lpa",
    }
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (output_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Train pitch-aligned PlacementIQ models.")
    parser.add_argument("--data", default="ml/data/processed/placementiq_training.csv")
    parser.add_argument("--output-dir", default="ml/models/pitch")
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
