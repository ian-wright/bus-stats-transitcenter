from flask import Flask, redirect, render_template, request, url_for, abort
from flask import jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
import json
import geojson
import datetime
import os


app = Flask(__name__)
# use this config for windows setup
#app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://root:root@localhost:5432/transit'
# use this config for mac setup
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/transit'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # change this before production!
db = SQLAlchemy(app)


########## CONFIG ###########
DAYSBACK = 30


########## SQLALCHEMY MODELS ###########


class Metric(db.Model):
    __tablename__ = 'metrics'

    # to fully define a filtered metric, we need: route, direction, stop, day (end of 30 day calculation window)
    # timefilter, dayfilter, and the metric value itself

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
        return '<Metric set: {}, {}:{}, {}>'.format(
            self.rds_index,
            self.date,
            self.daybin,
            self.hourbin)


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
    return Metric.query.order_by(Metric.date.desc()).first().date


def get_available_routes():
    # returns the intersection of available routes from profiles AND db

    # distinct database routes
    db_distinct_records = Metric.query.distinct(Metric.rds_index).all()
    db_distinct = set(map(lambda rec: rec.rds_index.split('_')[0], db_distinct_records))

    # distinct geo routes
    geo_files = os.listdir('data/profiles/')
    geo_files_filt = filter(lambda geo: '.geojson' in geo, geo_files)
    geo_distinct = set(map(lambda geo: geo.split('_')[0], geo_files_filt))

    avail = list(db_distinct.intersection(geo_distinct))
    print 'available routes:', avail
    return avail


def get_profile(route):
    profile = InterDict()

    # attempt to load both directions' geometry
    geo = {}
    for direction in ['0','1']:
        try:
            with open('./data/profiles/{}_{}.geojson'.format(route, direction)) as infile:
                geo[direction] = geojson.load(infile)
        except IOError:
            # geometry doesn't exist
            print "couldn't find geometry profile for route {}, direction {}".format(route, direction)
            pass

    # allow server to continue even if there are no geometry profiles available
    if '0' in geo:
        profile['route_id'] = geo['0']['properties']['route_id']
        profile['short_name'] = geo['0']['properties']['short_name']
        profile['long_name'] = geo['0']['properties']['long_name']
        profile['route_color'] = geo['0']['properties']['route_color']
        profile['directions']['0']['headsign'] = geo['0']['properties']['headsign']
        profile['directions']['0']['geo'] = {k: geo['0'][k] for k in ('type', 'features')}

    if '1' in geo:
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


def get_metrics_df(route, window_start):
    print 'querying Metrics for route: {}'.format(route)

    metrics_df = pd.read_sql(db.session.query(Metric)
               .filter(Metric.rds_index.startswith(route + '_'))
               .filter(Metric.date >= window_start).statement,
               db.session.bind)

    # allow server to continue even if there is no data available
    if len(metrics_df) != 0:
        metrics_df['direction'] = metrics_df.apply(lambda row: split_direc_stop(row['rds_index'], 'direc'), axis=1)
        metrics_df['stop'] = metrics_df.apply(lambda row: split_direc_stop(row['rds_index'], 'stop'), axis=1)
        print 'Metrics:\n', metrics_df.head()
        return metrics_df
    else:
        return None


def build_data_series(df, direc, dbin, hbin):
    """
    given a direction, daybin, and hourbin, this function produces a listof tuples representing 
    stop-level metric data.
    FORMAT: [(date, [DATA])], where DATA is [(stop_id, metric_value)]
    """
    direc = int(direc)
    dbin = int(dbin)
    hbin = int(hbin)

    filtered = df.loc[(df['daybin'] == dbin) \
                      & (df['hourbin'] == hbin) \
                      & (df['direction'] == direc),
                      ['date', 'stop', 'ewt', 'rbt', 'speed']]

    def tuple_data(day):
        """
        generates a list of stop-level data tuples corresponding to a single calendar day
        """
        # all data records for a given date (one record per bus stop)
        one_day = filtered.loc[filtered.date == day, :]
        return one_day.apply(lambda row: (row['stop'], row['ewt'], row['rbt'], row['speed']), axis=1).tolist()

    return {str(day): tuple_data(day) for day in filtered.date.unique()}



def build_response(profile, metrics_df):
    
    response = InterDict()

    hourbins = ['0', '1', '2', '3', '4']
    daybins = ['0', '1', '2']
    directions = ['0', '1', '2']

    if (profile is None) or (metrics_df is None):
        return {'status': 'error'}
    else:
        response['status'] = 'ok'
        response['route_id'] = profile['route_id']
        response['long_name'] = profile['long_name']
        response['short_name'] = profile['short_name']
        response['route_color'] = profile['route_color']

        # TODO - maybe surface route level metrics (encoded as stop_id=0) for easier access, or do it on client side?

        # include in the response the geometry and headsign for each direction (0 and 1)
        for direction in ['0', '1']:
            response['directions'][direction]['headsign'] = profile['directions'][direction]['headsign']
            response['directions'][direction]['geo'] = profile['directions'][direction]['geo']

        # now we can iterate through all three directions (0, 1, and 2) to generate data
        for direction in directions:
            for dbin in daybins:
                for hbin in hourbins:
                    response['directions'][direction]['daybins'][dbin]['hourbins'][hbin] = build_data_series(metrics_df,
                                                                                                             direction,
                                                                                                             dbin,
                                                                                                             hbin)
        return response
        


@app.route('/routes/<string:route>/data')
def get_route(route):
    print 'getting data for route: {}'.format(route)
    window_start = str(get_last_update() + datetime.timedelta(days=-(DAYSBACK)))
    print 'window_start:', window_start
    
    response = build_response(get_profile(route),
                              get_metrics_df(route, window_start))

    return jsonify(response)


@app.route('/routes/<string:route>')
def dashboard(route):
    print 'routing a route!'
    avail = get_available_routes()
    return render_template('route.html', route=route, avail=avail)


@app.route('/')
@app.route('/home')
def home():
    return render_template('home.html')


@app.errorhandler(404)
def not_found(error):
    print 'rendering a 404'
    return render_template('404.html'), 404


@app.route('/routes/<string:route>/404')
def not_found(route):
    print 'rendering a 404'
    return render_template('404.html'), 404


if __name__ == '__main__':
    app.debug = True
    app.run()
