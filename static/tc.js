(function(){

	var tc = {

		selection: {
            route: null,
            stop: null,
            direction: null,
            dayBin: null,
            hourBin: null,
            date: null
        },

        mapObject: null,
        mapLayer: null,

        data: null,

		initialize: function(data) {
			console.log("initializing...");
			this.data = data;

			// print header
			$("#bus_id").text(data["route_id"] + ": " + data["long_name"]);

			// set direction headsign selection options
			$("#dir0").text(data["directions"]["0"]["headsign"]);
			$("#dir1").text(data["directions"]["1"]["headsign"]);

			// dynamically insert date select options
			var counter = 0;
			Object.keys(data["directions"]["0"]["daybins"]["0"]["hourbins"]["0"]).reverse().forEach(function(day){
				if (counter == 0) {
					var option_elem = `<option name="date" value="${day}" selected="selected">${day}</option>`
				} else {
					var option_elem = `<option name="date" value="${day}">${day}</option>`
				};
				$("#dateSelect").append(option_elem);
				counter++;
			});

			// update user selection, refresh data, build map
			this.buildMap();
			this.updateSelection();
			this.registerHandlers();
		},

		buildMap: function() {
			console.log("building map...");

			// get approximate center point of route, to center map view on
			var stops = tc.data["directions"]["0"]["geo"]["features"]
						.filter(function(feat) {
							return feat["geometry"]["type"] == "Point";
						});
			// TODO - why is latlng reversed in current geojson format?
			var mapCenterArray = stops[Math.round(stops.length / 2)]["geometry"]["coordinates"].reverse();
			var mapCenter = L.latLng(mapCenterArray);
			console.log("mapCenter:", mapCenter);
			// setView with coordinates and zoom level
			tc.mapObject = L.map('map').setView(mapCenter, 13);

			// this is a basic "light" style raster map layer from mapbox
			// TODO - hide the accesstoken?
			L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/light-v9/tiles/256/{z}/{x}/{y}?access_token={accessToken}', {
    			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    			maxZoom: 18,
    			accessToken: 'pk.eyJ1IjoiaWZ3cmlnaHQiLCJhIjoiY2o0ZnJrbXdmMWJqcTMzcHNzdnV4bXd3cyJ9.1G8ErVmk7jP7PDuFp8KHpQ'
			}).addTo(tc.mapObject);

			// custom styling on stop markers
			var markerStyle = {
			    radius: 5,
			    fillColor: "#57068c",
			    fillOpacity: 0.6
			};

			var lineStyle = {
			    "color": "#57068c",
			    "weight": 1.5,
			    "opacity": 1
			};

			function buildPopup(feature, layer) {
			    // does this feature have a property named popupContent?
			    if (feature.properties && feature.properties.popupContent) {
			        layer.bindPopup(feature.properties.popupContent);
			    }
			    if (feature.properties && feature.properties.popupContent) {
			        layer.bindPopup(feature.properties.popupContent);
			    }
			}

			// create a geojson map layer, passing a function to generate custom markers from geo points
			// don't add any geo data to the layer at this stage (data added in refresh function)
			tc.mapLayer = L.geoJSON(false, {
    			pointToLayer: function (feature, latlng) {
        			return L.circleMarker(latlng, markerStyle);
    			},
    			onEachFeature: buildPopup,
    			style: lineStyle
    		}).addTo(tc.mapObject);
		},

		refreshMap: function() {
			console.log("refreshing map...");
			tc.mapLayer.clearLayers();
			tc.mapLayer.addData(tc.data["directions"][tc.selection.direction]["geo"]);
		},

		updateSelection: function() {
			console.log("updating selection...");
			tc.selection.route = tc.data["route_id"];
			tc.selection.dayBin = $("input[name=daybin]:checked", "#daySelect").val();
			tc.selection.hourBin = $("input[name=hourbin]:checked", "#hourSelect").val();
			tc.selection.date = $("option[name=date]:selected", "#dateSelect").val();
			var newDirection = $("option[name=direction]:selected", "#dirSelect").val();
			// only refresh map if the direction selection changes
			if (newDirection != tc.selection.direction) {
				tc.selection.direction = newDirection;
				tc.refreshMap();
			}
			// refresh data table for all seleciton changes
			tc.refreshTable();

		},

		refreshTable: function() {
			console.log("refreshing table...");
			// clear existing table
			$("#dataTable1").empty();
			$("#dataTable2").empty();
			// write a header row
			// $("#dataTable").append(`<tr><th>Stop</th><th>EWT</th></tr>`);
			// write data rows
			tc.data["directions"][tc.selection.direction]
					 ["daybins"][tc.selection.dayBin]
					 ["hourbins"][tc.selection.hourBin]
					 [tc.selection.date]
					 .forEach(function(stop){
					 	$("#dataTable1").append(`${stop[0]}`);
						$("#dataTable2").append(`${stop[1]}`);
					 });
		},

		registerHandlers: function() {
			console.log("registering handlers...");
			$("#daySelect, #hourSelect, #dirSelect, #dateSelect").on("change", this.updateSelection);
		}

	};
	// add our tc object to global window scope
	this.tc = tc;
})();
