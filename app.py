from flask import Flask, redirect, render_template, request, url_for, abort
from flask import jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd
import json
import geojson
import datetime


app = Flask(__name__)
#app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://root:root@localhost:5432/transit'
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/transit'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0 # change this before production!
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


def get_ewt_df(route, window_start):
    print 'querying EWT for route: {}'.format(route)

    ewt_df = pd.read_sql(db.session.query(EWT)
               .filter(EWT.rds_index.startswith(route + '_'))
               .filter(EWT.date >= window_start).statement,
               db.session.bind)

    # allow server to continue even if there is no data available
    if len(ewt_df) != 0:
        ewt_df['direction'] = ewt_df.apply(lambda row: split_direc_stop(row['rds_index'], 'direc'), axis=1)
        ewt_df['stop'] = ewt_df.apply(lambda row: split_direc_stop(row['rds_index'], 'stop'), axis=1)
        print 'EWT:\n', ewt_df.head()
        return ewt_df
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
                      ['date', 'stop', 'metric']]

    def tuple_data(date):
        """
        generates a list of stop-level data tuples corresponding to a single calendar day
        """
        one_day = filtered.loc[filtered.date == day, :]
        return one_day.apply(lambda row: (row['stop'], row['metric']), axis=1).tolist()

    return [(str(day), tuple_data(day)) for day in filtered.date.unique()]



def build_response(profile, ewt_df):
    
    response = InterDict()

    directions = ['0', '1']
    daybins = ['0', '1', '2']
    hourbins = ['0', '1', '2']

    if (profile is None) or (ewt_df is None):
        return {'status': 'error'}
    else:
        response['status'] = 'ok'
        response['route_id'] = profile['route_id']
        response['long_name'] = profile['long_name']
        response['short_name'] = profile['short_name']
        response['route_color'] = profile['route_color']

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
        


@app.route('/routes/<string:route>/data')
def get_route(route):
    print 'getting data for route: {}'.format(route)
    window_start = str(get_last_update() + datetime.timedelta(days=-(DAYSBACK)))
    print 'window_start:', window_start
    
    response = build_response(get_profile(route),
                              get_ewt_df(route, window_start))

    return jsonify(response)


@app.route('/routes/<string:route>')
def dashboard(route):
    return render_template('route.html', route=route)


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
