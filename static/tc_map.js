(function(){

	var map = {

		mapObject: L.map('map'),
        mapLayer: null,
        markerGroup: L.layerGroup(),
        lineGroup: L.layerGroup(),

        initializeMap: function() {
			console.log("initializing map...");

			// reset the map any time a user clicks in empty map space
			map.mapObject.on({click: resetMapStyle});

			// this is a basic "light" style raster map layer from mapbox
			L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}', {
    			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    			maxZoom: 18,
    			accessToken: 'pk.eyJ1IjoiaWZ3cmlnaHQiLCJhIjoiY2o0ZnJrbXdmMWJqcTMzcHNzdnV4bXd3cyJ9.1G8ErVmk7jP7PDuFp8KHpQ'
			}).addTo(map.mapObject);

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

			// handler function for clicking map markers
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
				map.markerGroup.eachLayer(function(layer){layer.setStyle(defaultMarkerStyle)});
				map.lineGroup.eachLayer(function(layer){layer.setStyle(defaultLineStyle)});
				// reset stop selection to NONE (0)
				tc.selection.stop = 0;
				tc.updateController("light");

			};

			function paintJourney() {
				var startSeq = tc.selection.stop[0].feature.properties.stop_sequence;
				var endSeq = tc.selection.stop[1].feature.properties.stop_sequence;
				console.log(`painting the journey from ${startSeq} to ${endSeq}...`);
				// change marker style for journey markers
				map.markerGroup.eachLayer(function(layer){
					if ((layer.feature.properties.stop_sequence > startSeq) &&
						(layer.feature.properties.stop_sequence < endSeq)) {
						layer.setStyle(journeyMarkerStyle);
					};
				});
				// change line style for journey linestrings
				map.lineGroup.eachLayer(function(layer){
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
		        	map.markerGroup.addLayer(layer);
		        	layer._leaflet_id = feature.properties.stop_id;

			    } else if (feature.geometry.type == 'LineString') {
		        	// add line segment to group of all line segments
		        	map.lineGroup.addLayer(layer);
			    };

			};

			// create a geojson map layer, passing a function to generate custom markers from geo points
			// don't add any geo data to the layer at this stage (data added in refresh function)
			map.mapLayer = L.geoJSON(false, {
    			pointToLayer: function (feature, latlng) {
        			return L.circleMarker(latlng, defaultMarkerStyle);
    			},
    			onEachFeature: onEachFeature,
    			style: defaultLineStyle
    		}).addTo(map.mapObject);
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
			map.mapObject.setView(mapCenter, 13);

			// remove markers and reset layer groups
			map.mapLayer.clearLayers();
			map.markerGroup = L.layerGroup();
			map.lineGroup = L.layerGroup();
			map.mapLayer.addData(tc.rawData["directions"][dir]["geo"]);

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
			var startMarker = map.mapLayer.getLayer(startId)
			startMarker.fireEvent('click');
			var endMarker = map.mapLayer.getLayer(endId)
			endMarker.fireEvent('click');
		},
	};

	// add map namespace to global window scope
	this.map = map;
	console.log('running tc_map.js');
})();
