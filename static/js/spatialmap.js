!function() {
    function initSpatialMap(canvasId, options)
    {
        var maps = [['http://api.mapbox.com/v4/mapbox.light/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiaHZvIiwiYSI6IjRiZGE3MzgyZTY1NDMxNDM5MWVlNWI4NjJlYWNiNzg5In0.0wAii2HlaIlU61wWDc0MBA',
                     {attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
                      '&copy; <a href="http://cartodb.com/attributions">MapBox</a> base maps, ' +
                      '&copy; <a href="http://cusp.nyu.edu">NYU CUSP</a> analysis &amp; visualization'}],
                    ['https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
                     {attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
                      '&copy; <a href="http://cartodb.com/attributions">CartoDB</a> base maps, ' +
                      '&copy; <a href="http://cusp.nyu.edu">NYU CUSP</a> analysis &amp; visualization'}],
                    ['http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                     {attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
                      '&copy; <a href="http://cartodb.com/attributions">CartoDB</a> base maps, ' +
                      '&copy; <a href="http://cusp.nyu.edu">NYU CUSP</a> analysis &amp; visualization'}],
                    ['https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
                     {attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
                      '&copy; <a href="http://cartodb.com/attributions">CartoDB</a> base maps, ' +
                      '&copy; <a href="http://cusp.nyu.edu">NYU CUSP</a> analysis &amp; visualization'}]];
        var mapId = 3;

        var canvas = {
            options : {
                center: [40.7127, -74.0059],
                zoom  : 13,
                bounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
                layers: [L.tileLayer(maps[mapId][0], maps[mapId][1])],
                closePopupOnClick : false,
            },
            map: null,
            bus: null,
        };
        L.Util.setOptions(canvas, options);
        canvas.map = L.map(canvasId, canvas.options);
        return canvas;
    }


    function busLineStyle(feature) {
        return {
            color: "#000000",
        };
    }
    
    busvis.initSpatialMap = initSpatialMap;
}();
