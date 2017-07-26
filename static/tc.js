(function(){

	var tc = {

		selection: {
			metric: null, //controlled by dropdown/toggle
            route: null, // ...
            direction: null, // ...
            dayBin: null, // ...
            hourBin: null, // ...
            date: null, // ...
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
				width: 3
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
			}

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

			// dynamically insert date select options
			// TODO - KILL THIS AFTER LINECHART/DATEPICKER IS IN
			Object.keys(data["directions"]["0"]["daybins"]["0"]["hourbins"]["0"]["dates"]).reverse().forEach(function(day){
				var option_elem = `<option name="date" value="${day}">${day}</option>`
				$("#dateSelect").append(option_elem);
			});

			// setting up dashboard environment on first load
			if (first==true) {
				console.log('first map load...')
				tc.initializeMap();
				//gr.initializeCharts();
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
					$("#stopNamePair").text(`${startName} to --`);

				// if this is the endpoint of a journey selection
				} else if (tc.selection.stop.length == 1){
					// check that journey is going in the right direction
					if (justClicked.feature.properties.stop_sequence > tc.selection.stop[0].feature.properties.stop_sequence) {
						console.log('2nd stop selection:', justClicked.feature.properties.stop_id);
						tc.selection.stop.push(justClicked);
						justClicked.setStyle(endMarkerStyle);
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
			        layer.bindPopup("<dl><dt>stop_name</dt>"
						           + "<dd>" + feature.properties.stop_name + "</dd>"
			        			   + "<dl><dt>stop_id</dt>"
						           + "<dd>" + feature.properties.stop_id + "</dd>"
						           + "<dt>stop_seq</dt>"
						           + "<dd>" + feature.properties.stop_sequence + "</dd>");

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

			$("#dateSelect, #metricSelect").change(function() {
				tc.updateController("light");
			});
			$("#daySelect, #hourSelect").change(function() {
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
			$("#route-ewt").text(`-- mins`);
			$("#route-rbt").text(`-- mins`);
			$("#route-speed").text(`-- mph`);
			$("#stop-chart div").remove();
			$("#month-chart div").remove();
			$("#week-chart div").remove();
			$("#accumulative-chart div").remove();

			// reset journey-level summary
			$("#stopNamePair").text("-- to --");
			$(".hilite").text("-- min");
			$("#countWarning").text("");
			$("#journey-month-chart div").remove();
			$("#journey-week-chart div").remove();
			$("#journey-bar-chart div").remove();

			// revert to default selections on new route (day=0, hour=0, dir=2)
			$("input[value=0]", "#hourSelect").prop('checked', true);
			$("input[value=0]", "#daySelect").prop('checked', true);
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

			// light --> stop/date/metric --> (metrics/graphs)
			// medium --> daybin/hourbin --> (rebuild data, metrics/graphs)
			// heavy --> direction/route --> (map, rebuild data, metrics/graphs)

			switch (level) {
				case "light":
					console.log("updateController: level LIGHT");
					//console.log("original selection:", tc.selection);
					// if this is a stop change, stop selection already changed at click event
					tc.selection.date = $("option[name=date]:selected", "#dateSelect").val();
					tc.selection.metric = $("input[name=metric]:checked", "#metricSelect").val();
					tc.updateMetricDisplay();
					break;
				case "medium":
					console.log("updateController: level MEDIUM");
					//console.log("original selection:", tc.selection);
					tc.selection.date = $("option[name=date]:selected", "#dateSelect").val();
					tc.selection.metric = $("input[name=metric]:checked", "#metricSelect").val();
					tc.selection.dayBin = $("option[name=daybin]:selected", "#daySelect").val();
					tc.selection.hourBin = $("option[name=hourbin]:selected", "#hourSelect").val();
					tc.buildDataObject();
					tc.updateMetricDisplay();
					break;
				case "heavy":
					console.log("updateController: level HEAVY");
					//console.log("original selection:", tc.selection);
					tc.selection.date = $("option[name=date]:selected", "#dateSelect").val();
					tc.selection.metric = $("input[name=metric]:checked", "#metricSelect").val();
					tc.selection.dayBin = $("option[name=daybin]:selected", "#daySelect").val();
					tc.selection.hourBin = $("option[name=hourbin]:selected", "#hourSelect").val();
					tc.selection.direction = $("option[name=direction]:selected", "#dirSelect").val();
					tc.selection.route = tc.rawData["route_id"];
					tc.buildDataObject();
					tc.redrawMap();
					//tc.updateMetricDisplay();
					break;
			};
			//console.log("new selection:", tc.selection);
		},


		buildDataObject: function(){
			console.log("building data object...");
			// get all historical data for given (direction, daybin, hourbin) selection
			var allDates = tc.rawData["directions"][tc.selection.direction]
				   				  ["daybins"][tc.selection.dayBin]
				   				  ["hourbins"][tc.selection.hourBin]
				   				  ["dates"];
			var selectionData = {};
			// transform allDates into object-style structure
			Object.keys(allDates).forEach(function (date) {
				var oneDay = {"route": null, "stops": {}};

				// get a single day's stop-level data, in object format
				allDates[date]["stops"].forEach(function(stop) {
					var stopValues = {};
					for (var metricName in tc.stopMetricMap) {
						if (metricName != 'stop') {
							stopValues[metricName] = stop[tc.stopMetricMap[metricName]];
						};
					};
					oneDay["stops"][stop[tc.stopMetricMap['stop']]] = stopValues;
				});

				// get a single day's route-level data, in object format
				var routeData = allDates[date]["route"]["0"];
				var routeValues = {};
				for (var metricName in tc.routeMetricMap) {
					if (metricName != 'stop') {
						routeValues[metricName] = routeData[tc.routeMetricMap[metricName]];
					};
				};

				oneDay["route"] = routeValues;
				selectionData[date] = oneDay;
			});
			tc.selectionData = selectionData;
			console.log("selectionData", selectionData);
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

			// console.log("adding data to map:", tc.rawData["directions"][dir]["geo"]);


			// set a default journey to display
			var oneFifth = Math.floor((stops.length) / 5);
			var startSeq = 2 * oneFifth;
			var endSeq = 3 * oneFifth;

			var startId = stops.filter(function(stop) {
				return stop.properties.stop_sequence == startSeq;
			})[0].properties.stop_id;
			console.log("startId", startId);

			var endId = stops.filter(function(stop) {
				return stop.properties.stop_sequence == endSeq;
			})[0].properties.stop_id;
			console.log("endId", endId);

			// emulate 'click' events on a sample journey through middle fifth of route
			tc.selection.stop = 0;
			var startMarker = tc.mapLayer.getLayer(startId)
			startMarker.fireEvent('click');
			var endMarker = tc.mapLayer.getLayer(endId)
			endMarker.fireEvent('click');

		},


		updateMetricDisplay: function() {
			console.log("updating metric display...");

			// update route-level summary
			$("#route-ewt").text(`${tc.selectionData[tc.selection.date]["route"]["ewt"]} mins`);
			$("#route-rbt").text(`${tc.selectionData[tc.selection.date]["route"]["rbt"]} mins`);
			$("#route-speed").text(`${tc.selectionData[tc.selection.date]["route"]["speed"]} mph`);

			// draw route-level charts
			tc.drawRouteLineCharts();
			tc.drawCumulativeLineCharts();
			//tc.drawRouteBarCharts();

			// update journey metrics
			if (tc.selection.stop.constructor == Array && tc.selection.stop.length == 2) {

				var startId = tc.selection.stop[0].feature.properties.stop_id;
				var startName = tc.stopLookup[tc.selection.direction][startId]["name"]
				var endId = tc.selection.stop[1].feature.properties.stop_id;
				var endName = tc.stopLookup[tc.selection.direction][endId]["name"]
				$("#stopNamePair").text(`${startName} to ${endName}`);

				var computed = tc.computeJourneyMetrics();
				var count = computed[tc.selection.date]["count"];
				console.log("computed journey:", computed);

				$(".journey-swt").text(`${computed[tc.selection.date]["swt"].toFixed(1)}`);
				$(".journey-s-trip").text(`${computed[tc.selection.date]["s_trip"].toFixed(1)}`);
				$(".journey-awt").text(`${computed[tc.selection.date]["awt"].toFixed(1)}`);
				$(".journey-m-trip").text(`${computed[tc.selection.date]["m_trip"].toFixed(1)}`);
				$(".journey-ewt-95").text(`${computed[tc.selection.date]["ewt_95"].toFixed(1)}`);
				$(".journey-trip-95").text(`${computed[tc.selection.date]["trip_95"].toFixed(1)}`);

				if (count < tc.countMin) {
					$("#countWarning").text(`BEWARE: metrics for this journey were computed w/ low sample size (n < ${tc.countMin})`);
				};

				// draw journey-level charts
				tc.drawJourneyLineCharts(computed);
				tc.drawJourneyBarCharts(computed);

			} else if (tc.selection.stop == 0) {
				// clear the journey-level metrics and graphs
				$("#stopNamePair").text("-- to --");
				$(".journey-metrics").text("--");
				$("#countWarning").text("");
				$("#journey-month-chart div").remove();
				$("#journey-week-chart div").remove();
				$("#journey-bar-chart div").remove();

			};

		},


		computeJourneyMetrics: function() {
			console.log("computing journey metrics...");

			var stopLookup = tc.stopLookup[tc.selection.direction];

			var startSeq = tc.selection.stop[0].feature.properties.stop_sequence;
			var endSeq = tc.selection.stop[1].feature.properties.stop_sequence;

			var computed = {};
			Object.keys(tc.selectionData).forEach(function(date) {

				var oneDay = {};
				Object.keys(tc.selectionData[date]["stops"]).forEach(function(stop_id) {

					var seq = stopLookup[stop_id]["sequence"];
					[["swt", "s_trip"], ["awt", "m_trip"], ["ewt_95", "trip_95"]].forEach(function(metricNames) {

						var waitTimeName = metricNames[0];
						var onboardTimeName = metricNames[1];

						if (seq == startSeq) {
							// originating bus stop; take wait time at this stop
							oneDay[waitTimeName] = tc.selectionData[date]["stops"][stop_id][waitTimeName];
							oneDay["count"] = tc.selectionData[date]["stops"][stop_id]["count"];
						};
						if ((seq >= startSeq) && (seq < endSeq)) {
							// mid-journey bus stop; sum all stop-to-stop trip times from (start) to (end-1)
							if (oneDay[onboardTimeName]) {
								oneDay[onboardTimeName] += tc.selectionData[date]["stops"][stop_id][onboardTimeName];
							} else {
								oneDay[onboardTimeName] = tc.selectionData[date]["stops"][stop_id][onboardTimeName];
							}
						};
					});
				});
				computed[date] = oneDay;
			});
			return computed;
		},


		drawRouteLineCharts: function() {
			console.log("drawing route line charts...");

			// MONA - UNCOMMENT FOR BX39 MOCKUP PURPOSE
			// var time_x = [];
			// var time_y = [];
			// Object.keys(tc.selectionData).forEach(function(date) {
			// 	time_x.push(date);
			// 	time_y.push(tc.selectionData[date]["route"][tc.selection.metric]);
			// });


			var time_x = ['2016-05-29 00:00:00',
 '2016-05-31 00:00:00',
 '2016-06-01 00:00:00',
 '2016-06-02 00:00:00',
 '2016-06-03 00:00:00',
 '2016-06-04 00:00:00',
 '2016-06-05 00:00:00',
 '2016-06-06 00:00:00',
 '2016-06-07 00:00:00',
 '2016-06-08 00:00:00',
 '2016-06-10 00:00:00',
 '2016-06-11 00:00:00',
 '2016-06-12 00:00:00',
 '2016-06-13 00:00:00',
 '2016-06-14 00:00:00',
 '2016-06-15 00:00:00',
 '2016-06-16 00:00:00',
 '2016-06-17 00:00:00',
 '2016-06-18 00:00:00',
 '2016-06-19 00:00:00',
 '2016-06-20 00:00:00',
 '2016-06-21 00:00:00',
 '2016-06-22 00:00:00',
 '2016-06-23 00:00:00',
 '2016-06-24 00:00:00',
 '2016-06-25 00:00:00',
 '2016-06-26 00:00:00',
 '2016-06-27 00:00:00'];
			var time_y = [ 1.216,  2.488,  1.894,  2.116,  1.95 ,  1.454,  0.566,  1.906,
        1.958,  1.786,  2.306,  1.424,  1.322,  2.17 ,  1.808,  1.74 ,
        1.312,  1.69 ,  2.174,  1.864,  1.412,  1.238,  1.742,  1.758,
        1.84 ,  1.598,  0.974,  1.932];

			var monthLine = Object.create(tc.graphLineConfig);
			monthLine["x"] = time_x;
			monthLine["y"] = time_y;
			monthLine["line"] = {
				shape: 'spline',
				color: "#57068c",
				weight: 1.5
			};
			monthLine["name"] = tc.metricHovers[tc.selection.metric];

			var weekLine = Object.create(tc.graphLineConfig);
			weekLine["x"] = time_x.slice(-7);
			weekLine["y"] = time_y.slice(-7);
			weekLine["name"] = tc.metricHovers[tc.selection.metric];

			var timeLayout = Object.create(tc.graphLayout);
			timeLayout["yaxis"] = {title: tc.axisNames[tc.selection.metric]};
			timeLayout["xaxis"] = {zeroline: false};
			timeLayout["margin"] = {
				"l": 40,
				"r": 20,
				"b": 30,
				"t": 0,
				"pad": 0
			};
			timeLayout["width"] = 640;
			timeLayout["height"] = 250;

			Plotly.newPlot("month-chart", [monthLine], timeLayout, {displayModeBar: false});
			Plotly.newPlot("week-chart", [weekLine], timeLayout, {displayModeBar: false});

			//only draw stop-by-stop chart for ewt and rbt (not speed)
			if (["ewt", "rbt"].includes(tc.selection.metric)) {

				// remove the "No stop-level chart for speed" warning if it's there
				$("#stop-chart div").remove();

				var stopNames = [];
				var stops_y = [];
				var stopEnum = [];
				var conversionMap = {"ewt": "awt", "rbt": "ewt_95"};
				Object.keys(tc.selectionData[tc.selection.date]["stops"]).forEach(function(stop){
					stopNames.push(tc.stopLookup[tc.selection.direction][stop]["name"]);
					stops_y.push(tc.selectionData[tc.selection.date]["stops"][stop][conversionMap[tc.selection.metric]]);
				});

				for (var i = 1; i <= stops_y.length; i++) {
				    stopEnum.push(i);
				};

				var stopLine = Object.create(tc.graphLineConfig);
				stopLine["x"] = stopEnum;
				stopLine["y"] = stops_y;
				stopLine["text"] = stopNames;
				stopLine["name"] = tc.metricHovers[tc.selection.metric];

				var stopsLayout = Object.create(tc.graphLayout);
				stopsLayout["xaxis"] = {range: [1, stopEnum.length + 1], zeroline: false};
				stopsLayout["yaxis"] = {title: tc.axisNames[tc.selection.metric]};
				stopsLayout["margin"] = timeLayout["margin"];
				stopsLayout["width"] = 640;
				stopsLayout["height"] = 250;

				Plotly.newPlot("stop-chart", [stopLine], stopsLayout, {displayModeBar: false});

			} else {
				// delete the stops chart
				$("#stop-chart div").remove();
				$("#stop-chart").append("<div>No stop-level chart for speed.</div>");
			};
		},

		//MONA: add cumulative
		drawCumulativeLineCharts: function(date) {
			console.log("drawing accumulative line charts...");

			stop_x = [ 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16,
       17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,
       34, 35, 36, 37, 38, 39, 40, 41];

			trip_y_actual =  [  1.4 ,   3.13,   5.12,   6.19,   7.14,   8.07,   9.54,  10.56,
        11.89,  16.97,  24.74,  25.7 ,  27.23,  28.08,  30.23,  31.3 ,
        31.84,  32.68,  34.37,  35.45,  36.49,  37.31,  38.85,  40.28,
        41.6 ,  42.64,  43.79,  44.83,  46.06,  47.59,  48.87,  51.01,
        53.1 ,  54.34,  54.34,  55.74,  56.39,  57.41,  58.08,  59.16,
        60.28,  60.83];

			trip_y_schedule = [  1.58,   4.23,   5.36,   6.5 ,   7.58,   8.26,  10.91,  12.04,
        14.33,  15.01,  15.01,  15.9 ,  17.18,  18.13,  20.4 ,  21.3 ,
        22.43,  23.62,  24.68,  26.27,  27.92,  28.53,  29.74,  31.57,
        33.04,  33.84,  35.02,  35.57,  36.29,  37.5 ,  39.64,  40.53,
        43.43,  44.35,  44.35,  45.08,  46.02,  49.97,  51.21,  52.45,
        53.62,  57.8 ];

			var accSchedLine = Object.create(tc.graphLineConfig);
			accSchedLine.name = "scheduled trip time";
			accSchedLine.x = stop_x;
			accSchedLine.y = trip_y_schedule;
			accSchedLine.line = {
		    color: '#aaaaaa',
		    width: 3,
				shape: 'spline',
				dash: 'dot'
		  };
			accSchedLine.showlegend = true;
			// accSchedLine.legend =  {"orientation": "h"};

			var accActualLine = Object.create(tc.graphLineConfig);
			accActualLine.name = "actual trip time";
			accActualLine.x = stop_x;
			accActualLine.y = trip_y_actual;
			accActualLine.line = {
				color: '#57068c',
		    width: 3,
				shape: 'spline'
			};
			accActualLine.showlegend = true;
			// accActualLine.legend =  {"orientation": "h"};

			var stackedAccData = [
				accSchedLine,
				accActualLine
			];

			var timeLayout = Object.create(tc.graphLayout);
		  timeLayout["yaxis"] = {title: "Accumulative Trip Time"};
		  timeLayout["margin"] = {
		    "l": 40,
		    "r": 20,
		    "b": 0,
		    "t": 30,
		    "pad": 0
		  };
		  timeLayout["width"] = 600;
		  timeLayout["height"] = 380;
			timeLayout["xaxis"] = {zeroline: false};
			timeLayout["showlegend"] = true;
			timeLayout["legend"]= {"orientation": "h"};

			Plotly.newPlot("accumulative-chart", stackedAccData, timeLayout, {displayModeBar: false});
		},


		drawJourneyLineCharts: function(data) {
			console.log("drawing journey line charts...");
			console.log(data);

			// MONA AGAIN
			// just draw time series of two lines: awt + m_trip
			// var time_x = [];
			// var time_y_wait = [];
			// var time_y_trip = [];
			// Object.keys(data).forEach(function(date) {
			// 	time_x.push(date);
			// 	time_y_wait.push(data[date]["awt"]);
			// 	time_y_trip.push(data[date]["m_trip"]);
			// });

			time_x = ['2016-05-29 00:00:00',
							 '2016-05-31 00:00:00',
							 '2016-06-01 00:00:00',
							 '2016-06-02 00:00:00',
							 '2016-06-03 00:00:00',
							 '2016-06-04 00:00:00',
							 '2016-06-05 00:00:00',
							 '2016-06-06 00:00:00',
							 '2016-06-07 00:00:00',
							 '2016-06-08 00:00:00',
							 '2016-06-10 00:00:00',
							 '2016-06-11 00:00:00',
							 '2016-06-12 00:00:00',
							 '2016-06-13 00:00:00',
							 '2016-06-14 00:00:00',
							 '2016-06-15 00:00:00',
							 '2016-06-16 00:00:00',
							 '2016-06-17 00:00:00',
							 '2016-06-18 00:00:00',
							 '2016-06-19 00:00:00',
							 '2016-06-20 00:00:00',
							 '2016-06-21 00:00:00',
							 '2016-06-22 00:00:00',
							 '2016-06-23 00:00:00',
							 '2016-06-24 00:00:00',
							 '2016-06-25 00:00:00',
							 '2016-06-26 00:00:00',
							 '2016-06-27 00:00:00',
							 '2016-06-28 00:00:00'];
 			time_y_wait = [7.88,
										 6.12,
										 5.49,
										 6.64,
										 7.02,
										 7.7,
										 6.66,
										 5.42,
										 5.97,
										 5.52,
										 5.52,
										 6.82,
										 7.19,
										 5.83,
										 4.94,
										 5.39,
										 4.81,
										 5.36,
										 7.94,
										 6.51,
										 5.57,
										 4.91,
										 5.44,
										 5.61,
										 5.7,
										 7.32,
										 7.28,
										 5.34,
										 5.47];
			time_y_trip = [ 13.54,  14.3 ,  15.4 ,  20.21,  15.  ,  12.88,  12.95,  15.68,
        15.28,  15.79,  14.81,  12.65,  14.13,  14.77,  15.18,  14.84,
        14.96,  15.61,  14.  ,  12.27,  14.9 ,  14.33,  14.84,  14.22,
        15.52,  13.07,  13.64,  13.79,  14.32];

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
			timeLayout["yaxis"] = {title: "Journey Time (mins)"};
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


		drawJourneyBarCharts: function(data) {
			console.log("drawing journey bar charts...");
			console.log(data);

			// draw three stacked bars for selected date: (swt + s_trip), (awt + m_trip), and (ewt_95 + trip_95)
			// var d3 = Plotly.d3;
			//
			// var WIDTH_IN_PERCENT_OF_PARENT = 90,
    	// 		HEIGHT_IN_PERCENT_OF_PARENT = 90;
			//
		  // var gd3 = d3.select("div[id='journey-bar-chart']")
			//     .append('div')
		  //     .style({
		  //       width: WIDTH_IN_PERCENT_OF_PARENT + '%',
		  //       'margin-left': (100 - WIDTH_IN_PERCENT_OF_PARENT) / 2 + '%',
		  //       height: HEIGHT_IN_PERCENT_OF_PARENT + '%',
		  //       'margin-top': 0
		  //     });
			//
		  // var journeyBarChart = gd3.node()


			var d = data[tc.selection.date];

			var waitData = {
				// MONA
				// x: ["Scheduled", "Average", "Planning"],
				// y: [d.swt, d.awt, d.ewt_95],
				x: ["Scheduled", "Average", "Planning"],
				y: [6.1, 7.88, 3.23],
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
				// MONA
				// y: [d.s_trip, d.m_trip, d.trip_95],
				y: [13.02, 14.56, 20.31],
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

			var data = [waitData, onboardData];

			var barLayout = Object.create(tc.graphLayout);
			// var layout = {barmode: 'stack'};
			barLayout["barmode"] = "stack";
			barLayout["autosize"] = true;
			barLayout["bargap"] = 0.5;
			barLayout["bargroupgap"] = 0.01;
			barLayout["yaxis"] = {title: "Journey Time (mins"};
			barLayout["margin"] = {
				"l": 40,
				"r": 20,
				"b": 30,
				"t": 10,
				"pad": 0
			};
			barLayout["width"] = 500;
			barLayout["height"] = 360;

			Plotly.newPlot("journey-bar-chart", data, barLayout, {displayModeBar: false});
		},

	};

	// add our tc object to global window scope
	this.tc = tc;
	console.log('running tc.js');
})();
