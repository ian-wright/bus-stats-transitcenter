from flask import Flask, redirect, render_template, request, url_for
from flask import jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
import json
import geojson
import datetime


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/transit'
db = SQLAlchemy(app)


########## CONFIG ###########
DAYSBACK = 30


########## SQLALCHEMY MODELS ###########


class EWT(db.Model):
    __tablename__ = 'ewt'

    # to fully define a filtered metric, we need: route, direction, stop, day (end of 30 day calculation window)
    # timefilter, dayfilter, and the metric value itself

    # route, direction, stop
    rds_index = db.Column(db.String(80), primary_key=True)
    date = db.Column(db.Date, primary_key=True)
    hourbin = db.Column(db.Integer, primary_key=True)
    daybin = db.Column(db.Integer, primary_key=True)
    metric = db.Column(db.Float)

    def __init__(self, name, color):
        self.rds_index = rds_index
        self.date = date
        self.hourbin = hourbin
        self.daybin = daybin
        self.metric = metric

    def __repr__(self):
        return '<EWT: {}, {}:{}, {}>'.format(
            self.rds_index,
            self.daybin,
            self.hourbin,
            self.date)


class EJT(db.Model):
    __tablename__ = 'ejt'

    rds_index = db.Column(db.String(80), primary_key=True)
    date = db.Column(db.Date, primary_key=True)
    hourbin = db.Column(db.Integer, primary_key=True)
    daybin = db.Column(db.Integer, primary_key=True)
    metric = db.Column(db.Float)

    def __init__(self, name, color):
        self.rds_index = rds_index
        self.date = date
        self.hourbin = hourbin
        self.daybin = daybin
        self.metric = metric

    def __repr__(self):
        return '<EJT: {}, {}:{}, {}>'.format(
            self.rds_index,
            self.daybin,
            self.hourbin,
            self.date)


########## FLASK ROUTES ###########


# subclass standard python dict, implementing __missing__ to generate intermediate keys on the fly
class InterDict(dict):
    def __missing__(self, key):
        self[key] = InterDict()
        return self[key]


def split_direc_stop(rds_index, col):
    route, direc, stop = rds_index.split('_')
    if col == 'direc':
        return int(direc)
    elif col == 'stop':
        return int(stop)


def get_last_update():
    # assumes that all metric tables are updated in synchro (so, just query one)
    return EWT.query.order_by(EWT.date.desc()).first().date


# TODO - write the script that generates clean route profile json files (to be hosted in static dir)

def get_profile(route):
    profile = InterDict()

    with open('./data/profiles/{}/profile.json'.format(route)) as profile_json:
         prof = json.load(profile_json)

    profile['route_id'] = route
    profile['long_name'] = prof['route_long_name']
    profile['directions']['0']['headsign'] = prof['directions']['0']['headsign']
    profile['directions']['1']['headsign'] = prof['directions']['1']['headsign']

    with open('./data/profiles/{}/{}.geojson'.format(route, route)) as profile_geojson:
        geo = geojson.load(profile_geojson)
    
    # TODO  - right now, this is just the same geo for both directions... 
    # after we create proper route profile json files, update this section
    profile['directions']['0']['geo'] = geo
    profile['directions']['1']['geo'] = geo

    print 'long_name:', profile['long_name']
    return profile


def get_ewt_df(route, window_start):
    print 'querying EWT for route: {}'.format(route)

    ewt_df = pd.read_sql(db.session.query(EWT) 
               .filter(EWT.rds_index.startswith(route + '_'))
               .filter(EWT.date >= window_start).statement,
               db.session.bind)

    ewt_df['direction'] = ewt_df.apply(lambda row: split_direc_stop(row['rds_index'], 'direc'), axis=1)
    ewt_df['stop'] = ewt_df.apply(lambda row: split_direc_stop(row['rds_index'], 'stop'), axis=1)
    
    print 'EWT:\n', ewt_df.head()
    return ewt_df


def get_ejt_df(route, window_start): 
    print 'querying EJT for route: {}'.format(route)
    
    ejt_df = pd.read_sql(db.session.query(EJT) 
               .filter(EJT.rds_index.startswith(route + '_'))
               .filter(EJT.date >= window_start).statement,
               db.session.bind)

    ejt_df['direction'] = ejt_df.apply(lambda row: split_direc_stop(row['rds_index'], 'direc'), axis=1)
    ejt_df['stop'] = ejt_df.apply(lambda row: split_direc_stop(row['rds_index'], 'stop'), axis=1)
    
    print 'EJT:\n', ejt_df.head()
    return ejt_df


def build_data_series(df, direc, dbin, hbin):
    direc = int(direc)
    dbin = int(dbin)
    hbin = int(hbin)

    filtered = df.loc[(df['daybin'] == dbin) \
                      & (df['hourbin'] == hbin) \
                      & (df['direction'] == direc), 
                      ['date', 'stop', 'metric']]

    def tuple_data(date):
        one_day = filtered.loc[filtered.date == day, :]
        return one_day.apply(lambda row: (row['stop'], row['metric']), axis=1).tolist()

    return [(str(day), tuple_data(day)) for day in filtered.date.unique()]



def build_response(profile, ewt_df, ejt_df):
    response = InterDict()

    directions = ['0', '1']
    daybins = ['0', '1', '2']
    hourbins = ['0', '1', '2']

    response['route_id'] = profile['route_id']
    response['long_name'] = profile['long_name']

    # TODO - right now, the reponse object only has EWT...
    # if all stop level metrics are written to the same postgres table, it'll be easy to include all metrics

    # TODO - maybe surface route level metrics (encoded as stop_id=0) for easier access, or do it on client side?

    for direction in directions:
        response['directions'][direction]['headsign'] = profile['directions'][direction]['headsign']
        response['directions'][direction]['geo'] = profile['directions'][direction]['geo']
        for dbin in daybins:
            for hbin in hourbins:
                response['directions'][direction]['daybins'][dbin]['hourbins'][hbin] = build_data_series(ewt_df,
                                                                                                         direction,
                                                                                                         dbin,
                                                                                                         hbin)
    return response


#def get_speed(route):


@app.route('/routes/<string:route>/data')
def get_route(route):
    print 'getting data for route: {}'.format(route)
    window_start = str(get_last_update() + datetime.timedelta(days=-(DAYSBACK)))
    print 'window_start:', window_start

    response = build_response(get_profile(route),
                              get_ewt_df(route, window_start),
                              get_ejt_df(route, window_start))

    return jsonify(response)


@app.route('/routes/<string:route>')
def dashboard(route):
    return render_template('route.html', route=route)


@app.route('/')
def index():
    return render_template('dashboard.html')


if __name__ == '__main__':
    app.debug = True
    app.run()

