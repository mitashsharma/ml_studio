import os
from flask import Flask, render_template
from backend.config import Config
from backend.models.user_model import User
from backend.extensions import db, login_manager
from backend.routes.auth_routes import auth
from backend.routes.dashboard_routes import dashboard

app = Flask(__name__)

# Configurations
app.config['SECRET_KEY'] = Config.SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'

#upload folder
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize extensions
db.init_app(app)
login_manager.init_app(app)

# Home route
@app.route('/')
def home():
    return render_template('login.html')

# Register blueprint
app.register_blueprint(auth)
app.register_blueprint(dashboard)

# Flask-Login user loader
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))  


# Create database
with app.app_context():
    db.create_all()
    print("✅ Database created!")

# Debug routes
print(app.url_map)

if __name__ == '__main__':
    app.run(debug=True)
