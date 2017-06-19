# CUSP <> TransitCenter MTA webapp

## Instructions to get it up and runnning:

1) install python's virtual environment package: *pip install virtualenv*
  - navigate to the directory where you want the project
  - create a new python virtual environment called 'venv': *virtualenv venv*
  - activate the virtualenv: *source ./venv/bin/activate*
  - double check that *which pip* directs you to your venv python, and not your system level python
  - install project requiremeents: *pip install -r requirements.txt*

2) clone this repo: *git clone https://github.com/ian-wright/tc-app.git*

3) install a nice shiny version of PostgreSQL: 
  - https://postgresapp.com/
  - once downloaded:
    - add it to your path, in your .bashrc or .zshrc file, add *export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"*
    - open the app initialize a new server
    - create a new database called (exactly) 'transit'

4) install a postgres client for looking at tables:
  - https://eggerapps.at/postico/
  - connect to your postgres DB:
    - host: localhost
    - port: 5432
    - database: (your system username)
    - user: (your system username)
    - password: (no password)
    - connection URL: postgresql://localhost
   
5) run initialize db schema and load some fake data into it:
  - double check that 
  - run: p
