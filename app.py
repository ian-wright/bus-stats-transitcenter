from flask import Flask, redirect, render_template, request, url_for
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/transit'
db = SQLAlchemy(app)

# define our database model
class Fruit(db.Model):
    __tablename__ = "fruits"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True)
    color = db.Column(db.String(120))

    def __init__(self, name, color):
        self.name = name
        self.color = color

    def __repr__(self):
        return '<Fruit: %r>' % self.name

@app.route('/')
def index():
    return render_template('dashboard.html')

if __name__ == '__main__':
    app.debug = True
    app.run()