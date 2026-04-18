import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression

def train_model(file_path):
    # Load dataset
    df = pd.read_csv(file_path)

    # Basic cleaning (optional but useful)
    df = df.dropna()

    # Split into features (X) and target (y)
    # Assumption: LAST column = target
    X = df.iloc[:, :-1]
    y = df.iloc[:, -1]

    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Create model
    model = LinearRegression()

    # Train model
    model.fit(X_train, y_train)

    # Get accuracy (R² score)
    score = model.score(X_test, y_test)

    return round(score, 3)