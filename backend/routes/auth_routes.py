import os
import pandas as pd
import matplotlib.pyplot as plt
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from backend.models.user_model import User
from backend.extensions import db
from flask_login import login_user, logout_user, login_required, current_user


auth = Blueprint('auth', __name__)

# ------------------ DASHBOARD ------------------
@auth.route('/dashboard', methods=['GET','POST'])
@login_required
def dashboard():
    upload_folder = current_app.config['UPLOAD_FOLDER']
    files = os.listdir(upload_folder) if os.path.exists(upload_folder) else []

    table = None
    selected_file = None
    graph = None

    filename = request.args.get('file')

    if filename and filename.endswith('.csv'):
        filepath = os.path.join(upload_folder, filename)

        try:
            df = pd.read_csv(filepath)

            table = df.to_html(classes='table', index=False)
            selected_file = filename

            numeric_cols = df.select_dtypes(include='number').columns

            if len(numeric_cols) >= 2:
                plt.figure()
                df.plot(x=numeric_cols[0], y=numeric_cols[1])

                graph_path = os.path.join('static', 'graph.png')
                plt.savefig(graph_path)
                plt.close()

                graph = 'graph.png'

        except Exception as e:
            table = "<p>Error reading file</p>"

    return render_template(
        'dashboard.html',
        files=files,
        table=table,
        selected_file=selected_file,
        graph=graph,
        name=current_user.username)


# ------------------ REGISTER ------------------
@auth.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        if not username or not email or not password:
            flash("All fields are required")
            return redirect(url_for('auth.register'))

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash("Email already registered")
            return redirect(url_for('auth.register'))

        hashed_password = generate_password_hash(password)

        new_user = User(
            username=username,
            email=email,
            password=hashed_password
        )

        db.session.add(new_user)
        db.session.commit()

        flash("Registration successful! Please login.")
        return redirect(url_for('auth.login'))

    return render_template('register.html')


# ------------------ LOGIN ------------------
@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password, password):
            login_user(user)
            print(f"✅ User {user.username} logged in successfully!")
            flash("Login successful!")

            # ✅ FIXED REDIRECT
            return redirect(url_for('auth.dashboard'))

        else:
            flash("Invalid email or password")
            return redirect(url_for('auth.login'))
    return render_template('login.html')

# upload folder setup
@auth.route('/upload', methods=['POST'])
@login_required
def upload_file():
    
    if 'file' not in request.files:
        flash("No file selected")
        return redirect(url_for('auth.dashboard'))

    file = request.files['file']

    if file.filename == '':
        flash("No file selected")
        return redirect(url_for('auth.dashboard'))

    filepath = os.path.join('uploads', file.filename)

    file.save(filepath)

    flash("File uploaded successfully")
    return redirect(url_for('auth.dashboard'))

    # show login page instead of redirect loop
    return render_template('login.html')


# ------------------ LOGOUT ------------------
@auth.route('/logout')
@login_required
def logout():
    logout_user()
    flash("Logged out successfully")
    return redirect(url_for('auth.login'))