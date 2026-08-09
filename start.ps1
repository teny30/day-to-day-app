Write-Host "Starting Django Password Generator on port 8000..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\activate; cd password_generator; python manage.py runserver 8000"

Write-Host "Starting Flask To-Do List Application on port 5000..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\activate; cd todo_list; python app.py"

Write-Host "Both servers are starting in new windows."
