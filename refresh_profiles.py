# DESCRIPTION: generates a new set of {route_id}_{direction}.geojson files for every route/direction
# combination on MTA's most recent schedule. The LineString and Point features all have metadata that 
# provide bus stop stop_id and a stop sequence integer.

# AUTHOR: Ian Wright
# ORIGINAL DATE: July 9, 2017
# LAST EDITED: July 9, 2017


import requests
from zipfile import ZipFile
from io import BytesIO
import glob
import os
import pandas as pd
import geojson


def load_data():
    """
    loads most recent MTA GTFS schedule data into pandas dataframes
    args: none
    returns: dictionary of pandas dataframes for each of MTA's relevant text files
    """
    data = {
        'shapes': pd.DataFrame(),
        'stops': pd.DataFrame(),
        'stop_times': pd.DataFrame(),
        'trips': pd.DataFrame(),
        'routes': pd.DataFrame()
    }

    for boro in ['bronx', 'brooklyn', 'manhattan', 'queens', 'staten_island']:
        url = "http://web.mta.info/developers/data/nyct/bus/google_transit_{}.zip".format(boro)
        print 'reading most recent data from: {}...'.format(boro)
        request = requests.get(url)
        stream = ZipFile(BytesIO(request.content))
        for table in data.keys():
            filelike = stream.open('{}.txt'.format(table))
            data[table] = data[table].append(pd.read_csv(filelike))
    print 'import finished.'
    return data


def get_route_info(route_id):
    """
    pulls down some route meta-data from MTA's 'routes' file
    args: route_id (string)
    returns: (str, str, str): ('route_short_name', 'route_long_name', 'route_color')
    """
    cols = ['route_short_name', 'route_long_name', 'route_color']
    df = data['routes'].loc[data['routes']['route_id']==route_id, :]
    df.reset_index(drop=True, inplace=True)
    return tuple(df.loc[0, cols])


def get_most_common_shape(route_id, direction):
    """
    given a route and direction, function selects the associated shape/geometry 
        that occurs most often in the most recent MTA schedule
    args: route_id (string), direction (int; 0 or 1)
    returns: shape_id (string)
    """
    filtered = data['trips'].loc[(data['trips']['route_id']==route_id) & \
                                 (data['trips']['direction_id']==direction)]
    grouped = filtered.groupby('shape_id')
    ordered = grouped.count().sort_values('route_id', ascending=False)
    return ordered.index[0]


def get_line_sets(shape_id):
    """
    given a shape_id, function returns the ordered set of n LineString coordinates
        that connect n+1 bus stops
    args: shape_id (string)
    returns: list of lists; inner lists each represent a single line segment between two stops
    """
    all_lines = data['shapes'].loc[data['shapes']['shape_id']==shape_id, :]
    # eg. shape_pt_sequence '12003' is the coordinates for point #3 within the line segment #12 
    grouped = all_lines.groupby(all_lines.shape_pt_sequence.map(lambda seq: seq / 1000))

    master = []
    for segment_sequence, segment_points in grouped:
        inter_stop_segment = list(segment_points.apply(
            lambda point: [point.shape_pt_lon, point.shape_pt_lat], axis=1))
        master.append(inter_stop_segment)
    return master


def get_stops(shape_id):
    """
    given a shape_id, function returns a setp of ordered bus stop coordinates,
        and each stop's stop_id
    args: shape_id (string)
    returns: [([], string)]: [(coordinates, stop_id)],
             headsign (string)
    """
    trip_id, headsign = list(data['trips'].loc[data['trips']['shape_id']==shape_id, \
                                              ['trip_id', 'trip_headsign']].iloc[0])
    
    filtered = data['stop_times'].loc[data['stop_times']['trip_id']==trip_id]
    merged = filtered.merge(data['stops'], how='inner')
    
    stop_list = list(merged.apply(lambda stop: (stop.stop_id, stop.stop_name, [stop.stop_lon, stop.stop_lat]), axis=1))
    return stop_list, headsign


def build_feature(feature_type, coordinates, stop_id, stop_name, stop_sequence):
    """
    builds a geojson-style feature (Point or LineString), with coordinates
        and metadata (stop_id, and stop_sequence integer)
    args: feature_type ("Point" or "LineString"), coordinates (list), stop_id (int), stop_sequence (int)
    returns: dict
    """
    return {"type": "Feature",
            "geometry": {
                "type": feature_type,
                "coordinates": coordinates
            },
            "properties": {
                "stop_id": stop_id,
                "stop_name": stop_name,
                "stop_sequence": stop_sequence
            }
        }


def write_geojson(route_id, direction, headsign, stop_list, line_list):
    """
    consumes route- and stop-level data to write to file a geojson object
        with all geometry and metadata attached
    args: route_id, (string) direction (intl 0 or 1), 
            headsign (string), stop_list (list), line_list (list)
    returns: none
    """
    meta_data = get_route_info(route_id)
    
    geo_dict = {"type": "FeatureCollection", "features": [], "properties": {}}
    
    # zipping n+1 stops to n LineStrings
    pairs = zip(stop_list, line_list)

    for sequence, pair in enumerate(pairs):
        stop_dict = build_feature("Point", pair[0][2], pair[0][0], pair[0][1], sequence)
        geo_dict["features"].append(stop_dict)
        line_dict = build_feature("LineString", pair[1], pair[0][0], pair[0][1], sequence)
        geo_dict["features"].append(line_dict)
    
    # finish by building a Point feature for the "last stop"
    last_stop = build_feature("Point", stop_list[-1][2], stop_list[-1][0], stop_list[-1][1], sequence + 1)
    geo_dict["features"].append(last_stop)
    
    # write metadata to FeatureCollection
    geo_dict["properties"]["route_id"] = route_id
    geo_dict["properties"]["short_name"] = meta_data[0]
    geo_dict["properties"]["long_name"] = meta_data[1]
    geo_dict["properties"]["route_color"] = meta_data[2]
    geo_dict["properties"]["headsign"] = headsign
    geo_dict["properties"]["direction"] = direction
    
    with open('data/profiles/{}_{}.geojson'.format(route_id, direction), 'w') as outfile:
        geojson.dump(geo_dict, outfile)


def flush_old_files():
    """
    removes existing geojson profiles from data directory
    args: none
    returns: none
    """
    print 'removing old profiles...'
    for geo in glob.glob('data/profiles/*.geojson'):
        os.remove(geo)


if __name__ == "__main__":
    flush_old_files()
    data = load_data()

    # number of new profiles to generate: unique routes x 2 directions
    all_files = len(data['trips']['route_id'].unique()) * 2
    i = 1
    for route_id in data['trips']['route_id'].unique():
        for direction in [0, 1]:
            try:
                shape_id = get_most_common_shape(route_id, direction)
            except:
                # cases where route/direction combination don't exist in MTA data; 
                # don't generate geojson
                print "FAILED: {} of {}: route {}, direction {} - doesn't exist" \
                      .format(i, all_files, route_id, direction)
                i+=1
                continue

            line_list = get_line_sets(shape_id)
            stop_list, headsign = get_stops(shape_id)
            print 'writing {} of {}: {}_{}.geojson'.format(i, all_files, route_id, direction)
            write_geojson(route_id, direction, headsign, stop_list, line_list)
            i+=1
    print 'refresh finished successfully.'

