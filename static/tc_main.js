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

        rawData: null,
        selectionData: null,

        // utility object that maps stop_ids to names and sequences
        stopLookup: {0: {}, 1: {}},

        // for cleaning the accumulative charts - how many of the first trips in the route to ignore
        accumCutoff: 2,

        // for tempering the 95 percentile numbers; this number represents the fraction of a stop-to-stop
        // journey that would actually see 95th percentile stop-to-stop trip times (the remainder of the journey
        // uses mean times)
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

			// register tooltip
			$('[data-toggle="tooltip"]').tooltip()

			// setting up dashboard environment on first load
			if (first==true) {
				console.log('first map load...')
				map.initializeMap();
				tc.registerSelectionHandlers();
				tc.registerRouteChangeHandler();
			};

			// create a utility object for use in graphing and calculations
			tc.buildStopLookup();

			// default stop selection is placeholder "0"
			tc.selection.stop = 0;
			tc.updateController("heavy");
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


		// function builds a utility object used for looking up stop names and sequences
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

			// light --> changed: stop/metric/daybin --> (recompute metrics/graphs)
			// medium --> changed: hourbin/dateRange --> (rebuild data object, recompute metrics/graphs)
			// heavy --> changed: direction/route --> (redraw map, rebuild data object, recompute metrics/graphs)

			switch (level) {
				case "light":
					console.log("updateController: level LIGHT");
					// if this is a stop change, tc.selection.stop already changed at click event
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
					map.redrawMap();
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


		// transform rawData into object-style structure, given selections for direction, daybin, and hourbin
		objectifyData: function(rawData, dayBin) {
			console.log(`objectifying data ${rawData} for daybin: ${dayBin}`);
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


		computeTimeAveragedMetrics: function(filteredData) {
			console.log("computing time averaged metrics...");

			// averagers for route-level (pre-computed) metrics for grey box summary 'EWT' & 'SPEED'
			var ewtAverager = {sum: 0, count: 0};
			var speedAverager = {sum: 0, count: 0};

			// averagers for route-level (not pre-computed) for grey box summary '% OVER'
			var mTripAverager = {sum: 0, count: 0};
			var sTripAverager = {sum: 0, count: 0};
			var awtAverager = {sum: 0, count: 0};
			var swtAverager = {sum: 0, count: 0};

			// averager for stop-by-stop EWT for use in route-level bar chart
			var stopEwtAverager = {};
			// averager for stop-level sTrip + mTrip + trip95 (for cumulative chart and journey metrics)
			var stopTripAverager = {};
			// averager for stop-level SWT + AWT + 95WT (for journey metrics)
			var stopWaitAverager = {};

			// maybe use this to clean up the repetitive code below
			function accumulateSum(stop, metric, accumulator, value, weight) {
				return (accumulator[stop] ?
						accumulator[stop][metric]['sum'] += value * weight :
						value * weight)
			};

			function accumulateCount(stop, metric, accumulator, weight) {
				return (accumulator[stop] ?
						accumulator[stop][metric]['count'] += weight :
						weight)
			};

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
				};

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
						stopTripAverager[stop] = {
							m_trip: {
								sum: accumulateSum(stop, 'm_trip', stopTripAverager, stopData['m_trip'], stopData['count']),
								count: accumulateCount(stop, 'm_trip', stopTripAverager, stopData['count'])
							},
							s_trip: {
								sum: accumulateSum(stop, 's_trip', stopTripAverager, stopData['s_trip'], stopData['count']),
								count: accumulateCount(stop, 's_trip', stopTripAverager, stopData['count']) 
							},
							trip_95: {
								sum: accumulateSum(stop, 'trip_95', stopTripAverager, stopData['trip_95'], stopData['count']),
								count: accumulateCount(stop, 'trip_95', stopTripAverager, stopData['count'])
							}
						};

						// record a single stop's AWT, SWT, WT95 into the cumulative averager
						stopWaitAverager[stop] = {
							awt: {
								sum: accumulateSum(stop, 'awt', stopWaitAverager, stopData['awt'], stopData['count']),
								count: accumulateCount(stop, 'awt', stopWaitAverager, stopData['count'])
							},
							swt: {
								sum: accumulateSum(stop, 'swt', stopWaitAverager, stopData['swt'], stopData['count']),
								count: accumulateCount(stop, 'swt', stopWaitAverager, stopData['count']) 
							},
							ewt_95: {
								sum: accumulateSum(stop, 'ewt_95', stopWaitAverager, stopData['ewt_95'], stopData['count']),
								count: accumulateCount(stop, 'ewt_95', stopWaitAverager, stopData['count'])
							}
						};

						// add a single stop's EWT to averager, and preserve the stop_id for use in bar chart
						stopEwtAverager[stop] = {
							sum: (stopEwtAverager[stop] ?
								  stopEwtAverager[stop].sum + ((stopData['awt'] - stopData['swt']) * stopData['count']) :
								  (stopData['awt'] - stopData['swt']) * stopData['count']),
							count: (stopEwtAverager[stop] ?
									stopEwtAverager[stop].count += stopData['count'] :
									stopData['count'])
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

			// update route-level summary
			var timeAveraged = tc.computeTimeAveragedMetrics(filteredData);
			// apply conditional coloring to grey box summary numbers
			if (timeAveraged.avgEwt < 2.8) {
				ewttext = `${timeAveraged.avgEwt}`.fontcolor('red');
				var mintext = ` mins`.fontcolor('red');
		    } else {
				ewttext = `${timeAveraged.avgEwt}`.fontcolor('green');
				var mintext = ` mins`.fontcolor('green');
			};
					
			$("#route-ewt").html(ewttext);
			$("#mins").html(mintext);

			if (timeAveraged.percentOver < 15) {
				perctext = `${timeAveraged.percentOver} %`.fontcolor('red');
		    } else {
				perctext = `${timeAveraged.percentOver} %`.fontcolor('green');
			};
			
			$("#route-rbt").html(perctext);

			if (timeAveraged.avgSpeed < 4) {
				speedtext = `${timeAveraged.avgSpeed}`.fontcolor('red');
				var mphtext = ` mph`.fontcolor('red');
		    } else {
				speedtext = `${timeAveraged.avgSpeed}`.fontcolor('green');
				var mphtext = ` mph`.fontcolor('green');					
			};

			$("#route-speed").html(speedtext);
			$("#mph").html(mphtext);

			// draw route-level charts
			// console.log(`updating tab text from ${$("#long-chart-tab").innerText} to ${$("option[name=dateRange]:selected", "#dateRangeSelect")[0].innerText}`);
			$("#long-chart-tab").text($("option[name=dateRange]:selected", "#dateRangeSelect")[0].innerText);
			graph.drawRouteLineCharts();
			graph.drawRouteEwtChart(timeAveraged.stopEwt);
			graph.drawCumulativeLineChart(timeAveraged.stopTrips);

			// update journey metrics (only if a journey is selected on map)
			if (tc.selection.stop.constructor == Array && tc.selection.stop.length == 2) {

				var startId = tc.selection.stop[0].feature.properties.stop_id;
				var startName = tc.stopLookup[tc.selection.direction][startId]["name"]
				var endId = tc.selection.stop[1].feature.properties.stop_id;
				var endName = tc.stopLookup[tc.selection.direction][endId]["name"]
				// $("#stopNamePair").text(`${startName} TO ${endName}`);
				$("#startName").text(`${startName}`);
				$("#stopName").text(`${endName}`);

				var computed = tc.computeJourneyMetrics(
					startId,
					endId,
					timeAveraged.stopWaits,
					timeAveraged.stopTrips,
					filteredData
				);

				// draw journey-level charts
				graph.drawJourneyLineCharts(computed.timeSeries);
				graph.drawJourneyBarChart(computed.timeAveraged);

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
		}
	};

	// add main namespace to global window scope
	this.tc = tc;
	console.log('running tc_main.js');
})();
