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

        data: null,

		initializeDashboard: function(data, first) {
			console.log("initializing dashboard...");
			tc.data = data;

			// handle bad data error
			if (data["status"]=="error") {
				var current = $(location).attr('href');
				window.location.replace(current + "/404");
			}

			// set headline text
			//$("#selectRoute").text(data["route_id"]);
			$("#busLongName").text(data["long_name"]);

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
				gr.initializeCharts();
				tc.registerSelectionHandlers();
				tc.registerRouteChangeHandler();
			};

			// default to route-level stop selection
			tc.selection.stop = 0;
			tc.updateSelection();
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
			    console.log("original selection:", tc.selection);

			    // if this is the first stop selection
			    if (tc.selection.stop == 0) {
			    	console.log('1st stop selection:', justClicked.feature.properties.stop_id);
				    tc.selection.stop = [justClicked];
				    justClicked.setStyle(startMarkerStyle);

				// if this is the endpoint of a journey selection
				} else if (tc.selection.stop.length == 1){
					// check that journey is going in the right direction
					if (justClicked.feature.properties.stop_sequence > tc.selection.stop[0].feature.properties.stop_sequence) {
						console.log('2nd stop selection:', justClicked.feature.properties.stop_id);
						tc.selection.stop.push(justClicked);
						justClicked.setStyle(endMarkerStyle);
						paintJourney();
					} else {
						console.log("can't drive backwards!");
					};

				// have already selected a journey, so reset the map selection
				} else {
					resetMapStyle();
					tc.selection.stop = ['justClicked'];
					justClicked.setStyle(startMarkerStyle);
				};

				console.log("new selection:", tc.selection);
				tc.updateMetricDisplay();
			};

			function resetMapStyle() {
				console.log('resetting map style...');
				// revert marker and line styles to default values
				tc.markerGroup.eachLayer(function(layer){layer.setStyle(defaultMarkerStyle)});
				tc.lineGroup.eachLayer(function(layer){layer.setStyle(defaultLineStyle)});
				// reset stop selection to ALL (0)
				tc.selection.stop = 0;
				tc.updateMetricDisplay();

			};

			function paintJourney() {
				console.log("painting the journey...");
				var startSeq = tc.selection.stop[0].feature.properties.stop_sequence;
				var endSeq = tc.selection.stop[1].feature.properties.stop_sequence;
				console.log(startSeq, endSeq);
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
		        	// TODO - color first and last markers accordingly (route level)
			    };

		        if (feature.geometry.type == 'LineString') {
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
			$("#daySelect, #hourSelect, #dirSelect, #dateSelect, #metricSelect").on("change", tc.updateSelection);
		},


		registerRouteChangeHandler: function() {
			console.log("registering route change handler...");
			$("#routeSelect").change(function() {
				tc.resetDashboard($(this).val());
			});
		},


		resetDashboard:function(route) {
			console.log(`resetting dashboard for ${route}...`);

			$("#busLongName").text("Loading Bus...");

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


		updateSelection: function() {
			// scans all user toggles to update current selection (excluding bus stop)
			console.log(`changed ${this.id}; updating selection...`);
			console.log("original selection:", tc.selection)
			tc.selection.dayBin = $("option[name=daybin]:selected", "#daySelect").val();
			tc.selection.hourBin = $("option[name=hourbin]:selected", "#hourSelect").val();
			tc.selection.date = $("option[name=date]:selected", "#dateSelect").val();
			tc.selection.metric = $("input[name=metric]:checked", "#metricSelect").val();
			// only refresh the map if the direction selection has changed
			var newRoute = tc.data["route_id"];
			var newDirection = $("option[name=direction]:selected", "#dirSelect").val();
			if ((newDirection != tc.selection.direction) || (newRoute != tc.selection.route)) {
			//if (newDirection != tc.selection.direction) {
				console.log("direction selection has changed!");
				tc.selection.direction = newDirection;
				tc.selection.route = tc.data["route_id"];
				console.log("new selection:", tc.selection)
				tc.redrawMap();
			};
			console.log("new selection:", tc.selection)

			// TODO - put code here to update the view block that echos the current selection

			// refresh data table for all selection changes
			//tc.refreshTable();
			tc.updateMetricDisplay();
		},


		redrawMap: function() {
			console.log("redrawing map...");
			var dir = tc.selection.direction;
			// default the map view to direction '0' when user selects 'all' directions
			if (dir == "2") {
				dir = "0";
			} 
			console.log('direction to draw:', dir);

			// get approximate center point of route, to center map view on
			var stops = tc.data["directions"][dir]["geo"]["features"].filter(function(feat) {
							return feat["geometry"]["type"] == "Point";
						});
			// sort-->reverse ensures that coordinates are in correct lat/lon order
			var mapCenterArray = stops[Math.round(stops.length / 2)]["geometry"]["coordinates"].sort().reverse();
			var mapCenter = L.latLng(mapCenterArray);
			console.log("mapCenter:", mapCenter);
			// setView with coordinates and zoom level
			tc.mapObject.setView(mapCenter, 13);

			// remove markers and reset layer groups
			tc.markerGroup.eachLayer(function(layer){tc.mapObject.removeLayer(layer)});
			tc.markerGroup = L.layerGroup(),
			tc.lineGroup.eachLayer(function(layer){tc.mapObject.removeLayer(layer)});
			tc.lineGroup = L.layerGroup(),

			//console.log("adding data to map:", tc.data["directions"][dir]["geo"]);
			tc.mapLayer.addData(tc.data["directions"][dir]["geo"]);
		},


		updateMetricDisplay: function() {
			console.log("updating metric display...");
			
			var allDates = tc.data["directions"][tc.selection.direction]
				   				  ["daybins"][tc.selection.dayBin]
				   				  ["hourbins"][tc.selection.hourBin];

			var oneDay = {"route": null, "stops": {}};
			allDates["dates"][tc.selection.date]["stops"].forEach(function(stop) {
				var stopValues = {};
				for (var metricName in gr.stopMetricMap) {
					if (metricName != 'stop') {
						stopValues[metricName] = stop[gr.stopMetricMap[metricName]];
					};
				};
				oneDay["stops"][stop[gr.stopMetricMap['stop']]] = stopValues;
			});

			var routeData = allDates["dates"][tc.selection.date]["route"]
			var routeValues = {};
			for (var metricName in gr.routeMetricMap) {
				if (metricName != 'stop') {
					routeValues[metricName] = routeData[gr.routeMetricMap[metricName]];
				};
			};
			oneDay["route"] = routeValues;

			console.log('oneDay', oneDay);


			// handle the display of ROUTE vs. JOURNEY vs. STOP
			if  (tc.selection.stop == 0) {
				// route-level case
				var selectedStop = 0;
				console.log('updating metrics; route-level!');

			} else if (tc.selection.stop.length == 1){
				// stop-level case
				var selectedStop = tc.selection.stop[0].feature.properties.stop_id;
				console.log('updating metrics; stop-level!');

			} else {
				// journey-level case
				var selectedStop = tc.selection.stop.map(function(terminal){
					return terminal.feature.properties.stop_id
				});
				console.log('updating metrics; journey-level!');
			}

			//update table (no table anymore)
			//tc.refreshTable();

			// draw D3 charts
			gr.updateCharts(allDates,
							tc.selection.metric,
							selectedStop,
							tc.selection.date);

			// TODO - code to populate metric blocks according to selection here	
		}

	
		// refreshTable: function() {
		// 	console.log("refreshing table...");
		// 	// clear existing table
		// 	$("#dataTable").empty();
		// 	// write a header row
		// 	$("#dataTable").append(`<tr><th>Stop</th><th>EWT</th><th>RBT</th><th>Speed</th></tr>`);
		// 	// write data rows
		// 	tc.data["directions"][tc.selection.direction]
		// 			 ["daybins"][tc.selection.dayBin]
		// 			 ["hourbins"][tc.selection.hourBin]
		// 			 [tc.selection.date]
		// 			 .forEach(function(stop){
		// 			 	$("#dataTable").append(`<tr><td>${stop[0]}</td><td>${stop[1]}</td><td>${stop[2]}</td><td>${stop[3]}</td></tr>`);
		// 			 });
		// },


		
	};

	// add our tc object to global window scope
	this.tc = tc;
	console.log('running tc.js');
})();
