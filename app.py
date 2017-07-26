from flask import Flask, redirect, render_template, request, url_for, abort
from flask import jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_compress import Compress

import pandas as pd
import json
import geojson
import datetime
import os
import math


########## CONFIG ###########

app = Flask(__name__)
# enable compression of response objects
Compress(app)

# WINDOWS setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://root:root@localhost:5432/transit'
# MAC setup
#app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/transit'
# COMPUTE setup
#app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://compute.cusp.nyu.edu/transitcenter_viz'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # change this before production!
db = SQLAlchemy(app)

DAYSBACK = 30


########## SQLALCHEMY MODELS ###########

# umm sounds like they want ewt, awt, swt, ewt_95
# (tho not convinced this makes mathematic sense as we are calculating it, zak is talking it over with chris),
# counts, speed, scheduled trip, median trip (not displayed, just to color the rbt) & rbt

class StopMetric(db.Model):
    __tablename__ = 'stop_metrics'

    # to fully define a filtered metric, we need: route, direction, stop, day,
    # hourfilter, dayfilter, and the metric values themselves

    # route, direction, stop
    rds_index = db.Column(db.String(40), primary_key=True)
    date = db.Column(db.Date, primary_key=True)
    hourbin = db.Column(db.Integer, primary_key=True)
    daybin = db.Column(db.Integer, primary_key=True)

    ewt_95 = db.Column(db.Float)
    awt = db.Column(db.Float)
    swt = db.Column(db.Float)
    count = db.Column(db.Integer)
    s_trip = db.Column(db.Float)
    m_trip = db.Column(db.Float)
    trip_95 = db.Column(db.Float)

    def __init__(self, name, color):
        self.rds_index = rds_index
        self.date = date
        self.hourbin = hourbin
        self.daybin = daybin

        self.ewt_95 = ewt_95
        self.awt = awt
        self.swt = swt
        self.count = count
        self.s_trip = s_trip
        self.m_trip = s_trip
        self.trip_95 = trip_95

    def __repr__(self):
        return '<Stop metric set: {}, {}:{}, {}>'.format(
            self.rds_index,
            self.date,
            self.daybin,
            self.hourbin)

class RouteMetric(db.Model):
    __tablename__ = 'route_metrics'

    # route, direction, stop
    rds_index = db.Column(db.String(40), primary_key=True)
    date = db.Column(db.Date, primary_key=True)
    hourbin = db.Column(db.Integer, primary_key=True)
    daybin = db.Column(db.Integer, primary_key=True)

    ewt = db.Column(db.Float)
    rbt = db.Column(db.Float)
    speed = db.Column(db.Float)

    def __init__(self, name, color):
        self.rds_index = rds_index
        self.date = date
        self.hourbin = hourbin
        self.daybin = daybin

        self.ewt = ewt
        self.rbt = rbt
        self.speed = speed

    def __repr__(self):
        return '<Route metric set: {}, {}:{}, {}>'.format(
            self.rds_index,
            self.date,
            self.daybin,
            self.hourbin)


########## UTILITY ###########

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


def clean_nan(val):
    if math.isnan(val):
        return None
    else:
        return val


stop_metric_list = ['ewt_95', 'awt', 'swt', 'count', 's_trip', 'm_trip', 'trip_95']
route_metric_list = ['ewt', 'rbt', 'speed']


########## APP LOGIC ###########

def get_last_update():
    # assumes that all metric tables are updated in synchro (so, just query one)
    return RouteMetric.query.order_by(RouteMetric.date.desc()).first().date


def get_available_routes():
    # returns the intersection of available routes from profiles and db

    # distinct database routes
    db_distinct_records = RouteMetric.query.distinct(RouteMetric.rds_index).all()
    db_distinct = set(map(lambda rec: rec.rds_index.split('_')[0], db_distinct_records))

    # distinct geo routes
    geo_files = os.listdir('./data/profiles/')
    geo_files_filt = filter(lambda geo: '.geojson' in geo, geo_files)
    geo_distinct = set(map(lambda geo: geo.split('_')[0], geo_files_filt))

    avail = list(db_distinct.intersection(geo_distinct))
    print 'available routes:', avail
    return avail


def get_profile(route):
    profile = InterDict()
    print 'getting profiles for route: {}'.format(route)
    # attempt to load both directions' geometry
    geo = {}
    for direction in ['0','1']:
        try:
            fname = './data/profiles/{}_{}.geojson'.format(route, direction)
            with open('./data/profiles/{}_{}.geojson'.format(route, direction)) as infile:
                geo[direction] = geojson.load(infile)
        except IOError:
            # geometry doesn't exist
            print "couldn't find geometry profile for route {}, direction {}".format(route, direction)
            pass

    # allow server to continue even if there are no geometry profiles available
    if '0' in geo:
        print 'found profile direction: 0'
        profile['route_id'] = geo['0']['properties']['route_id']
        profile['short_name'] = geo['0']['properties']['short_name']
        profile['long_name'] = geo['0']['properties']['long_name']
        profile['route_color'] = geo['0']['properties']['route_color']
        profile['directions']['0']['headsign'] = geo['0']['properties']['headsign']
        profile['directions']['0']['geo'] = {k: geo['0'][k] for k in ('type', 'features')}

    if '1' in geo:
        print 'found profile direction: 1'
        profile['route_id'] = geo['1']['properties']['route_id']
        profile['short_name'] = geo['1']['properties']['short_name']
        profile['long_name'] = geo['1']['properties']['long_name']
        profile['route_color'] = geo['1']['properties']['route_color']
        profile['directions']['1']['headsign'] = geo['1']['properties']['headsign']
        profile['directions']['1']['geo'] = {k: geo['1'][k] for k in ('type', 'features')}

    print 'long_name:', profile['long_name']

    if geo:
        return profile
    else:
        return None


def get_metrics_dfs(route, window_start):
    """
    queries both db tables for all records associated with given route_id, after a given date.
    returns a dictionary with stop- and route-level pandas dataframes
    """
    print 'querying metrics for route: {}'.format(route)

    def query_table(table_class, route, window_start):
        df = pd.read_sql(db.session.query(table_class)
                    .filter(table_class.rds_index.startswith(route + '_'))
                    .filter(table_class.date >= window_start).statement,
                    db.session.bind)
        if len(df) != 0:
            df['direction'] = df.apply(lambda row: split_direc_stop(row['rds_index'], 'direc'), axis=1)
            df['stop'] = df.apply(lambda row: split_direc_stop(row['rds_index'], 'stop'), axis=1)
            return df
        else:
            return None

    stop_metrics_df = query_table(StopMetric, route, window_start)
    route_metrics_df = query_table(RouteMetric, route, window_start)

    if ((route_metrics_df is None) or (stop_metrics_df is None)):
        return None
    else:
        return {'stop_df': stop_metrics_df, 'route_df': route_metrics_df}


def build_data_series(dfs, direc, dbin, hbin):
    """
    given a direction, daybin, and hourbin, this function produces a dictionary object
    of {date: {route-level: data, stop-level: data}}, where 
    representing stop-level metric data for each day
    FORMAT: [(date, [DATA])], where DATA is [(stop_id, metric_value_1, metric_value_2)]
    """
    direc = int(direc)
    dbin = int(dbin)
    hbin = int(hbin)

    def filter_df(df, metric_list, direc, dbin, hbin):
        return df.loc[(df['daybin'] == dbin) &
                      (df['hourbin'] == hbin) &
                      (df['direction'] == direc),
                      ['date', 'stop'] + metric_list]

    def package_metrics(day, df, metric_list):
        """
        generates a list of stop-level data tuples corresponding to a single calendar day
        """
        # all data records for a given date (one record per bus stop)
        one_day = df.loc[df.date == day, :]
        if len(one_day) != 0:
            return one_day.apply(lambda row: [clean_nan(row['stop'])] +
                                             [clean_nan(row[metric]) for metric in metric_list],
                                             axis=1).tolist()
        else 
            return

    stop_filtered = filter_df(dfs['stop_df'], stop_metric_list, direc, dbin, hbin)
    route_filtered = filter_df(dfs['route_df'], route_metric_list, direc, dbin, hbin)

    return {"dates": {str(day): {"route": package_metrics(day, route_filtered, route_metric_list),
                                 "stops": package_metrics(day, stop_filtered, stop_metric_list)} \
        for day in route_filtered.date.unique()}}


def build_response(profile, dfs):

    response = InterDict()

    # hourbins = set(list(dfs["stop_df"].hourbin.unique()) + list(dfs["route_df"].hourbin.unique()))
    # daybins = set(list(dfs["stop_df"].daybin.unique()) + list(dfs["route_df"].daybin.unique()))
    # directions = set(list(dfs["stop_df"].direction.unique()) + list(dfs["route_df"].direction.unique()))

    # print ("hourbins, daybins, directions", hourbins, daybins, directions)

    hourbins = ['0', '1', '2', '3', '4']
    daybins = ['0', '1', '2']
    directions = ['0', '1', '2']

    if (profile is None) or (dfs is None):
        return {'status': 'error'}
    else:
        response['status'] = 'ok'
        response['route_id'] = profile['route_id']
        response['long_name'] = profile['long_name']
        response['short_name'] = profile['short_name']
        response['route_color'] = profile['route_color']

        # include in the response the geometry and headsign for each direction (0 and 1)
        for direction in ['0', '1']:
            if profile['directions'][direction]:
                response['directions'][direction]['headsign'] = profile['directions'][direction]['headsign']
                response['directions'][direction]['geo'] = profile['directions'][direction]['geo']

        # now we can iterate through all hourbin/daybin/direction combination
        # and populate response object with data
        for direction in directions:
            for dbin in daybins:
                for hbin in hourbins:
                    response['directions'][direction]['daybins'][dbin]['hourbins'][hbin] = \
                    build_data_series(dfs, direction, dbin, hbin)
        return response


########## FLASK ROUTES ###########

# basic data endpoint
@app.route('/routes/<string:route>/data')
def get_data(route):
    print 'getting data for route: {}'.format(route)

    window_start = str(get_last_update() + datetime.timedelta(days=-(DAYSBACK)))
    print 'window_start:', window_start

    response = build_response(get_profile(route),
                              get_metrics_dfs(route, window_start))
    return jsonify(response)


# standard template route
@app.route('/routes/<string:route>')
def dashboard(route):
    print 'loading template for route : {}'.format(route)
    avail = get_available_routes()
    return render_template('routev2.html', route=route, avail=avail)


# system-level summary template
@app.route('/')
@app.route('/home')
def home():
    # system_data = get_system_data();
    return render_template('homev2.html')


@app.errorhandler(404)
@app.route('/routes/<string:route>/404')
def not_found(route):
    print 'rendering a 404'
    return render_template('404.html'), 404


if __name__ == '__main__':
    app.debug = True
    app.run()
