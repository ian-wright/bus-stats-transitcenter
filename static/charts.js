(function(){

  var gr = {

    initializeCharts: function() {
      console.log("initializing charts...");

      gr.monthChart = d3.select("#month-chart").append("svg")
                    .attr("class", "graph")
                    .attr("width","640")
                    .attr("height","240");

      gr.weekChart = d3.select("#week-chart").append("svg")
                      .attr("class", "graph")
                      .attr("width","640")
                      .attr("height","240");

      gr.stopChart = d3.select("#stop-chart").append("svg")
                      .attr("class", "graph")
                      .attr("width","640")
                      .attr("height","240");

      gr.margin = {top: 20, right: 40, bottom: 30, left: 50};

      gr.width = +gr.monthChart.attr("width") - gr.margin.left - gr.margin.right;
      gr.height = +gr.monthChart.attr("height") - gr.margin.top - gr.margin.bottom;

      gr.x = d3.scaleTime().range([0, gr.width]);
      gr.y = d3.scaleLinear().range([gr.height, 0]);

      gr.parseTime = d3.timeParse("%Y-%m-%d");

      gr.monthLine = d3.line()
              .curve(d3.curveLinear)
              .x(function(d){ return gr.x(d.date);})
              .y(function(d){ return gr.y(d.metric);});
      gr.weekLine = d3.line()
                .curve(d3.curveLinear)
                .x(function(d){ return gr.x(d.date);})
                .y(function(d){ return gr.y(d.metric);});
      gr.stopLine = d3.line()
                .curve(d3.curveLinear)
                .x(function(d){ return gr.x(d.stop);})
                .y(function(d){ return gr.y(d.metric);});

      gr.routeMetricMap = {
        'stop': 0,
        'ewt': 1,
        'rbt': 2,
        'speed': 3,
      };

      gr.stopMetricMap = {
        'stop': 0,
        'ewt_95': 1,
        'awt': 2,
        'swt': 3,
        'count': 4,
        's_trip': 5,
        'm_trip': 6,
        'trip_95': 7
      };

      gr.nameMap = {
        'ewt': 'Estimated Wait Time (min)',
        'rbt': 'Reliability Buffer Time (min)',
        'speed': 'Speed (mph)',
        'awt': 'Average Wait Time (min)',
        'swt': 'Scheduled Wait Time (min)',
      };
    },

    updateCharts: function(data, metric, stop, date) {
      console.log(`updating charts: metric: ${metric}, stop: ${stop}, date: ${date}:`, data);

      // clear existing data from charts
      d3.selectAll(".graph > *").remove();


      //-------------------30 DAYS----------------------------------------------------------------------------
      console.log("drawing all dates chart...");

      var g1 = gr.monthChart.append("g")
                        .attr("transform", "translate(" + gr.margin.left + "," + gr.margin.top + ")");

      var dateArray1 = [];
      var metricArray1 = [];

      console.log('stop:', stop);
      console.log('metric:', metric);

      // TODO - handle the JOURNEY case

      Object.keys(data).forEach(function(date) {
          // find the selected stop and extract datapoint
          var selectedStop = data[date].filter(function(stopData) {
            return stopData[gr.metricMap['stop']] == stop;
          });
          // build data and metric arrays incrementally (for matching stops)
          if (selectedStop.length == 1) {
            dateArray1.push(date);
            metricArray1.push(selectedStop[0][gr.metricMap[metric]]);
          };
      });

      var chartcontent1 = [];
      for (var i = 0; i < dateArray1.length; i++) {
        chartcontent1.push({'date':gr.parseTime(dateArray1[i]), 'metric':metricArray1[i]});
      }

      gr.x.domain(d3.extent(chartcontent1, function(d,i) { return d.date; }));
      gr.y.domain([0,d3.max(metricArray1)]);

      function make_x_gridlines(x) {
          return d3.axisBottom(x)
              .ticks(7)
      }

      // gridlines in y axis function
      function make_y_gridlines(y) {
          return d3.axisLeft(y)
              .ticks(5)
      }

      // add the X gridlines
      g1.append("g")
          .attr("class", "grid")
          .attr("transform", "translate(0," + gr.height1 + ")")
          .attr("stroke-width", "2")
          .call(make_x_gridlines(gr.x)
              .tickSize(-gr.height1)
              .tickFormat("")
          )

      // add the Y gridlines
      g1.append("g")
          .attr("class", "grid")
          .attr("stroke-width", "2")
          .call(make_y_gridlines(gr.y)
              .tickSize(-gr.monthwidth)
              .tickFormat("")
          )

      g1.append("g")
          .attr("transform", "translate(0," + gr.height1 + ")")
          .call(d3.axisBottom(gr.x).ticks(7))
          .select(".domain");

      //yaxis
      g1.append("g")
          .call(d3.axisLeft(gr.y).ticks(5))
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.71em");

      g1.append("text")
                .attr("text-anchor", "middle")
                .attr("transform", "translate(" +(-20) +","+(gr.height1/2)+")rotate(-90)")
                .text(gr.nameMap[metric]);

      g1.append("path")
          .datum(chartcontent1)
          .attr("class", "line")
          .attr("d", gr.monthLine);


    //-------------------WEEKLY----------------------------------------------------------------------------
      console.log("drawing week chart...");
      var numDays = 7;

      var g2 = gr.weekChart.append("g").attr("transform", "translate(" + gr.margin.left + "," + gr.margin.top + ")");

      var dateArray2 = dateArray1.slice(-numDays,);
      var metricArray2 = metricArray1.slice(-numDays,);

      var chartcontent2 = [];
      for (var i = 0; i < dateArray2.length; i++) {
        chartcontent2.push({date:gr.parseTime(dateArray2[i]),metric:metricArray2[i]});
      }

      gr.x.domain(d3.extent(chartcontent2, function(d,i) { return d.date; }));
      gr.y.domain([0,d3.max(metricArray2)]);

      // add the X gridlines
      g2.append("g")
          .attr("class", "grid")
          .attr("transform", "translate(0," + gr.height2 + ")")
          .attr("stroke-width", "2")
          .call(make_x_gridlines(gr.x)
              .tickSize(-gr.height2)
              .tickFormat("")
          )

      // add the Y gridlines
      g2.append("g")
          .attr("class", "grid")
          .attr("stroke-width", "2")
          .call(make_y_gridlines(gr.y)
              .tickSize(-gr.width2)
              .tickFormat("")
          )

      g2.append("g")
          .attr("transform", "translate(0," + gr.height2 + ")")
          .call(d3.axisBottom(gr.x).ticks(7))
          .select(".domain");

      //yaxis
      g2.append("g")
          .call(d3.axisLeft(gr.y).ticks(5))
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.71em");

      g2.append("text")
                .attr("text-anchor", "middle")
                .attr("transform", "translate(" +(-20) +","+(gr.height2/2)+")rotate(-90)")
                .text(gr.nameMap[metric]);

      g2.append("path")
          .datum(chartcontent2)
          .attr("class", "line")
          .attr("d", gr.weekLine);


    //---------------STOP-BY-STOP--------------------------------------------------------------------------
      console.log("drawing stop chart...");

      var g3 = gr.stopChart.append("g").attr("transform", "translate(" + gr.margin.left + "," + gr.margin.top + ")");
      var stopArray3 = [];
      var metricArray3 = [];

      data[date].forEach(function(stopData) {
        if (stopData[gr.metricMap['stop']] != 0) {
          stopArray3.push(stopData[gr.metricMap['stop']]);
          metricArray3.push(stopData[gr.metricMap[metric]]);
        };
      });

      //TODO - show stopname instead of stop_id

      var chartcontent3 = [];
      for (var i = 0; i < stopArray3.length; i++) {
        chartcontent3.push({stop:stopArray3[i],metric:metricArray3[i]});
      }

      gr.x.domain([d3.min(stopArray3),d3.max(stopArray3)]);
      gr.y.domain([0,d3.max(metricArray3)]);
      // add the X gridlines
      g3.append("g")
          .attr("class", "grid")
          .attr("transform", "translate(0," + gr.height3 + ")")
          .attr("stroke-width", "2")
          .call(make_x_gridlines(gr.x)
              .tickSize(-gr.height3)
              .tickFormat("")
          )

      // add the Y gridlines
      g3.append("g")
          .attr("class", "grid")
          .attr("stroke-width", "2")
          .call(make_y_gridlines(gr.y)
              .tickSize(-gr.width3)
              .tickFormat("")
          )

      g3.append("g")
          .attr("transform", "translate(0," + gr.height3 + ")")
          .call(d3.axisBottom(gr.x).ticks(7))
          .select(".domain");

      //yaxis
      g3.append("g")
          .call(d3.axisLeft(gr.y).ticks(5))
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.71em");

      g3.append("text")
                .attr("text-anchor", "middle")
                .attr("transform", "translate(" +(-20) +","+(gr.height3/2)+")rotate(-90)")
                .text(gr.nameMap[metric]);

      g3.append("path")
          .datum(chartcontent3)
          .attr("class", "line")
          .attr("d", gr.stopLine);

    },
  };

  // add our tc object to global window scope
  this.gr = gr;
  console.log('running charts.js');
})();
