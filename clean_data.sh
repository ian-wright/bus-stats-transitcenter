#!/bin/bash

# June 6, 2017
# Ian Wright

# remove all but the first geojson in each bus routes' busvis.org data directory
# this is just to reduce the number of geodata that we carry throughout development
# ultimately we'll need only two geojson files per route (one for each direction)

for BUS in $HOME/school/capstone/tc_app/data/profiles/*; do
	i=0
	for SHAPE in $BUS/*.geojson; do
		if [ $i == '0' ]; then
			echo "keeping: $SHAPE"

			SHAPEDIR=$(dirname "${SHAPE}")
			NEW="$SHAPEDIR/${BUS##*/}.geojson"

			echo "renaming: $SHAPE to $NEW"  
			mv $SHAPE $NEW
		else
			echo "killing: $SHAPE"
			rm $SHAPE	
		fi
		let i=${i}+1
	done
done
