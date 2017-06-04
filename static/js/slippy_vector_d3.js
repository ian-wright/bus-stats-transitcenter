!function() {
    function addSlippyVectorLayer(canvas, options)
    {
        var prefix = prefixMatch(["webkit", "ms", "Moz", "O"]);
        var layer = d3
            .select(canvas.map.getPanes().overlayPane)
            .append("div")
            .attr("class", "layer");
        var obj = {
            options : {
                minZoom: 15,
                maxZoom: 18,
                minNativeZoom: 15,
                maxNativeZoom: 15,
                bounds: canvas.options.bounds,
            },
            canvasSize : canvas.map.getSize(),
            map: canvas.map,
            halfCanvasSize : canvas.map.getSize().multiplyBy(0.5),
            layer : layer,
            projection: null,
            zoom: null,
            tile: null,
            tileScale: null,
            realLevel: null,
            
            _viewReset: function () {
                var leafLevel = this.map.getZoom();
                if (leafLevel<this.options.minZoom || leafLevel>this.options.maxZoom) {
                    this.realLevel = -1;
                    this._clearTiles();
                    return;
                }
                this.realLevel = Math.max(Math.min(leafLevel, this.options.maxNativeZoom), this.options.minNativeZoom);
                this.tileScale = Math.pow(2, leafLevel-this.realLevel);
                var width = this.canvasSize.x/this.tileScale,
                    height = this.canvasSize.y/this.tileScale;
                this.tile = d3.geo.tile().size([width, height]);
                var levelScale = Math.pow(2, this.realLevel+8); 
                this.projection = d3.geo.mercator()
                    .scale(levelScale / 2 / Math.PI)
                    .translate([-width/2, -height/2]);
                this.zoom = d3.behavior.zoom()
                    .scale(levelScale)
                    .scaleExtent([1 << (this.options.minZoom+8), 1 << (this.options.maxZoom+8)]);
                this._canvasMoved();
            },

            _clearTiles: function () {
                this.layer
                    .selectAll(".tile")
                    .each(function(d) { if (this._xhr) this._xhr.abort(); })
                        .remove();
            },

            _canvasMoved: function () {
                if (this.realLevel<0) return;
                var center = this.map.getCenter();
                z = this.zoom.translate(this.projection([center.lng, center.lat]).map(function(x) { return -x; }));
                var tiles = this.tile
                    .scale(z.scale())
                    .translate(z.translate())
                ();
                var offset = this.map.latLngToLayerPoint(center).subtract(this.halfCanvasSize).divideBy(tiles.scale*this.tileScale);
                var translation = [tiles.translate[0]+offset.x, tiles.translate[1]+offset.y];
                var image = this.layer
                    .style(prefix + "transform", matrix3d(tiles.scale*this.tileScale, translation))
                    .selectAll(".tile")
                    .data(tiles, function(d) { return d; });

                image.exit()
                    .each(function(d) { if (this._xhr) this._xhr.abort(); })
                        .remove();

                var self = this;
                image.enter()
                    .append("svg")
                    .attr("class", "tile")
                    .style("left", function(d) { return d[0] * 256 + "px"; })
                    .style("top", function(d) { return d[1] * 256 + "px"; })
                    .each(function (d) {
                        var tl = L.point(d[0]*256, d[1]*256);
                        var tileBounds = L.latLngBounds([self.map.unproject(tl, self.realLevel),
                                                         self.map.unproject(L.point(tl.x+256, tl.y+256), self.realLevel)]);
                        var k = Math.pow(2, d[2]+8-1);
                        var tilePath = d3.geo.path().projection(d3.geo.mercator());
                        tilePath.projection()
                            .translate([k - tl.x, k - tl.y])
                            .scale(k / Math.PI);
                        if (tileBounds.intersects(self.options.bounds)) {
                            for (i=0; i<self.options.sublayer.length; ++i) {
                                var sublayer = self.options.sublayer[i];
                                var tileUrl = extendTileUrl(sublayer.url, d);
                                self._loadTile(self, this, sublayer, tileUrl, tilePath);
                            }
                        }
                    });
            },

            _loadTile: function(self, svgItem, sublayer, tileUrl, tilePath) {
                var svg         = d3.select(svgItem);
                var strokeColor = sublayer.strokeColor?sublayer.strokeColor:function () {return null;};
                var fillColor   = sublayer.fillColor?sublayer.fillColor:function () {return null;};
                var infoMessage = sublayer.infoMessage;
                var pathClass   = sublayer.pathClass;
                svgItem._xhr = d3.json(tileUrl, function(error, json) {
                    var items = svg.selectAll(".path")
                        .data(json.features)
                        .enter().append("path")
                        .attr("class", pathClass)
                        .attr("d", tilePath)
				        .on("mouseenter", function() { self.map._container.style.cursor = 'pointer';})
				        .on("mouseleave", function() { self.map._container.style.cursor = ''; })
                        .on("click", function(d) { self._showInfo(self, infoMessage, d); });
                    var sw = (items[0].length>0 && !items[0])?items.style("stroke-width"):2.0;
                    items
                        .style("stroke", function(d) { return strokeColor(d.properties); })
                        .style("fill", function(d) { return fillColor(d.properties); })
                        .style("stroke-width", function() { return sw/self.tileScale; });
                });
            },

            _showInfo: function (self, infoMessage, d) {
                var message = infoMessage(d.properties);
                if (message)
                    self.map.openPopup(message, self.map.containerPointToLatLng(d3.mouse(self.map._container)));
            },
        };
        L.Util.setOptions(obj, options);

        obj.map.on("zoomstart", function() { obj._clearTiles(); });
        obj.map.on("moveend", function() { obj._canvasMoved(); });
        obj.map.on("viewreset", function() { obj._viewReset(); });
        obj._viewReset();
        
        function matrix3d(scale, translate) {
            var k = scale / 256, r = scale % 1 ? Number : Math.round;
            return "matrix3d(" + [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, r(translate[0] * scale), r(translate[1] * scale), 0, 1 ] + ")";
        }

        function prefixMatch(p) {
            var i = -1, n = p.length, s = document.body.style;
            while (++i < n) if (p[i] + "Transform" in s) return "-" + p[i].toLowerCase() + "-";
            return "";
        }
            
        function extendTileUrl(url, d) {
            return L.Util.template(url, L.extend({z:d[2], x:d[0], y: d[1], s: (["a", "b", "c"][(d[0] * 31 + d[1]) % 3])}));
        }

        return obj;
    }
    
    busvis.addSlippyVectorLayer = addSlippyVectorLayer;
}();
