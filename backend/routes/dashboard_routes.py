from flask import Blueprint, request, render_template
from backend.ml_model import train_model

dashboard = Blueprint('dashboard', __name__)

@dashboard.route('/train', methods=['POST'])
def train():
    filename = request.form.get("filename")

    file_path = "uploads/" + filename

    score = train_model(file_path)

    return render_template("dashboard.html", accuracy=score, selected_file=filename)