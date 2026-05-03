"""
PlacementIQ Training Pipeline v2
=================================

Architecture (same as pitch deck):
  - Stage 1: XGBoost institute-course prior score
  - Stage 2: LightGBM student-level adjustment
  - SHAP: ranked model drivers for auditability

Key improvements over v1:
  - Trains on v2 synthetic data that properly penalizes backlogs & low GPA
  - Validates that the trained model respects the penalty structure
  - Outputs models to BOTH pitch/ and pitch_pickle/ directories
  - Prints comprehensive validation report

Outputs:
  - 3-month, 6-month, and 12-month placement probability models
  - Expected salary model
  - Saved SHAP explainers
  - Metrics JSON with validation stats
"""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
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
    numeric = [f for f in features if f not in CATEGORICAL_FEATURES]
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )


def xgboost_prior():
    return XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.1,
        reg_lambda=1.0,
        eval_metric="logloss",
        random_state=42,
    )


def lightgbm_classifier():
    return LGBMClassifier(
        n_estimators=400,
        learning_rate=0.04,
        num_leaves=31,
        max_depth=5,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        verbose=-1,
    )


def lightgbm_regressor():
    return LGBMRegressor(
        n_estimators=400,
        learning_rate=0.04,
        num_leaves=31,
        max_depth=5,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.1,
        reg_lambda=1.0,
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


def validate_model(model, test_df, features, target_col):
    """Validate that the model properly penalizes backlogs and low GPA."""
    validation = {}

    # --- Backlog penalty validation ---
    no_backlog = test_df[test_df["backlogs"] == 0]
    high_backlog = test_df[test_df["backlogs"] >= 3]

    if len(no_backlog) > 10 and len(high_backlog) > 10:
        nb_prob = model.predict_proba(no_backlog[features])[:, 1].mean()
        hb_prob = model.predict_proba(high_backlog[features])[:, 1].mean()
        validation["backlog_penalty"] = {
            "no_backlog_avg_prob": round(float(nb_prob), 4),
            "high_backlog_avg_prob": round(float(hb_prob), 4),
            "delta": round(float(nb_prob - hb_prob), 4),
            "penalty_works": bool(nb_prob > hb_prob + 0.05),
        }

    # --- GPA penalty validation ---
    low_gpa = test_df[test_df["normalized_cgpa_10"] < 6.5]
    high_gpa = test_df[test_df["normalized_cgpa_10"] >= 8.0]

    if len(low_gpa) > 10 and len(high_gpa) > 10:
        lg_prob = model.predict_proba(low_gpa[features])[:, 1].mean()
        hg_prob = model.predict_proba(high_gpa[features])[:, 1].mean()
        validation["gpa_penalty"] = {
            "low_gpa_avg_prob": round(float(lg_prob), 4),
            "high_gpa_avg_prob": round(float(hg_prob), 4),
            "delta": round(float(hg_prob - lg_prob), 4),
            "penalty_works": bool(hg_prob > lg_prob + 0.05),
        }

    # --- NIRF tier validation ---
    tier1 = test_df[test_df["institute_tier"] == 1]
    tier3 = test_df[test_df["institute_tier"] == 3]

    if len(tier1) > 10 and len(tier3) > 10:
        t1_prob = model.predict_proba(tier1[features])[:, 1].mean()
        t3_prob = model.predict_proba(tier3[features])[:, 1].mean()
        validation["nirf_effect"] = {
            "tier1_avg_prob": round(float(t1_prob), 4),
            "tier3_avg_prob": round(float(t3_prob), 4),
            "delta": round(float(t1_prob - t3_prob), 4),
            "effect_exists": bool(t1_prob > t3_prob),
        }

    return validation


def save_models(model, path_pickle, path_joblib):
    """Save model to both .pickle and .joblib formats."""
    joblib.dump(model, path_pickle)
    # The API loads from pitch_pickle as .pickle, so we just save there


def train(args):
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Also save to pitch_pickle for the API
    pickle_dir = output_dir.parent / "pitch_pickle"
    pickle_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.data)
    print(f"Loaded {len(df)} rows from {args.data}")
    print(f"  placed_3m rate:  {df['placed_3m'].mean():.1%}")
    print(f"  placed_6m rate:  {df['placed_6m'].mean():.1%}")
    print(f"  placed_12m rate: {df['placed_12m'].mean():.1%}")
    print(f"  avg CGPA: {df['normalized_cgpa_10'].mean():.2f}")
    print(f"  avg backlogs: {df['backlogs'].mean():.2f}")
    print()

    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df["placed_6m"])

    metrics = {
        "architecture": "Stage 1 XGBoost institute-course prior + Stage 2 LightGBM student adjustment + SHAP",
        "data_version": "v2 (penalizes backlogs & low GPA)",
        "rows": int(len(df)),
        "train_rows": int(len(train_df)),
        "test_rows": int(len(test_df)),
        "data_stats": {
            "placed_3m_rate": round(float(df["placed_3m"].mean()), 4),
            "placed_6m_rate": round(float(df["placed_6m"].mean()), 4),
            "placed_12m_rate": round(float(df["placed_12m"].mean()), 4),
            "avg_cgpa": round(float(df["normalized_cgpa_10"].mean()), 2),
            "avg_backlogs": round(float(df["backlogs"].mean()), 2),
        },
        "targets": {},
    }

    # ===================================================================
    # STAGE 1: XGBoost institute-course priors
    # ===================================================================
    print("=" * 60)
    print("STAGE 1: Training XGBoost institute-course priors...")
    print("=" * 60)

    stage1_models = {}
    for target in TARGETS:
        print(f"\n  Training Stage 1 for {target}...")
        model = Pipeline([("prep", preprocessor(INSTITUTE_FEATURES)), ("model", xgboost_prior())])
        model.fit(train_df[INSTITUTE_FEATURES], train_df[target])
        stage1_models[target] = model

        test_metrics = classifier_metrics(model, test_df, INSTITUTE_FEATURES, target)
        metrics["targets"][target] = {"stage1_xgboost": test_metrics}
        print(f"    AUC: {test_metrics['auc']:.4f} | Accuracy: {test_metrics['accuracy']:.4f}")

        # Save to both directories
        joblib.dump(model, output_dir / f"stage1_xgboost_{target}.pickle")
        joblib.dump(model, pickle_dir / f"stage1_xgboost_{target}.pickle")

    # Add stage1 priors to DataFrames
    train_df, test_df = add_stage1_priors(train_df, test_df, stage1_models)

    # ===================================================================
    # STAGE 2: LightGBM student-level models
    # ===================================================================
    print("\n" + "=" * 60)
    print("STAGE 2: Training LightGBM student-level models...")
    print("=" * 60)

    stage2_models = {}
    for target in TARGETS:
        features = STUDENT_FEATURES + [f"{target}_stage1_prior"]
        print(f"\n  Training Stage 2 for {target}...")
        model = Pipeline([("prep", preprocessor(features)), ("model", lightgbm_classifier())])
        model.fit(train_df[features], train_df[target])
        stage2_models[target] = model

        test_metrics = classifier_metrics(model, test_df, features, target)
        metrics["targets"][target]["stage2_lightgbm"] = test_metrics
        print(f"    AUC: {test_metrics['auc']:.4f} | Accuracy: {test_metrics['accuracy']:.4f}")

        # Validate penalty structure
        validation = validate_model(model, test_df, features, target)
        metrics["targets"][target]["validation"] = validation

        if target == "placed_6m":
            print(f"\n    [STATS] Validation for {target}:")
            if "backlog_penalty" in validation:
                bp = validation["backlog_penalty"]
                status = "[OK]" if bp["penalty_works"] else "[FAIL]"
                print(f"      {status} Backlog penalty: 0 backlogs={bp['no_backlog_avg_prob']:.1%}, "
                      f"3+ backlogs={bp['high_backlog_avg_prob']:.1%}, Delta={bp['delta']:.1%}")
            if "gpa_penalty" in validation:
                gp = validation["gpa_penalty"]
                status = "[OK]" if gp["penalty_works"] else "[FAIL]"
                print(f"      {status} GPA penalty: <6.5={gp['low_gpa_avg_prob']:.1%}, "
                      f">=8.0={gp['high_gpa_avg_prob']:.1%}, Delta={gp['delta']:.1%}")
            if "nirf_effect" in validation:
                ne = validation["nirf_effect"]
                status = "[OK]" if ne["effect_exists"] else "[FAIL]"
                print(f"      {status} NIRF effect: Tier 1={ne['tier1_avg_prob']:.1%}, "
                      f"Tier 3={ne['tier3_avg_prob']:.1%}, Delta={ne['delta']:.1%}")

        # Save models
        joblib.dump(model, output_dir / f"stage2_lightgbm_{target}.pickle")
        joblib.dump(model, pickle_dir / f"stage2_lightgbm_{target}.pickle")

        # SHAP explainer
        sample = train_df.sample(min(1000, len(train_df)), random_state=42)
        transformed = transformed_frame(model, sample, features)
        explainer = shap.TreeExplainer(model.named_steps["model"])
        shap_values = explainer.shap_values(transformed)
        joblib.dump(explainer, output_dir / f"shap_explainer_{target}.pickle")
        joblib.dump(explainer, pickle_dir / f"shap_explainer_{target}.pickle")
        metrics["targets"][target]["shap_reference_rows"] = int(len(transformed))
        metrics["targets"][target]["shap_output_type"] = str(type(shap_values).__name__)

    # ===================================================================
    # SALARY MODEL
    # ===================================================================
    print("\n" + "=" * 60)
    print("SALARY MODEL: Training LightGBM regressor...")
    print("=" * 60)

    salary_rows = train_df[train_df["actual_salary_lpa"] > 0].copy()
    salary_test_rows = test_df[test_df["actual_salary_lpa"] > 0].copy()
    salary_features = STUDENT_FEATURES + ["placed_6m_stage1_prior", "placed_12m_stage1_prior"]

    salary_model = Pipeline([("prep", preprocessor(salary_features)), ("model", lightgbm_regressor())])
    salary_model.fit(salary_rows[salary_features], salary_rows["actual_salary_lpa"])
    salary_predictions = salary_model.predict(salary_test_rows[salary_features])

    sal_mae = float(mean_absolute_error(salary_test_rows["actual_salary_lpa"], salary_predictions))
    sal_rmse = float(mean_squared_error(salary_test_rows["actual_salary_lpa"], salary_predictions) ** 0.5)

    metrics["salary_model"] = {
        "model": "LightGBMRegressor",
        "mae_lpa": round(sal_mae, 4),
        "rmse_lpa": round(sal_rmse, 4),
        "test_rows": int(len(salary_test_rows)),
    }
    print(f"  MAE: {sal_mae:.4f} LPA | RMSE: {sal_rmse:.4f} LPA")

    joblib.dump(salary_model, output_dir / "salary_lightgbm.pickle")
    joblib.dump(salary_model, pickle_dir / "salary_lightgbm.pickle")

    # Salary SHAP
    salary_sample = salary_rows.sample(min(1000, len(salary_rows)), random_state=42)
    salary_explainer = shap.TreeExplainer(salary_model.named_steps["model"])
    joblib.dump(salary_explainer, output_dir / "shap_explainer_salary.pickle")
    joblib.dump(salary_explainer, pickle_dir / "shap_explainer_salary.pickle")

    # ===================================================================
    # SAVE METADATA
    # ===================================================================
    metadata = {
        "model_family": "XGBoost + LightGBM + SHAP",
        "data_version": "v2",
        "stage1_features": INSTITUTE_FEATURES,
        "stage2_features": STUDENT_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "excluded_features": ["applicant_origin", "gpa_scale", "raw_gpa"],
        "gpa_feature_used": "normalized_cgpa_10",
        "targets": TARGETS,
        "salary_target": "actual_salary_lpa",
        "penalty_design": {
            "cgpa": "Primary driver (~35% weight). Non-linear penalty below 6.5.",
            "backlogs": "Second strongest driver (~20% weight). 3+ backlogs -> near-zero placement.",
            "nirf": "Moderate driver (~15% weight). Helps but cannot save bad academics.",
        },
    }

    for d in [output_dir, pickle_dir]:
        (d / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        (d / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print("\n" + "=" * 60)
    print("[OK] TRAINING COMPLETE!")
    print("=" * 60)
    print(f"  Models saved to: {output_dir}")
    print(f"  Also saved to:   {pickle_dir}")
    print(f"\n{json.dumps(metrics, indent=2)}")


def main():
    parser = argparse.ArgumentParser(description="Train PlacementIQ v2 models.")
    parser.add_argument("--data", default="ml/data/processed/placementiq_training.csv")
    parser.add_argument("--output-dir", default="ml/models/pitch")
    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
