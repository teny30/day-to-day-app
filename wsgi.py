import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'todo_list'))
from app import app

if __name__ == '__main__':
    app.run()
