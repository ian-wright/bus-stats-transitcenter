# AUTHOR: Ian Wright
# DATE: June 16, 2017

import pandas as pd
from random import random

from sqlalchemy import create_engine
from app import db


# CLEAR EXISTING TABLES AND REBUILD SCHEMA
db.drop_all()
db.create_all()

# ESTABLISH SQLALCHEMY CONNECTION
# WINDOWS setup
#engine = create_engine('postgresql://root:root@localhost:5432/transit')
# MAC setup
engine = create_engine('postgresql://localhost/transit')
# COMPUTE setup
#engine = create_engine('postgresql://compute.cusp.nyu.edu/transitcenter_viz')


# FAKE DATA RANGES
datelist = pd.date_range('2016-05-01', periods=60).map(lambda datetime: datetime.date()).tolist() # 60 day range
hourbins = [0, 1, 2, 3, 4] # correspond to 'all', 'peak', 'offpeak'
daybins = [0, 1, 2] # correspond to 'all', 'weekday', 'weekend'
directions = [0, 1, 2] # will ultimately be mapped to real direction headsigns in a separate table (or static directory)
routes = {'B46': [1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118, 1119, 0], # let '0' represent route-level metrics
          'Bx19': [2220, 2221, 2222, 2223, 2224, 2225, 2226, 2227, 2228, 2229, 0],
          'Bx39': [3330, 3331, 3332, 3333, 3334, 3335, 3336, 3337, 3338, 3339, 0],
          'Q60': [4440, 4441, 4442, 4443, 4444, 4445, 4446, 4447, 4448, 4449, 0],
          'M3': [5550, 5551, 5552, 5553, 5554, 5555, 5556, 5557, 5558, 5559, 0]}


# GENERATE FAKE DATA
metric_list = []
print 'generating fake data...'
for route in routes:
    for stop in routes[route]:
        for direc in directions:
            rds_index = "_".join([route, str(direc), str(stop)])
            for day in datelist:
                for hbin in hourbins:
                    for dbin in daybins:
                        ewt_metric = round(random() * 10, 1)
                        rbt_metric = round(random() * 10, 1)
                        speed_metric = round(random() * 10, 1)

                        metric_row = {'rds_index': rds_index,
                               'date': day,
                               'hourbin': hbin,
                               'daybin': dbin,
                               'ewt': ewt_metric,
                               'rbt': rbt_metric,
                               'speed': speed_metric}

                        metric_list.append(metric_row)


# WRITE DATA TO POSTGRES
metric_df = pd.DataFrame(metric_list, columns=['rds_index', 'date', 'hourbin', 'daybin', 'ewt', 'rbt', 'speed'])
metric_df.to_sql('metrics', engine, if_exists='append', index=False)
print 'successfully loaded fake data (FAKE NEWS)'
