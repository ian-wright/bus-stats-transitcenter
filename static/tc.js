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
			    opacity: 1
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

			var time_x = [];
			var time_y = [];
			Object.keys(tc.selectionData).forEach(function(date) {
				time_x.push(date);
				time_y.push(tc.selectionData[date]["route"][tc.selection.metric]);
			});

			var monthLine = Object.create(tc.graphLineConfig);
			monthLine["x"] = time_x;
			monthLine["y"] = time_y;

			var weekLine = Object.create(tc.graphLineConfig);
			weekLine["x"] = time_x.slice(-7);
			weekLine["y"] = time_y.slice(-7);

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


		// drawRouteBarCharts: function() {
		// 	var blerp;
		// }

		drawJourneyLineCharts: function(data) {
			console.log("drawing journey line charts...");
			console.log(data);

			// just draw time series of two lines: awt + m_trip
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
			timeLayout["yaxis"] = {title: "Journey Time (mins"};
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
				x: ["Scheduled", "Average", "Planning"],
				y: [d.swt, d.awt, d.ewt_95],
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
				y: [d.s_trip, d.m_trip, d.trip_95],
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
			barLayout["bargap"] = 0.8;
			barLayout["bargroupgap"] = 0.01;
			barLayout["yaxis"] = {title: "Journey Time (mins"};
			barLayout["margin"] = {
				"l": 40,
				"r": 20,
				"b": 30,
				"t": 0,
				"pad": 0
			};
			barLayout["width"] = 600;
			barLayout["height"] = 360;

			// Plotly.newPlot("journey-bar-chart", data, barLayout, {displayModeBar: false});
			Plotly.newPlot("journey-bar-chart", data, barLayout, {displayModeBar: false});
		},

	};

	// add our tc object to global window scope
	this.tc = tc;
	console.log('running tc.js');
})();
