# CUSP <> TransitCenter MTA webapp

## Instructions to get it up and runnning:

### 1) install python's virtual environment package: *pip install virtualenv*
  - navigate to the directory where you want the project
  - create a new python virtual environment called 'venv': *virtualenv venv*
  - activate the virtualenv: *source ./venv/bin/activate*
  - double check that *which pip* directs you to your venv python, and not your system level python

### 2) clone the app repo: *git clone https://github.com/ian-wright/tc-app.git*
  - install project requirements: *pip install -r tc-app/requirements.txt*

### 3) start a PostgreSQL server: 
  - https://postgresapp.com/
  - once downloaded:
    - in order to access this postgres db from the command line later, include a new line: in your .bashrc, bash_profile, or .zshrc file, add: *export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"*
    - open the app initialize a new server

### 4) install a postgres client for looking at tables:
  - https://eggerapps.at/postico/
  - connect to your postgres server:
    - host: localhost
    - port: 5432
    - database: (your system username)
    - user: (your system username)
    - password: (no password)
  -  once connected, create a new database on your server (lower left corner button) called, exactly: *transit*
  -  at any point now, you can explore the data in the database via the Postico tool :)

### 5) install a json viewer plugin for Chrome:
  - https://chrome.google.com/webstore/detail/json-viewer/gbmdgpbipfallnflgajpaliibnhdgobh
  - enable the plugin, and check the box "allow access to file URLs"
  - in plugin options, change "maxJsonSize" to 1000
   
### 6) initialize db schema and load some fake data into it:
  - run: *python db_load.py*

### 7) use Flask's built in web server (for testing only):
  - run: *python app.py*
  - test out a JSON route endpoint on Google Chrome @ *http://127.0.0.1:5000/routes/Bx39*
  - or checkout the (broken) template @ or *http://127.0.0.1:5000*
