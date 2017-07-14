import pandas as pd
import os
import geojson

route = 'Bx1'
geo = {}
for direction in ['0','1']:
    try:
        with open('./data/profiles/{}_{}.geojson'.format(route, direction)) as infile:
            geo[direction] = geojson.load(infile)
    except IOError:
        # geometry doesn't exist
        print "couldn't find geometry profile for route {}, direction {}".format(route, direction)
        pass

geo
