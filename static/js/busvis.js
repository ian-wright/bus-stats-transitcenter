!function() {
    var busvis = {
        version: "0.0.1",

        // this is a variable of the busvis object 
        dataPath: "/data/profiles/",
        
        // this is a method of the busvis object 
        initialize: function(canvasId, inOptions) {
            var options = {
                center: [40.7127, -74.0059],
                zoom: 14,
                maxZoom: 18,
                bounds: L.latLngBounds(L.latLng(40.502860218134586,-73.7014082058679),
                                       L.latLng(40.91238545795432,-74.2523635421483)),
            };

            // jquery extends the options object to include the properties of the inOptions object
            $.extend(options, inOptions);
            // calling the busvis method 'loadRoutes', with an argument string of '/data/profiles/routes.json'
            busvis.loadRoutes(busvis.dataPath + "routes.json");
            busvis.parseUrl();
            busvis.loadProfile(busvis.selection.busLine);

            busvis.canvas = busvis.initSpatialMap(canvasId, options);
            busvis.createScalarBar();

            busvis.busLayer = L.geoJson(null, {
                style: busvis.busVisStyle,
                pointToLayer: busvis.createBusStop,
                onEachFeature: busvis.formatBusFeature,
            }).addTo(busvis.canvas.map);

            Mousetrap.bind('/', function() { $(".searchBusLine").focus(); }, 'keyup');

	        return busvis.canvas;
        },

        createScalarBar: function() {
            var legend = d3.select('#speedScalarBar')
                .append('ul')
                .style('text-align', 'center')
                .attr('class', 'list-inline scalarBar');

            var keys = legend.selectAll('li')
                .data(busvis.busLineLut.range());

            keys.enter().append('li')
                .attr('class', 'scalarBarBox')
                .text(function(d) { return busvis.busLineLut.invertExtent(d)[1]; })
                .style("background-color", function (d) { return d})
            ;

            legend = d3.select('#timeScalarBar')
                .append('ul')
                .style('text-align', 'center')
                .attr('class', 'list-inline scalarBar');

            var keys = legend.selectAll('li')
                .data(busvis.busStopLut.range());

            keys.enter().append('li')
                .attr('class', 'scalarBarBox')
                .text(function(d) { return busvis.busStopLut.invertExtent(d)[1]; })
                .style("background-color", function (d) { return d} )
            ;
        },

        parseUrl: function() {
            var params = document.URL.split('#')[0].split('?');
            if (params.length>1) {
                params = params[1].split('&');
                for (var k in params) {
                    param = params[k].split('=');
                    if (param[0]=='busLine' && param[1])
                        busvis.selection.busLine = param[1];
                }
            }
        },

        updateSelection: function() {
            var busLine   = busvis.profile.route_short_name;
            var direction = $('#groupDirection').children(".active").data("value");
            var hourBin   = $('#groupHourBin').children(".active").data("value");
            var shape     = $('#groupShape').children(".active").data("value");
            busvis.selection = {
                busLine   : busLine,
                direction : direction,
                hourBin   : hourBin,
                shape     : shape,
            };
        },
        
        updateSelectionFromClick: function() {
            var key = $(this).parent().data("key");
            var value = $(this).data("value");
            var curValue = busvis.selection[key];
            if (curValue!=value) {
                busvis.selection[key] = value;
                if (key!="shape") {
                    busvis.updateShapeGroup();
                }
                busvis.update();
            }
        },
 
        updateSpeedTypeFromClick: function() {
            var value = $(this).data("value");
            var curValue = busvis.speedType;
            if (curValue!=value) {
                busvis.speedType = value;
                busvis.update();
            }
        },
 
        update: function() {
            var dataUrl = (busvis.dataPath + busvis.selection.busLine + "/" + busvis.selection.direction + "_" +
                           busvis.selection.hourBin + "_" + busvis.selection.shape + ".geojson");
            var shapes = busvis.profile.directions[busvis.selection.direction].shapes[busvis.selection.hourBin];
            var shapeId = shapes.map(function (s) { return s[0];}).indexOf(busvis.selection.shape);
            busvis.alert();
            if (shapeId>=0) {
                $.getJSON(dataUrl, function(data) {
                    busvis.clearBusFeatures();
                    $(data.features).each(function(key, feature) {
                        busvis.busLayer.addData(feature);
                        if (feature.geometry.type=="LineString")
                            busvis.busLayer.setStyle(busvis.busLineStyle);
                    });
                    if (busvis.needZoom) {
                        busvis.canvas.map.fitBounds(busvis.busLayer.getBounds());
                        busvis.needZoom = false;
                    }
                });
            }
            else {
                busvis.alert("There is no bus data for the selection!");
            }
        },

        alert: function(message) {
            if (message)
                d3.select("#alertBox").attr("class", "alert alert-danger").html(message);
            else
                d3.select("#alertBox").attr("class", "alert").html("");
        },

        formatBusFeature: function (feature, layer) {
            if (feature.geometry.type=="LineString") {
                layer.bindPopup(busvis.formatSegmentPopup(feature));
            }
            else
                layer.bindPopup(busvis.formatStopPopup(feature));
            return ;
        },

        formatSegmentPopup: function (feature) {
            return ('Averge Bus Speed (including time at stops):<h5>'
                    + feature.properties.f.toFixed(2)
                    + ' mph</h5><br />Averge Road Speed (without time at stops):<h5>'
                    + feature.properties.r.toFixed(2)
                    + ' mph</h5>');
        },

        formatStopPopup: function (feature) {
            return ('<h4>' + feature.properties.n
                    + '</h4>Approximate Average Time at Stops:<h5>'
                    + feature.properties.d.toFixed(0)
                    + ' seconds</h5>');
        },

        clearBusFeatures: function() {
            busvis.busLayer.eachLayer(function (layer) { layer.unbindPopup(); });
            busvis.busLayer.clearLayers();
        },

        busStopLut: d3.scale.threshold().domain([30, 60, 120, 180, 300]).range(colorbrewer.RdYlGn[5].concat().reverse()),
        createBusStop: function (feature, latlng) {
            var fc = busvis.busStopLut(Math.min(feature.properties.d, 179));
            var style = {
                radius: 3,
                fillColor: fc,
                color: "#000",
                weight: 1,
                opacity: 1,
                fillOpacity: 1,
            };
            return L.circleMarker(latlng, style);
        },

        busLineLut: d3.scale.threshold().domain([3, 5, 10, 20, 50]).range(colorbrewer.RdYlGn[5]),
        busLineStyle: function(feature) {
            var color = busvis.busLineLut(Math.min(49, feature.properties[busvis.speedType]));
            return {
                color: color,
                opacity: 1,
                weight: 3,
                lineCap: "butt",
            };
        },

        loadRoutes: function (url) {
            // jquery gets 
            $.getJSON(url, function(json) {
                d3.select(".searchBusLine")
                    .selectAll("option").data(json)
                    .enter().append("option")
                    .attr("value", function (d) { return d; } )
                    .html(function (d) { return d; } );
                $(document).ready(function(){
                    $('.typeahead').typeahead();
                    $('.typeahead').typeahead('destroy');
                    $('#searchInput').typeahead({source:json});
                    $('#searchForm').submit(function(event){
                        event.preventDefault();
                        busLine = $('.searchBusLine').val();
                        busvis.loadProfile(busLine);
                    });
                    $(function () {
                        $('[data-toggle="tooltip"]').tooltip();
                    })
                });
            });
        },

        loadProfile: function (busLine) {
            var url = busvis.dataPath + busLine + "/profile.json";
            $.getJSON(url, function(json) {
                busvis.needZoom = true;
                busvis.selection.busLine = busLine;
                busvis.profile = json;
                busvis.updateProfile();
                busvis.updateSelection();
                busvis.update();
            });
        },

        loadProfileFromBadge: function () {
            var route = $(".busBadge", this).data("route");
            busvis.loadProfile(route);
        },

        updateProfile: function () {
            busvis.clearSignals();

            var profile = busvis.profile;

            // update Bus line name
            $("#busLine").html(profile.route_long_name);

            // update Bus route logo
            var busRoute = profile.route_short_name;
            $(".busLogo").css("background-color", "#" + profile.route_color);
            $(".busRoute").html(busRoute.replace("-", "<br />"));

            // update the directions
            // <a href="#" data-value="0" class="list-group-item busDirection active">BRONX PK via 149 ST via SOUTHRN</a> -->
            var busDirections = [];
            $.each(profile.directions, function (direction,v) {
                var headsign = v.headsign;
                if (headsign.length>40) {
                    headsign = headsign.substring(0, 40) + "...";
                }
                busDirections.push([direction, headsign, (busDirections.length==0)?"active":""]);
            });
            d3.selectAll(".list-group-item.busDirection").remove();
            var dataDirections = d3.select("#groupDirection")
                .selectAll(".list-group-item.busDirection")
                .data(busDirections, function(d) { return d[1];})
                .enter().append("a")
                .attr("class", function(d) { return "list-group-item busDirection " + d[2] })
                .attr("xlink:href", "#")
                .attr("data-value", function (d) { return d[0]; })
                .html(function (d) { return d[1]; });

            busvis.updateSelection();
            busvis.updateShapeGroup();
            busvis.setSignals();
        },

        updateShapeGroup: function() {
            // <label class="btn btn-default busShape active" data-value="BX190093">
            //   <input type="radio" value="BX190093" checked="checked" />BX190093 <span class="badge busShape">93%</span>
            // </label> 
            $('.btn.busShape').off('click', busvis.updateSelectionFromClick);
            d3.selectAll(".btn.busShape").remove();
            var shapes = busvis.profile.directions[busvis.selection.direction].shapes[busvis.selection.hourBin];
            var data = []
            $.each(shapes, function (k, v) {
                if (data.length<5) {
                    data.push([v[0], v[1], (data.length==0)?"active":""]);
                }
            });
            var labels = d3.select("#groupShape")
                .selectAll(".btn.busShape")
                .data(data, function(d) { return d[0]; })
                .enter().append("label")
                .attr("class", function(d) { return "btn btn-default busShape " + d[2] })
                .attr("data-value", function (d) { return d[0]; })
                .html(function (d) {
                    var html = '<input type="radio" value="' + d[0] + '"';
                    if (d[2]) {
                        html += 'checked="checked"';
                        busvis.selection.shape = d[0];
                    }
                    html += ' />' + d[0] + ' <span class="badge busShape">' + d[1].toFixed(0) + '%</span>';
                    return html;
                })
            ;
            $('.btn.busShape').on('click', busvis.updateSelectionFromClick);
        },
        
        clearSignals: function() {
            $('.btn.speedType').off('click', busvis.updateSpeedTypeFromClick);
            $('.btn.hourBin').off('click', busvis.updateSelectionFromClick);
            $('.list-group-item.busDirection').off('click', busvis.updateSelectionFromClick);
            $('.busBadgeButton').off('click', busvis.loadProfileFromBadge);
        },
        
        setSignals: function() {
            $('.list-group-item.busDirection').on('click', busvis.updateSelectionFromClick);
            $('.btn.hourBin').on('click', busvis.updateSelectionFromClick);
            $('.btn.speedType').on('click', busvis.updateSpeedTypeFromClick);
            $('.busBadgeButton').on('click', busvis.loadProfileFromBadge);
        },
        
        selection: {
            busLine   : 'Bx19',
            direction : null,
            hourBin   : null,
            shape     : null,
        },
        speedType: "f",

        canvas: null,
        busLayer: null,
        profile: null,
        needZoom: true,
    };

    busvis.dataPath = window.location.pathname.replace(/profiles\/.*/i, "data/profiles/");
    this.busvis = busvis;
}();
