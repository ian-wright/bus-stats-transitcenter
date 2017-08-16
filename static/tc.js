(function(){

	var tc = {

		selection: {
			metric: null, //controlled by dropdown/toggle
            route: null, // ...
            direction: null, // ...
            dayBin: null, // ...
            hourBin: null, // ...
            dateRange: null, // ...
            stop: null //controlled by map
        },

        mapObject: L.map('map'),
        mapLayer: null,
        markerGroup: L.layerGroup(),
        lineGroup: L.layerGroup(),

        rawData: null,
        selectionData: null,

        stopLookup: {0: {}, 1: {}},

        // for low-n warning message
        countMin: 30,

        // for cleaning the accumulative charts - how many of the first trips in the route to ignore
        accumCutoff: 3,

        // for tempering the 95 percentile numbers; this fraction represents how much of a journey would
        // actually see 95th percentile stop-to-stop trip times
        fractionIs95: 0.2,

        routeMetricMap: {
	        stop: 0,
	        ewt: 1,
	        rbt: 2,
	        speed: 3,
      	},

      	stopMetricMap: {
	        stop: 0,
	        ewt_95: 1,
	        awt: 2,
	        swt: 3,
	        count: 4,
	        s_trip: 5,
	        m_trip: 6,
	        trip_95: 7
      	},

      	graphLineConfig: {
			type: 'scatter',
			mode: 'lines',
			line: {
				color: 'rgb(87, 6, 140)',
				width: 2
			}
		},

		graphLayout: {
			width: "100%",
			height: "100%",
			showlegend: false
		},

		axisNames: {
	        ewt: '(minutes)',
	        rbt: '(minutes)',
	        speed: '(mph)'
		},

		metricHovers: {
	        ewt: 'avg. wait',
	        rbt: 'planning buffer',
	        speed: 'avg speed'
		},


		initializeDashboard: function(data, first) {
			console.log("initializing dashboard...");
			tc.rawData = data;

			// handle bad data errors
			if (data["status"]=="error") {
				var current = $(location).attr('href');
				window.location.replace(current + "/404");
			};

			// set headline text
			$("#busLongName").text(data["long_name"]);
			// enable select2 on route selector
			$("#routeSelect").select2({
				dropdownAutoWidth : true,
				width: 'auto'
			});

			// set direction headsign selection options
			$("#dir0").text(data["directions"]["0"]["headsign"]);
			$("#dir1").text(data["directions"]["1"]["headsign"]);

			// setting up dashboard environment on first load
			if (first==true) {
				console.log('first map load...')
				tc.initializeMap();
				tc.registerSelectionHandlers();
				tc.registerRouteChangeHandler();
			};

			// create a utility object for use in graphing and calculations
			tc.buildStopLookup();

			tc.selection.stop = 0;
			tc.updateController("heavy");
		},


		initializeMap: function() {
			console.log("initializing map...");

			// reset the map any time a user clicks in empty map space
			tc.mapObject.on({click: resetMapStyle});

			// this is a basic "light" style raster map layer from mapbox
			// could experiment with other map styles
			// TODO - hide the accesstoken?
			L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}', {
    			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    			maxZoom: 18,
    			accessToken: 'pk.eyJ1IjoiaWZ3cmlnaHQiLCJhIjoiY2o0ZnJrbXdmMWJqcTMzcHNzdnV4bXd3cyJ9.1G8ErVmk7jP7PDuFp8KHpQ'
			}).addTo(tc.mapObject);

			// custom styling on stop markers
			var defaultMarkerStyle = {
			    color: "#57068c",
			    opacity: 1,
			    fillColor: "#57068c",
			    fillOpacity: 1,
			    radius: 4,
			};
			var startMarkerStyle = {
			    color: "#09bc63",
			    opacity: 1,
				fillColor: "#09bc63",
				fillOpacity: 1,
				radius: 7
			};
			var endMarkerStyle = {
			    color: "#bc2908",
			    opacity: 1,
				fillColor: "#bc2908",
				fillOpacity: 1,
				radius: 7
			};
			var journeyMarkerStyle = {
			    color: "#847d7b",
			    opacity: 1,
				fillColor: "#847d7b",
				fillOpacity: 1,
				radius: 4
			};
			var defaultLineStyle = {
			    color: "#57068c",
			    weight: 1.5,
			    opacity: 1,
					shape: 'spline'
			};
			var journeyLineStyle = {
			    color: "#847d7b",
			    weight: 2.5,
			    opacity: 1
			};

			function clickFeature(e) {
			    var justClicked = e.target;
			    console.log("clicking a stop...");

			    // if this is the first stop selection
			    if (tc.selection.stop == 0) {
			    	console.log('1st stop selection:', justClicked.feature.properties.stop_id);
				    tc.selection.stop = [justClicked];
				    justClicked.setStyle(startMarkerStyle);

				    var startId = tc.selection.stop[0].feature.properties.stop_id;
					var startName = tc.stopLookup[tc.selection.direction][startId]["name"]
					// $("#stopNamePair").text(`${startName} TO --`);
					$("#startName").text(`${startName}`);

				// if this is the endpoint of a journey selection
				} else if (tc.selection.stop.length == 1){
					// check that journey is going in the right direction
					if (justClicked.feature.properties.stop_sequence > tc.selection.stop[0].feature.properties.stop_sequence) {
						console.log('2nd stop selection:', justClicked.feature.properties.stop_id);
						tc.selection.stop.push(justClicked);
						justClicked.setStyle(endMarkerStyle);
						justClicked.closePopup();
						paintJourney();
						tc.updateController("light");
					} else {
						console.log("can't drive backwards!");
					};

				// have already selected a journey, so reset the map selection
				} else {
					console.log('1st stop selection:', justClicked.feature.properties.stop_id);
					resetMapStyle();
					tc.selection.stop = ['justClicked'];
					justClicked.setStyle(startMarkerStyle);
				};
			};

			function resetMapStyle() {
				console.log('resetting map style...');
				// revert marker and line styles to default values
				tc.markerGroup.eachLayer(function(layer){layer.setStyle(defaultMarkerStyle)});
				tc.lineGroup.eachLayer(function(layer){layer.setStyle(defaultLineStyle)});
				// reset stop selection to NONE (0)
				tc.selection.stop = 0;
				tc.updateController("light");

			};

			function paintJourney() {
				var startSeq = tc.selection.stop[0].feature.properties.stop_sequence;
				var endSeq = tc.selection.stop[1].feature.properties.stop_sequence;
				console.log(`painting the journey from ${startSeq} to ${endSeq}...`);
				// change marker style for journey markers
				tc.markerGroup.eachLayer(function(layer){
					if ((layer.feature.properties.stop_sequence > startSeq) &&
						(layer.feature.properties.stop_sequence < endSeq)) {
						layer.setStyle(journeyMarkerStyle);
					};
				});
				// change line style for journey linestrings
				tc.lineGroup.eachLayer(function(layer){
					if ((layer.feature.properties.stop_sequence >= startSeq) &&
						(layer.feature.properties.stop_sequence < endSeq)) {
						layer.setStyle(journeyLineStyle);
					};
				});
			};

			function onEachFeature(feature, layer) {
			    if (feature.geometry.type == 'Point') {
			    	// bind a popup to markers
			        layer.bindPopup("<dd>" + feature.properties.stop_name + "</dd>");

			        // bind a click event to markers, and control popup behaviour on mouseover
			        layer.on({
		            	click: clickFeature,
		            	mouseover: function(e){this.openPopup()},
		            	mouseout: function(e){this.closePopup()}
		        	});
		        	// add marker to group of all markers
		        	tc.markerGroup.addLayer(layer);
		        	layer._leaflet_id = feature.properties.stop_id;

			    } else if (feature.geometry.type == 'LineString') {
		        	// add line segment to group of all line segments
		        	tc.lineGroup.addLayer(layer);
			    };

			};

			// create a geojson map layer, passing a function to generate custom markers from geo points
			// don't add any geo data to the layer at this stage (data added in refresh function)
			tc.mapLayer = L.geoJSON(false, {
    			pointToLayer: function (feature, latlng) {
        			return L.circleMarker(latlng, defaultMarkerStyle);
    			},
    			onEachFeature: onEachFeature,
    			style: defaultLineStyle
    		}).addTo(tc.mapObject);
		},


		registerSelectionHandlers: function() {
			console.log("registering selection handlers...");

			$("#metricSelect, #dayBinSelect").change(function() {
				tc.updateController("light");
			});
			$("#hourBinSelect, #dateRangeSelect").change(function() {
				tc.updateController("medium");
			});
			$("#dirSelect").change(function() {
				tc.updateController("heavy");
			});
		},


		registerRouteChangeHandler: function() {
			console.log("registering route change handler...");
			$("#routeSelect").change(function() {
				tc.resetDashboard($("#routeSelect").val());
			});
		},


		resetDashboard:function(route) {
			console.log(`resetting dashboard for ${route}...`);
			$("#busLongName").text("Loading Bus...");

			// reset route-level summary
			$("#route-ewt").text(`-- `);
			$("#route-rbt").text(`-- `);
			$("#route-speed").text(`-- `);
			$("#mins h4").text(` mins`);
			$("#mph").text(` mph`);
			$("#stop-chart div").remove();
			$("#month-chart div").remove();
			$("#week-chart div").remove();
			$("#accumulative-chart div").remove();

			// reset journey-level summary
			// $("#stopNamePair").text("-- TO --");
			$("#startName").text("--");
			$("#stopName").text("--");
			$(".hilite").text("-- min");
			$("#countWarning").text("");
			$("#journey-month-chart div").remove();
			$("#journey-week-chart div").remove();
			$("#journey-bar-chart div").remove();

			// revert to default selections on new route (day=1, hour=1, dir=2)
			$("input[value=1]", "#hourBinSelect").prop('checked', true);
			$("input[value=1]", "#dayBinSelect").prop('checked', true);
			$("input[value=ewt]", "#metricSelect").prop('checked', true);
			$("option[value=2]", "#dirSelect").prop('selected', true);

			//get new data
			var dataURL = `/routes/${route}/data`;
	    	$.getJSON(dataURL, function(data) {
           		tc.initializeDashboard(data, first=false);
        	});

        	// change the URL to reflect new route (for aesthetics only!)
        	window.history.pushState({'new_route': route}, '', `/routes/${route}`);
		},


		buildStopLookup: function() {
			console.log("building stopLookup...");
			["0","1"].forEach(function(dir){
				var stops = tc.rawData["directions"][dir]["geo"]["features"].forEach(function(feat) {
					if (feat["geometry"]["type"] == "Point") {
						tc.stopLookup[dir][feat["properties"]["stop_id"]] = {"name": feat["properties"]["stop_name"],
						 													 "sequence": feat["properties"]["stop_sequence"]};
					};
				});
			});
		},


		updateController: function(level) {

			// light --> stop/metric/daybin --> (recompute metrics/graphs)
			// medium --> hourbin/dateRange --> (rebuild data object, recompute metrics/graphs)
			// heavy --> direction/route --> (redraw map, rebuild data object, recompute metrics/graphs)

			switch (level) {
				case "light":
					console.log("updateController: level LIGHT");
					// if this is a stop change, stop selection already changed at click event
					tc.selection.dateRange = $("option[name=dateRange]:selected", "#dateRangeSelect").val();
					tc.selection.metric = $("input[name=metric]:checked", "#metricSelect").val();
					tc.selection.dayBin = $("option[name=daybin]:selected", "#dayBinSelect").val();
					tc.updateMetricDisplay();
					break;
				case "medium":
					console.log("updateController: level MEDIUM");
					tc.selection.dateRange = $("option[name=dateRange]:selected", "#dateRangeSelect").val();
					tc.selection.metric = $("input[name=metric]:checked", "#metricSelect").val();
					tc.selection.dayBin = $("option[name=daybin]:selected", "#dayBinSelect").val();
					tc.selection.hourBin = $("option[name=hourbin]:selected", "#hourBinSelect").val();
					tc.buildDataObject();
					tc.updateMetricDisplay();
					break;
				case "heavy":
					console.log("updateController: level HEAVY");
					tc.selection.dateRange = $("option[name=dateRange]:selected", "#dateRangeSelect").val();
					tc.selection.metric = $("input[name=metric]:checked", "#metricSelect").val();
					tc.selection.dayBin = $("option[name=daybin]:selected", "#dayBinSelect").val();
					tc.selection.hourBin = $("option[name=hourbin]:selected", "#hourBinSelect").val();
					tc.selection.direction = $("option[name=direction]:selected", "#dirSelect").val();
					tc.selection.route = tc.rawData["route_id"];
					tc.buildDataObject();
					tc.redrawMap();
					// redrawMap() calls updateMetricsDisplay internally
					break;
			};
		},


		buildDataObject: function(){
			// we rebuild our main data object any time the DIRECTION, DATE RANGE or HOURBIN changes
			// any time we rebuild this data object, we include daybins for both weekday and weekends.
			// (this is because we need both wkday and wknds to draw complete time series)

			console.log("building data object...");
			// get all historical data for given (direction, daybin, hourbin) selection
			var allWkday = tc.rawData["directions"][tc.selection.direction]
				   				  ["daybins"][1]
				   				  ["hourbins"][tc.selection.hourBin]
				   				  ["dates"];
			console.log('allWkday', allWkday);
			wkdayObj = tc.objectifyData(allWkday, '1');

			var allWknd = tc.rawData["directions"][tc.selection.direction]
				   				  ["daybins"][2]
				   				  ["hourbins"][tc.selection.hourBin]
				   				  ["dates"];
			wkndObj = tc.objectifyData(allWknd, '2');

			// note that even if a user is filtering for wknds or wkdays, we need ALL observations in
			// the window to draw the time series charts
			var allData = Object.assign(wkdayObj, wkndObj);
			console.log("allData", allData);

			// filter our data for only those observations within the desired window (dateRange)
			var allDates = Object.keys(allData).map(function(dateStr){ return new Date(dateStr) });
			var latest = allDates.reduce(function (a, b) { return a > b ? a : b });

			switch (tc.selection.dateRange) {
				case "1":
					// last month
					var timeFrame = 30;
					break;
				case "2":
					// last year
					var timeFrame = 365;
					break;
				case "3":
					// all time
					var timeFrame = 3650;
					break;
			};

			var windowStart = new Date(latest.setDate(latest.getDate() - timeFrame));
			console.log(`timeframe: ${timeFrame}, windowstart: ${windowStart}`);

			var selectionData = {};
			Object.keys(allData).forEach(function(date) {
				if (new Date(date) >= windowStart) {
					selectionData[date] = allData[date];
				};
			});
			console.log("selectionData length", Object.keys(selectionData).length);
			tc.selectionData = selectionData;
		},


		objectifyData: function(rawData, dayBin) {
			console.log(`objectifying data ${rawData} for daybin: ${dayBin}`);
			// transform rawData into object-style structure, given selections for direction, daybin, and hourbin
			var objectData = {};
			Object.keys(rawData).forEach(function (date) {
				// object level for a single date
				var oneDay = {"route": null, "stops": {}};

				// build stop-level data for a single day
				if (rawData[date]["stops"]) {
					rawData[date]["stops"].forEach(function(stop) {
						// only include data for stop_ids that are found in the corresponding geo_profile
						if (Object.keys(tc.stopLookup[tc.selection.direction]).includes(stop[tc.stopMetricMap['stop']].toString())) {
							var stopValues = {};
							for (var metricName in tc.stopMetricMap) {
								if (metricName != 'stop') {
									stopValues[metricName] = stop[tc.stopMetricMap[metricName]];
								};
							};
							oneDay["stops"][stop[tc.stopMetricMap['stop']]] = stopValues;
						};
					});
				};

				// build route-level data for a single day
				if (rawData[date]["route"]) {
					var routeData = rawData[date]["route"];
					var routeValues = {};
					for (var metricName in tc.routeMetricMap) {
						if (metricName != 'stop') {
							routeValues[metricName] = routeData[tc.routeMetricMap[metricName]];
						};
					};
					oneDay["route"] = routeValues;
				};

				// tag the observation's daybin
				oneDay["dayBin"] = dayBin;
				objectData[date] = oneDay;
			});
			return objectData;
		},


		redrawMap: function() {
			console.log("redrawing map...");

			// default the map view to direction '0' when user selects 'all' directions
			var dir = tc.selection.direction;
			if (dir == "2") {
				dir = "0";
				console.log("direction ALL selected; defaulting to 0");
			};
			console.log('direction to draw:', dir);

			// get approximate center point of route, to center map view on
			var stops = tc.rawData["directions"][dir]["geo"]["features"].filter(function(feat) {
							return feat["geometry"]["type"] == "Point";
						});
			// sort-->reverse ensures that coordinates are in correct lat/lon order
			var mapCenterArray = stops[Math.round(stops.length / 2)]["geometry"]["coordinates"].sort().reverse();
			var mapCenter = L.latLng(mapCenterArray);
			console.log("mapCenter:", mapCenter);
			// setView with coordinates and zoom level
			tc.mapObject.setView(mapCenter, 13);

			// remove markers and reset layer groups
			tc.mapLayer.clearLayers();
			tc.markerGroup = L.layerGroup();
			tc.lineGroup = L.layerGroup();
			tc.mapLayer.addData(tc.rawData["directions"][dir]["geo"]);

			// set a default journey to display
			var oneFifth = Math.floor((stops.length) / 5);
			var startSeq = 2 * oneFifth;
			var endSeq = 3 * oneFifth;

			var startId = stops.filter(function(stop) {
				return stop.properties.stop_sequence == startSeq;
			})[0].properties.stop_id;
			console.log("default startId", startId);

			var endId = stops.filter(function(stop) {
				return stop.properties.stop_sequence == endSeq;
			})[0].properties.stop_id;
			console.log("default endId", endId);

			// emulate 'click' events for a sample journey through middle fifth of route
			tc.selection.stop = 0;
			var startMarker = tc.mapLayer.getLayer(startId)
			startMarker.fireEvent('click');
			var endMarker = tc.mapLayer.getLayer(endId)
			endMarker.fireEvent('click');
		},


		computeTimeAveragedMetrics: function(filteredData) {
			console.log("computing time averaged metrics...");
			// TODO - could make this function A LOT NICER... ugly af right now.

			// maybe use this to clean up the repetitive code below
			// function stopAvg(stop, metric, field, accumulator, value, weight) {
			// 	return (accumulator[stop] ?
			// 			accumulator[stop][metric][field] += value * weight :
			// 			value * weight)
			// };

			// route-level (pre-computed) metrics for grey box summary EWT + SPEED
			var ewtAverager = {sum: 0, count: 0};
			var speedAverager = {sum: 0, count: 0};

			// route-level (all stops) for grey box summary % OVER
			var mTripAverager = {sum: 0, count: 0};
			var sTripAverager = {sum: 0, count: 0};
			var awtAverager = {sum: 0, count: 0};
			var swtAverager = {sum: 0, count: 0};

			// stop-by-stop EWT for use in route-level bar chart
			var stopEwtAverager = {};
			// stop-level sTrip + mTrip + trip95 (for cumulative chart and journey metrics)
			var stopTripAverager = {};
			// stop-level SWT + AWT + 95WT (for journey metrics)
			var stopWaitAverager = {};

			// iterate through all DAYS in scope
			Object.keys(filteredData).forEach(function(date) {

				if (filteredData[date].route) {
					// using the provided route-level EWT
					if (filteredData[date].route.ewt) {
						ewtAverager.sum += filteredData[date].route.ewt;
						ewtAverager.count += 1;
					};
					// using the provided route-level SPEED
					if (filteredData[date].route.speed) {
						speedAverager.sum += filteredData[date].route.speed;
						speedAverager.count += 1;
					};
				}

				// route-level averagers for mTrip and sTrip sums on a given day
				var routeMTripAverager = {sum: 0, count: 0};
				var routeSTripAverager = {sum: 0, count: 0};

				// iterate through all STOPS per day
				Object.keys(filteredData[date].stops).forEach(function(stop) {

					var stopData = filteredData[date].stops[stop];

					if (stopData['m_trip'] &&
						stopData['s_trip'] &&
						stopData['trip_95'] &&
						stopData['awt'] &&
						stopData['swt'] &&
						stopData['ewt_95'] &&
						stopData['count']) {

						// add a single stop's SWT and AVG to overall averager
						swtAverager.sum += stopData['swt'] * stopData['count'];
						swtAverager.count += stopData['count'];
						awtAverager.sum += stopData['awt'] * stopData['count'];
						awtAverager.count += stopData['count'];

						// add a single stop's mTrip and sTrip to the route level sums
						routeMTripAverager.sum += stopData['m_trip'];
						routeMTripAverager.count += stopData['count'];
						routeSTripAverager.sum += stopData['s_trip'];
						routeSTripAverager.count += stopData['count'];;

						// record a single stop's mTrip, sTrip. trip95 into the cumulative averager
						stopTripAverager[stop] = {m_trip: {sum: (stopTripAverager[stop] ?
															  stopTripAverager[stop].m_trip.sum += stopData['m_trip'] * stopData['count'] :
															  stopData['m_trip'] * stopData['count']),
													  count: (stopTripAverager[stop] ?
															  stopTripAverager[stop].m_trip.count += stopData['count'] :
															  stopData['count'])},
												s_trip: {sum: (stopTripAverager[stop] ?
															  stopTripAverager[stop].s_trip.sum += stopData['s_trip'] * stopData['count'] :
															  stopData['s_trip'] * stopData['count']),
													  count: (stopTripAverager[stop] ?
															  stopTripAverager[stop].s_trip.count += stopData['count'] :
															  stopData['count'])},
												trip_95: {sum: (stopTripAverager[stop] ?
															  stopTripAverager[stop].trip_95.sum += stopData['trip_95'] * stopData['count'] :
															  stopData['trip_95'] * stopData['count']),
													  count: (stopTripAverager[stop] ?
															  stopTripAverager[stop].trip_95.count += stopData['count'] :
															  stopData['count'])}}

						// record a single stop's AWT, SWT, WT95 into the cumulative averager
						stopWaitAverager[stop] = {awt: {sum: (stopWaitAverager[stop] ?
															  stopWaitAverager[stop].awt.sum += stopData['awt'] * stopData['count'] :
															  stopData['awt'] * stopData['count']),
													  count: (stopWaitAverager[stop] ?
															  stopWaitAverager[stop].awt.count += stopData['count'] :
															  stopData['count'])},
												swt: {sum: (stopWaitAverager[stop] ?
															  stopWaitAverager[stop].swt.sum += stopData['swt'] * stopData['count'] :
															  stopData['swt'] * stopData['count']),
													  count: (stopWaitAverager[stop] ?
															  stopWaitAverager[stop].swt.count += stopData['count'] :
															  stopData['count'])},
												ewt_95: {sum: (stopWaitAverager[stop] ?
															  stopWaitAverager[stop].ewt_95.sum += stopData['ewt_95'] * stopData['count'] :
															  stopData['ewt_95'] * stopData['count']),
													  count: (stopWaitAverager[stop] ?
															  stopWaitAverager[stop].ewt_95.count += stopData['count'] :
															  stopData['count'])}}

						// add a single stop's EWT to averager, and preserve the stop_id for use in bar chart
						stopEwtAverager[stop] = {sum: (stopEwtAverager[stop] ?
													   stopEwtAverager[stop].sum + ((stopData['awt'] - stopData['swt']) * stopData['count']) :
													   (stopData['awt'] - stopData['swt']) * stopData['count']),
												count: (stopEwtAverager[stop] ?
														stopEwtAverager[stop].count += stopData['count'] :
														stopData['count'])};
						// testing.
						if (stop == 103333) {
							console.log(`after ${date}: ewt sum - ${stopEwtAverager[stop].sum}, ewt count - ${stopEwtAverager[stop].count}`);
						};

					};
				});

				// add a single day's mTrip and sTrip route sums to the overall averager
				if (routeMTripAverager.sum != 0) {
					mTripAverager.sum += routeMTripAverager.sum * routeMTripAverager.count;
					mTripAverager.count += routeMTripAverager.count;
				};
				if (routeSTripAverager.sum != 0) {
					sTripAverager.sum += routeSTripAverager.sum * routeSTripAverager.count;
					sTripAverager.count += routeSTripAverager.count;
				};

			});

			// for grey box summary EWT + SPEED
			var avgEwt = (ewtAverager.count == 0 ? "--" : (ewtAverager.sum / ewtAverager.count).toFixed(1));
			var avgSpeed = (speedAverager.count == 0 ? "--" : (speedAverager.sum / speedAverager.count).toFixed(1));

			// for grey box summary % OVER
			var avgSwt = (swtAverager.count == 0 ? null : swtAverager.sum / swtAverager.count);
			var avgAwt = (awtAverager.count == 0 ? null : awtAverager.sum / awtAverager.count);
			var avgMTripSum = (mTripAverager.count == 0 ? null : (mTripAverager.sum / mTripAverager.count));
			var avgSTripSum = (sTripAverager.count == 0 ? null : (sTripAverager.sum / sTripAverager.count));

			if (Boolean(avgAwt && avgSwt && avgMTripSum && avgSTripSum)) {
				var percentOver = ((((avgAwt + avgMTripSum) / (avgSwt + avgSTripSum)) - 1) * 100).toFixed(1);
			} else {
				var percentOver = "--";
			};

			// data structure for EWT-by-stop bar chart
			var stopEwt = {};
			Object.keys(stopEwtAverager).forEach(function(stop) {
				stopEwt[stop] = stopEwtAverager[stop].sum / stopEwtAverager[stop].count;
			});

			// data structure for stop-level trip times
			var stopTrips = {};
			Object.keys(stopTripAverager).forEach(function(stop) {
				stopTrips[stop] = {m_trip: (stopTripAverager[stop] ?
										   stopTripAverager[stop].m_trip.sum / stopTripAverager[stop].m_trip.count :
										   null),
								  s_trip:  (stopTripAverager[stop] ?
										   stopTripAverager[stop].s_trip.sum / stopTripAverager[stop].s_trip.count :
										   null),
								  trip_95:  (stopTripAverager[stop] ?
										   stopTripAverager[stop].trip_95.sum / stopTripAverager[stop].trip_95.count :
										   null)}
			});

			// data structure for stop-level wait times
			var stopWaits = {};
			Object.keys(stopWaitAverager).forEach(function(stop) {
				stopWaits[stop] = {awt: (stopWaitAverager[stop] ?
										   stopWaitAverager[stop].awt.sum / stopWaitAverager[stop].awt.count :
										   null),
								  swt:  (stopWaitAverager[stop] ?
										   stopWaitAverager[stop].swt.sum / stopWaitAverager[stop].swt.count :
										   null),
								  ewt_95:  (stopWaitAverager[stop] ?
										   stopWaitAverager[stop].ewt_95.sum / stopWaitAverager[stop].ewt_95.count :
										   null)}
			});

			return {
				avgEwt: avgEwt,
				avgSpeed: avgSpeed,
				percentOver: percentOver,
				stopEwt: stopEwt,
				stopTrips: stopTrips,
				stopWaits: stopWaits
			};
		},


		updateMetricDisplay: function() {
			console.log("updating metric display...");

			// filter data for only observations that match the weekday/weekend/all selection
			var filteredData = {};
			Object.keys(tc.selectionData).forEach(function(date) {
				if ((tc.selectionData[date].dayBin == tc.selection.dayBin) || (tc.selection.dayBin == "0")) {
					filteredData[date] = tc.selectionData[date];
				};
			});

			console.log("filteredData legnth", Object.keys(filteredData).length);

			// update route-level summary
			var timeAveraged = tc.computeTimeAveragedMetrics(filteredData);
			console.log("timeAveraged:", timeAveraged);
			// average EWT, route-level, all within-scope days
			if (timeAveraged.avgEwt > 1.76) {
						 ewttext = `${timeAveraged.avgEwt}`.fontcolor('red');
						 var mintext = ` mins`.fontcolor('red');
		       }
		      else
		      {
						ewttext = `${timeAveraged.avgEwt}`.fontcolor('green');
						var mintext = ` mins`.fontcolor('green');
					}
					// $("#route-ewt").text(`${timeAveraged.avgEwt}`);
					$("#route-ewt").html(ewttext);
					$("#mins").html(mintext);

					// (avg EWT +  sum(m_trip))/(avg SWT + sum(s_trip)) - 1
					if (timeAveraged.percentOver > 5)
		       {
						 perctext = `${timeAveraged.percentOver} %`.fontcolor('red');
		       }
		      else
		      {
						perctext = `${timeAveraged.percentOver} %`.fontcolor('green');
					}
					$("#route-rbt").html(perctext);

					// $("#route-rbt").text(`${timeAveraged.percentOver} %`);

					// // average speed, route-level, all within-scope days
					if (timeAveraged.avgSpeed < 7.41)
		       {
						 speedtext = `${timeAveraged.avgSpeed}`.fontcolor('red');
						 var mphtext = ` mph`.fontcolor('red');
		       }
		      else
		      {
						speedtext = `${timeAveraged.avgSpeed}`.fontcolor('green');
						var mphtext = ` mph`.fontcolor('green');
			}
			$("#route-speed").html(speedtext);
			$("#mph").html(mphtext);
			// $("#route-speed").text(`${timeAveraged.avgSpeed}`);

			// draw route-level charts
			// console.log(`updating tab text from ${$("#long-chart-tab").innerText} to ${$("option[name=dateRange]:selected", "#dateRangeSelect")[0].innerText}`);
			$(".long-chart-tab").text($("option[name=dateRange]:selected", "#dateRangeSelect")[0].innerText);
			tc.drawRouteLineCharts();
			tc.drawRouteEwtChart(timeAveraged.stopEwt);
			tc.drawCumulativeLineChart(timeAveraged.stopTrips);

			// update journey metrics (only if a journey is selected on map)
			if (tc.selection.stop.constructor == Array && tc.selection.stop.length == 2) {

				var startId = tc.selection.stop[0].feature.properties.stop_id;
				var startName = tc.stopLookup[tc.selection.direction][startId]["name"]
				var endId = tc.selection.stop[1].feature.properties.stop_id;
				var endName = tc.stopLookup[tc.selection.direction][endId]["name"]
				// $("#stopNamePair").text(`${startName} TO ${endName}`);
				$("#startName").text(`${startName}`);
				$("#stopName").text(`${endName}`);

				var computed = tc.computeJourneyMetrics(startId,
														endId,
														timeAveraged.stopWaits,
														timeAveraged.stopTrips,
														filteredData);

				// draw journey-level charts
				tc.drawJourneyLineCharts(computed.timeSeries);
				tc.drawJourneyBarChart(computed.timeAveraged);

			} else if (tc.selection.stop == 0) {
				// clear the journey-level metrics and graphs
				// $("#stopNamePair").text("-- TO --");
				$("#startName").text("--");
				$("#stopName").text("--");
				$(".journey-metrics").text("--");
				$("#countWarning").text("");
				$("#journey-month-chart div").remove();
				$("#journey-week-chart div").remove();
				$("#journey-bar-chart div").remove();
			};
		},


		computeJourneyMetrics: function(startId, endId, stopWaits, stopTrips, allData) {
			console.log("computing journey metrics...");

			var stopLookup = tc.stopLookup[tc.selection.direction];

			var startSeq = stopLookup[startId].sequence;
			var endSeq = stopLookup[endId].sequence;

			var timeSeries = {};
			Object.keys(allData).forEach(function(date) {

				var oneDay = {};
				if (allData[date]["stops"]) {
					Object.keys(allData[date]["stops"]).forEach(function(stop_id) {

						var seq = stopLookup[stop_id].sequence;
						[["swt", "s_trip"], ["awt", "m_trip"], ["ewt_95", "trip_95"]].forEach(function(metricNames) {

							var waitTimeName = metricNames[0];
							var onboardTimeName = metricNames[1];

							if (seq == startSeq) {
								// originating bus stop; take wait time at this stop
								oneDay[waitTimeName] = allData[date]["stops"][stop_id][waitTimeName];
								oneDay["count"] = allData[date]["stops"][stop_id].count;
							};
							if ((seq >= startSeq) && (seq < endSeq)) {
								// mid-journey bus stop; sum all stop-to-stop trip times from (start) to (end-1)
								if (oneDay[onboardTimeName]) {
									oneDay[onboardTimeName] += allData[date]["stops"][stop_id][onboardTimeName];
								} else {
									oneDay[onboardTimeName] = allData[date]["stops"][stop_id][onboardTimeName];
								};
							};
						});
					});
					timeSeries[date] = oneDay;
				};
			});

			var timeAveraged = {};
			Object.keys(stopWaits).forEach(function(stop_id) {
				var seq = stopLookup[stop_id].sequence;
				["swt", "awt", "ewt_95"].forEach(function(waitTimeName) {
					if (seq == startSeq) {
						// originating bus stop; take wait time at this stop
						timeAveraged[waitTimeName] = stopWaits[stop_id][waitTimeName];
					};
				});
			});

			Object.keys(stopTrips).forEach(function(stop_id) {
				var seq = stopLookup[stop_id].sequence;
				["s_trip", "m_trip", "trip_95"].forEach(function(onboardTimeName) {
					if ((seq >= startSeq) && (seq < endSeq)) {
						// mid-journey bus stop; sum all stop-to-stop trip times from (start) to (end-1)
						if (timeAveraged[onboardTimeName]) {
							timeAveraged[onboardTimeName] += stopTrips[stop_id][onboardTimeName];
						} else {
							timeAveraged[onboardTimeName] = stopTrips[stop_id][onboardTimeName];
						};
					};
				});
			});

			return {timeSeries: timeSeries, timeAveraged: timeAveraged};
		},


		drawRouteLineCharts: function() {
			console.log("drawing route line charts...");

			var time_x = [];
			var time_y = [];

			// build time series arrays
			Object.keys(tc.selectionData).sort().forEach(function(date) {
				if (tc.selectionData[date]["route"]) {
					time_x.push(date);
					time_y.push(tc.selectionData[date]["route"][tc.selection.metric]);
				};
			});

			// this will dynamically be one of: month, year, all-time
			var longLine = Object.create(tc.graphLineConfig);
			longLine["x"] = time_x;
			longLine["y"] = time_y;
			longLine["name"] = tc.metricHovers[tc.selection.metric];

			var weekLine = Object.create(tc.graphLineConfig);
			weekLine["x"] = time_x.slice(-7);
			weekLine["y"] = time_y.slice(-7);
			weekLine["name"] = tc.metricHovers[tc.selection.metric];

			var timeLayout = Object.create(tc.graphLayout);
			timeLayout["yaxis"] = {
				title: tc.axisNames[tc.selection.metric],
				hoverformat: '.1f'
			};
			timeLayout["xaxis"] = {zeroline: false};
			timeLayout["margin"] = {
				"l": 40,
				"r": 20,
				"b": 30,
				"t": 10,
				"pad": 0
			};
			timeLayout["width"] = 640;
			timeLayout["height"] = 270;

			Plotly.newPlot("long-chart", [longLine], timeLayout, {displayModeBar: false});
			Plotly.newPlot("week-chart", [weekLine], timeLayout, {displayModeBar: false});
		},


		drawRouteEwtChart: function (stopEwtMap) {
			console.log("drawing route EWT bar chart...");
			console.log(stopEwtMap);
			if (tc.selection.metric == 'ewt') {
				$("#stop-chart div").remove();

				// master data list for bar chart
				// items in form [ewt, stop_name, stop_sequence]
				var master = [];

				Object.keys(stopEwtMap).forEach(function(stop){
					master.push([
						stopEwtMap[stop],
						tc.stopLookup[tc.selection.direction][stop]["name"],
						tc.stopLookup[tc.selection.direction][stop]["sequence"]
					]);
				});

				// ensure stops are sorted by sequence
				master.sort(function(a, b) {
					return a[2] - b[2];
				});

				// generate x axis
				var x_count = [];
				for (i=0; i < master.length; i++) {
					x_count[i] = i+1;
				};

				var stopsLine = {
					x: x_count,
					y: master.map(function(oneBar) {return oneBar[0]}),
					type: "bar",
					text: master.map(function(oneBar) {return oneBar[1]}),
					name: tc.metricHovers[tc.selection.metric],
					marker: {
						color: 'rgb(87, 6, 140)'
					}
				};

				var stopsLayout = {
					xaxis: {
						range: [1, master.length + 1],
						zeroline: false,
						title: "Stop Sequence"
					},
					yaxis: {
						title: tc.axisNames[tc.selection.metric],
						hoverformat: '.1f'
					},
					margin: {
						"l": 40,
						"r": 20,
						"b": 30,
						"t": 15,
						"pad": 0
					},
					showlegend: false,
					width: 640,
					height: 250,
					bargap: 0.1
				};
				// Object.create(tc.graphLayout);
			// 	stopsLayout["xaxis"] = {range: [1, master.length + 1], zeroline: false};
			// 	stopsLayout["yaxis"] = {title: tc.axisNames[tc.selection.metric]};
			// 	stopsLayout["margin"] = {
			// 		"l": 40,
			// 		"r": 20,
			// 		"b": 30,
			// 		"t": 0,
			// 		"pad": 0
			// 	};
			// 	stopsLayout["width"] = 640;
			// 	stopsLayout["height"] = 250;


			// 	width: "100%",
			// height: "100%",
			// showlegend: false

				console.log(stopsLine, stopsLayout);

				Plotly.newPlot("stop-chart", [stopsLine], stopsLayout, {displayModeBar: false});

			} else {
				$("#stop-chart div").remove();
				$("#stop-chart").append("<div>No stop chart for speed.</div>")
			};
		},


		drawCumulativeLineChart: function(stopTrips) {
			console.log("drawing cumulative line charts...");

			console.log("stopTrips:", stopTrips);

			// master data list for cumulative chart
			// items in form [x_count, schedule_trip, actual_trip, stop_name, stop_sequence]
			var preMaster = [];

			Object.keys(stopTrips).forEach(function(stop) {
				preMaster.push([
					stopTrips[stop].s_trip,
					stopTrips[stop].m_trip,
					tc.stopLookup[tc.selection.direction][stop]["name"],
					tc.stopLookup[tc.selection.direction][stop]["sequence"]
				]);
			});

			// ensure stops are sorted by sequence
			preMaster.sort(function(a, b) {
				return a[3] - b[3];
			});

			// have the option here to cut off the first few trips, to clean up accumulative charts
			var master = preMaster.slice(tc.accumCutoff);

			// generate x axis
			var x_count = [];
			for (i=0; i < master.length; i++) {
				x_count[i] = i+1;
			};

			var sTrips = master.map(function(a) {return a[0]});
			var mTrips = master.map(function(a) {return a[1]});

			var sTripCum = [];
			sTrips.reduce(function(a, b, i) { return sTripCum[i] = a + b; }, 0);
			var mTripCum = [];
			mTrips.reduce(function(a, b, i) { return mTripCum[i] = a + b; }, 0);

			console.log("scheduled", sTripCum, "average", mTripCum);

			var accSchedLine = {
				name: "scheduled",
				x: x_count,
				y: sTripCum,
				line: {
			    	color: '#aaaaaa',
			    	width: 3,
					shape: 'spline',
					dash: 'dot'
				},
				showlegend: true
			};
			// accSchedLine.legend =  {"orientation": "h"};

			var accActualLine = {
				name: "actual",
				text: master.map(function(a) {return a[2]}),
				x: x_count,
				y: mTripCum,
				line: {
			    	color: '#57068c',
		    		width: 3,
					shape: 'spline'
				},
				showlegend: true
			};

			var stackedAccData = [
				accSchedLine,
				accActualLine
			];

			var timeLayout = {

				yaxis: {
					title: "(minutes)",
					hoverformat: '.1f'
				},
				margin: {
			    	"l": 40,
			    	"r": 20,
			    	"b": 0,
			    	"t": 40,
			    	"pad": 0
			  	},
				width: 600,
				height: 380,
				xaxis: {
					zeroline: false
				},
				showlegend: true,
				legend: {"orientation": "h"}
			};

			Plotly.newPlot("accumulative-chart", stackedAccData, timeLayout, {displayModeBar: false});
		},


		drawJourneyLineCharts: function(data) {
			console.log("drawing journey line charts...");
			console.log(data);

			var time_x = [];
			var time_y_wait = [];
			var time_y_trip = [];
			Object.keys(data).forEach(function(date) {
				time_x.push(date);
				time_y_wait.push(data[date]["awt"]);
				time_y_trip.push(data[date]["m_trip"]);
			});

			var monthWaitLine = Object.create(tc.graphLineConfig);
			monthWaitLine.name = "avg. wait time";
			monthWaitLine.x = time_x;
			monthWaitLine.y = time_y_wait;
			monthWaitLine.fill = 'tozeroy';
			monthWaitLine.line = {
				color: 'rgb(74, 79, 85)',
				width: 3
			};
			monthWaitLine.showlegend = false;

			var monthTripLine = Object.create(tc.graphLineConfig);
			monthTripLine.name = "avg. trip time";
			monthTripLine.x = time_x;
			monthTripLine.y = time_y_trip;
			monthTripLine.fill = 'tonexty';
			monthTripLine.showlegend = false;

			var stackedMonthData = [
				monthWaitLine,
				monthTripLine
			];

			var weekWaitLine = Object.create(monthWaitLine);
			weekWaitLine.x = time_x.slice(-7);
			weekWaitLine.y = time_y_wait.slice(-7);

			var weekTripLine = Object.create(monthTripLine);
			weekTripLine.x = time_x.slice(-7);
			weekTripLine.y = time_y_trip.slice(-7);

			var stackedWeekData = [
				weekWaitLine,
				weekTripLine
			];

			var timeLayout = Object.create(tc.graphLayout);
			timeLayout["yaxis"] = {
				title: "Journey Time (mins)",
				hoverformat: '.1f'
			};
			timeLayout["margin"] = {
				"l": 40,
				"r": 20,
				"b": 30,
				"t": 20,
				"pad": 0
			};
			timeLayout["width"] = 600;
			timeLayout["height"] = 300;

			function stackedArea(stackedData) {
				for(var i=1; i<stackedData.length; i++) {
					for(var j=0; j<(Math.min(stackedData[i]['y'].length, stackedData[i-1]['y'].length)); j++) {
						stackedData[i]['y'][j] += stackedData[i-1]['y'][j];
					}
				}
				console.log("stackedData", stackedData);
				return stackedData;
			};

			Plotly.newPlot("journey-month-chart", stackedArea(stackedMonthData), timeLayout, {displayModeBar: false});
			Plotly.newPlot("journey-week-chart", stackedArea(stackedWeekData), timeLayout, {displayModeBar: false});
		},


		drawJourneyBarChart: function(data) {
			console.log("drawing journey bar charts...");

			// draw three stacked bars for selected date: (swt + s_trip), (awt + m_trip), and (ewt_95 + trip_95)

			var waitData = {
				// MONA
				x: ["Scheduled", "Average", "Planning"],
				y: [data.swt, data.awt, data.ewt_95 + data.swt],
				// x: ["Scheduled", "Average", "Planning"],
				// y: [6.1, 7.88, 3.23],
				name: 'Wait Time',
				type: 'bar',
				marker: {
					color: 'rgb(74, 79, 85)',
					line: {
				      color: 'rgb(74, 79, 85)',
				      width: 2
				    }
				},
				showlegend: false,
				opacity: 0.5
			};

			var onboardData = {
				x: ["Scheduled", "Average", "Planning"],
				// here, we temper our 95th percentile trip time, by mixing it with our average trip time at the specified fraction
				y: [data.s_trip, data.m_trip, (tc.fractionIs95 * data.trip_95) + ((1 - tc.fractionIs95) * data.m_trip)],
				// y: [13.02, 14.56, 20.31],
				name: 'Onboard Time',
				type: 'bar',
				marker: {
					color: 'rgb(87, 6, 140)',
					line: {
				      color: 'rgb(87, 6, 140)',
				      width: 2,
				    }
				},
				showlegend: false,
				opacity: 0.5
			};

			var barData = [waitData, onboardData];

			var barLayout = Object.create(tc.graphLayout);
			barLayout["barmode"] = "stack";
			barLayout["autosize"] = true;
			barLayout["bargap"] = 0.3;
			barLayout["bargroupgap"] = 0.02;
			barLayout["yaxis"] = {
				title: "Journey Time (mins",
				hoverformat: '.1f'
			};
			barLayout["margin"] = {
				"l": 40,
				"r": 20,
				"b": 30,
				"t": 10,
				"pad": 0
			};
			barLayout["width"] = 300;
			barLayout["height"] = 360;

			Plotly.newPlot("journey-bar-chart", barData, barLayout, {displayModeBar: false});
		},

	};

	// add our tc object to global window scope
	this.tc = tc;
	console.log('running tc.js');
})();
