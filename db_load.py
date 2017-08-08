# AUTHOR: Ian Wright
# DATE: June 16, 2017
# LAST EDIT: July 22, 2017

# USAGE:
# python db_load.py <mac, windows, compute> <prod, test> <if prod: stop_infile> <if prod: route_infile>
# eg)   python db_load.py mac prod data/oct_data_stop.csv data/oct_data_route.csv


import sys
import pandas as pd
from random import random

from sqlalchemy import create_engine
from app import db


def test_mode(stop_columns, route_columns, engine):
  # FAKE DATA RANGES
  datelist = pd.date_range('2016-05-01', periods=60).map(lambda datetime: datetime.date()).tolist() # 60 day range
  hourbins = [0, 1, 2, 3, 4] # 0: 'all', 1: 7-10 am, 2: 10am-4pm, 3: 4pm-7pm, 4: 7pm-10pm
  daybins = [0, 1, 2] # 0: 'all', 1: 'weekday', 2: 'weekend'
  directions = [0, 1, 2] # 0: first direc, 1: second direc, 2: all direcs
  # let stop_id '0' represent route-level metrics
  routes = {'B46': [1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118, 1119, 0],
            'BX19': [2220, 2221, 2222, 2223, 2224, 2225, 2226, 2227, 2228, 2229, 0],
            'BX39': [101819, 101820, 103317, 103318, 103319, 103320, 102985, 802139, 102417, 102418, 102419, 103321, 103322, 103902, 103323, 101496, 101497, 101498, 103542, 101499, 103365, 103366, 103657, 103328, 103329, 103330, 103331, 103332, 103333, 103334, 103335, 102942, 102757, 102759, 103118, 102762, 103119, 102765, 102766, 102767, 102768, 102769, 101149, 101150, 102775, 0],
            'Q60': [4440, 4441, 4442, 4443, 4444, 4445, 4446, 4447, 4448, 4449, 0],
            'M3': [5550, 5551, 5552, 5553, 5554, 5555, 5556, 5557, 5558, 5559, 0]}

  # GENERATE FAKE DATA
  stop_records = []
  route_records = []
  print 'generating fake data...'
  for route in routes:
      for stop in routes[route]:
          for direc in directions:
              rds_index = "_".join([route, str(direc), str(stop)])
              for day in datelist:
                  for hbin in hourbins:
                      for dbin in daybins:
                          # generate data for route table
                          if rds_index.endswith("_0"):
                            route_row = {
                              'rds_index': rds_index,
                              'date': day,
                              'hourbin': hbin,
                              'daybin': dbin,

                              'ewt': round(random() * 10, 1),
                              'rbt': round(random() * 10, 1),
                              'speed': round(random() * 10, 1)
                            }
                            route_records.append(route_row)
                          else:
                            # generate data for stop table
                            stop_row = {
                              'rds_index': rds_index,
                              'date': day,
                              'hourbin': hbin,
                              'daybin': dbin,

                              'ewt_95': round(random() * 10, 1),
                              'awt': round(random() * 10, 1),
                              'swt': round(random() * 10, 1),
                              'count': round(random() * 30, 1),
                              's_trip': round(random() * 10, 1),
                              'm_trip': round(random() * 10, 1),
                              'trip_95': round(random() * 10, 1)
                            }
                            stop_records.append(stop_row)


  # WRITE DATA TO POSTGRES
  stop_df = pd.DataFrame(stop_records, columns=stop_columns)
  route_df = pd.DataFrame(route_records, columns=route_columns)
  stop_df.to_sql('stop_metrics', engine, if_exists='append', index=False)
  route_df.to_sql('route_metrics', engine, if_exists='append', index=False)
  print 'successfully loaded fake data (FAKE NEWS).'


def convert_null(val):
  if val == 'null':
    return None
  else:
    return val


def prod_mode(stop_infile, route_infile, stop_columns, route_columns, engine):
  # READ DATA FROM CSV FILE, AND WRITE TO POSTGRES
  print 'reading data file...'

  stop_df = pd.read_csv(stop_infile)
  # temporary: remove the speed col from stop data
  stop_df.drop(['speed', 'rbt'], axis=1, inplace=True)
  stop_df = stop_df.applymap(convert_null)

  route_df = pd.read_csv(route_infile)
  # temporary: remove the count col from route data
  route_df.drop(['count'], axis=1, inplace=True)
  route_df = route_df.applymap(convert_null)

  stop_df.to_sql('stop_metrics', engine, if_exists='append', index=False)
  route_df.to_sql('route_metrics', engine, if_exists='append', index=False)
  print 'successfully loaded data.'


def main():

  if len(sys.argv) < 3:
    print """
          USAGE:
          python db_load.py <mac, windows, compute> <prod, test> <if prod: stop_infile> <if prod: route_infile>
          eg)   python db_load.py mac prod data/oct_data_stop.csv data/oct_data_route.csv
          """
    sys.exit()

  # ESTABLISH SQLALCHEMY CONNECTION
  os = sys.argv[1]
  if os == "windows":
    engine = create_engine('postgresql://root:root@localhost:5432/transit')
  elif os == "mac":
    engine = create_engine('postgresql://localhost/transit')
  elif os == "compute":
    engine = create_engine('postgresql://compute.cusp.nyu.edu/transitcenter_viz')
  elif os == "heroku":
    engine = create_engine('postgres://khhmgarehisweo:c0a26f041088be712b8a101b97580da03f0190925680887283008f8fb030f11d@ec2-50-19-105-113.compute-1.amazonaws.com:5432/def3b6t4b1et7m')

  # CLEAR EXISTING TABLES AND REBUILD SCHEMA
  db.drop_all()
  db.create_all()

  stop_cols = ['rds_index', 'date', 'hourbin', 'daybin', 'ewt_95',
               'awt', 'swt', 'count', 's_trip', 'm_trip', 'trip_95']

  route_cols = ['rds_index', 'date', 'hourbin', 'daybin', 'ewt', 'rbt', 'speed']

  mode = sys.argv[2]
  if mode =="prod":
    stop_infile = sys.argv[3]
    route_infile = sys.argv[4]
    prod_mode(stop_infile, route_infile, stop_cols, route_cols, engine)
  else:
    test_mode(stop_cols, route_cols, engine)

if __name__ == '__main__':
  main()
