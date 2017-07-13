(function(){

  var gr = {

    initialize: function() {
      console.log("initializing charts...");

      gr.chart1 = d3.select("#month-chart").append("svg")
                    .attr("class", "graph")
                    .attr("width","720")
                    .attr("height","240");

      gr.chart2 = d3.select("#week-chart").append("svg")
                      .attr("class", "graph")
                      .attr("width","720")
                      .attr("height","240");

      gr.chart3 = d3.select("#stop-chart").append("svg")
                      .attr("class", "graph")
                      .attr("width","720")
                      .attr("height","240");

      gr.margin = {top: 20, right: 40, bottom: 30, left: 50};

      gr.width1 = +gr.chart1.attr("width") - gr.margin.left - gr.margin.right;
      gr.height1 = +gr.chart1.attr("height") - gr.margin.top - gr.margin.bottom;
      gr.width2 = +gr.chart2.attr("width") - gr.margin.left - gr.margin.right;
      gr.height2 = +gr.chart2.attr("height") - gr.margin.top - gr.margin.bottom;
      gr.width3 = +gr.chart3.attr("width") - gr.margin.left - gr.margin.right;
      gr.height3 = +gr.chart3.attr("height") - gr.margin.top - gr.margin.bottom;

      gr.x1 = d3.scaleTime().range([0, gr.width1]);
      gr.y1 = d3.scaleLinear().range([gr.height1, 0]);
      gr.x2 = d3.scaleTime().range([0, gr.width2]);
      gr.y2 = d3.scaleLinear().range([gr.height2, 0]);
      gr.x3 = d3.scaleLinear().range([0, gr.width3]);
      gr.y3 = d3.scaleLinear().range([gr.height3, 0]);

      gr.parseTime = d3.timeParse("%Y-%m-%d");

      gr.line1 = d3.line()
              .curve(d3.curveLinear)
              .x(function(d){ return gr.x1(d.date);})
              .y(function(d){ return gr.y1(d.metric);});
      gr.line2 = d3.line()
                .curve(d3.curveLinear)
                .x(function(d){ return gr.x2(d.date);})
                .y(function(d){ return gr.y2(d.metric);});
      gr.line3 = d3.line()
                .curve(d3.curveLinear)
                .x(function(d){ return gr.x3(d.stop);})
                .y(function(d){ return gr.y3(d.metric);});

      gr.metricMap = {
        'stop': 0,
        'ewt': 1,
        'rbt': 2,
        'speed': 3
      };

      gr.NameMap = {
        'ewt': 'Estimated Wait Time (min)',
        'rbt': 'Reliability Buffer Time (min)',
        'speed': 'Speed (mph)'
      };
    },

    updateCharts: function(data, metric, stop, date) {
      console.log(`updating charts: metric: ${metric}, stop: ${stop}, date: ${date}:`, data);

      // clear existing data from charts
      d3.selectAll(".graph > *").remove();
  
      //-------------------ALL DATES----------------------------------------------------------------------------  
      console.log("drawing all dates chart...");

      var g1 = gr.chart1.append("g")
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

      gr.x1.domain(d3.extent(chartcontent1, function(d,i) { return d.date; }));
      gr.y1.domain([0,d3.max(metricArray1)]);

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
          .call(make_x_gridlines(gr.x1)
              .tickSize(-gr.height1)
              .tickFormat("")
          )

      // add the Y gridlines
      g1.append("g")     
          .attr("class", "grid")
          .attr("stroke-width", "2")
          .call(make_y_gridlines(gr.y1)
              .tickSize(-gr.width1)
              .tickFormat("")
          )

      g1.append("g")
          .attr("transform", "translate(0," + gr.height1 + ")")
          .call(d3.axisBottom(gr.x1).ticks(7))
          .select(".domain");

      //yaxis
      g1.append("g")
          .call(d3.axisLeft(gr.y1).ticks(5))
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.71em");

      g1.append("text")
                .attr("text-anchor", "middle") 
                .attr("transform", "translate(" +(-20) +","+(gr.height1/2)+")rotate(-90)")  
                .text(gr.NameMap[metric]);

      g1.append("path")
          .datum(chartcontent1)
          .attr("class", "line")
          .attr("d", gr.line1);


    //-------------------WEEKLY----------------------------------------------------------------------------
      console.log("drawing week chart...");
      var numDays = 7;

      var g2 = gr.chart2.append("g").attr("transform", "translate(" + gr.margin.left + "," + gr.margin.top + ")");

      var dateArray2 = dateArray1.slice(-numDays,);
      var metricArray2 = metricArray1.slice(-numDays,);

      var chartcontent2 = [];
      for (var i = 0; i < dateArray2.length; i++) {
        chartcontent2.push({date:gr.parseTime(dateArray2[i]),metric:metricArray2[i]});
      }

      gr.x2.domain(d3.extent(chartcontent2, function(d,i) { return d.date; }));
      gr.y2.domain([0,d3.max(metricArray2)]);

      // add the X gridlines
      g2.append("g")     
          .attr("class", "grid")
          .attr("transform", "translate(0," + gr.height2 + ")")
          .attr("stroke-width", "2")
          .call(make_x_gridlines(gr.x2)
              .tickSize(-gr.height2)
              .tickFormat("")
          )

      // add the Y gridlines
      g2.append("g")     
          .attr("class", "grid")
          .attr("stroke-width", "2")
          .call(make_y_gridlines(gr.y2)
              .tickSize(-gr.width2)
              .tickFormat("")
          )

      g2.append("g")
          .attr("transform", "translate(0," + gr.height2 + ")")
          .call(d3.axisBottom(gr.x2).ticks(7))
          .select(".domain");

      //yaxis
      g2.append("g")
          .call(d3.axisLeft(gr.y2).ticks(5))
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.71em");

      g2.append("text")
                .attr("text-anchor", "middle")  
                .attr("transform", "translate(" +(-20) +","+(gr.height2/2)+")rotate(-90)")  
                .text(gr.NameMap[metric]);
      
      g2.append("path")
          .datum(chartcontent2)
          .attr("class", "line")
          .attr("d", gr.line2);

    //---------------STOP-BY-STOP--------------------------------------------------------------------------
      console.log("drawing stop chart...");

      var g3 = gr.chart3.append("g").attr("transform", "translate(" + gr.margin.left + "," + gr.margin.top + ")");
      var stopArray3 = [];
      var metricArray3 = [];

      data[date].forEach(function(stopData) {
        stopArray3.push(stopData[gr.metricMap['stop']]);
        metricArray3.push(stopData[gr.metricMap[metric]]);
      });

      //TODO - show stopname instead of stop_id

      var chartcontent3 = [];
      for (var i = 0; i < stopArray3.length; i++) {
        chartcontent3.push({stop:stopArray3[i],metric:metricArray3[i]});
      }

      gr.x3.domain([d3.min(stopArray3),d3.max(stopArray3)]);
      gr.y3.domain([0,d3.max(metricArray3)]);
      // add the X gridlines
      g3.append("g")     
          .attr("class", "grid")
          .attr("transform", "translate(0," + gr.height3 + ")")
          .attr("stroke-width", "2")
          .call(make_x_gridlines(gr.x3)
              .tickSize(-gr.height3)
              .tickFormat("")
          )

      // add the Y gridlines
      g3.append("g")     
          .attr("class", "grid")
          .attr("stroke-width", "2")
          .call(make_y_gridlines(gr.y3)
              .tickSize(-gr.width3)
              .tickFormat("")
          )

      g3.append("g")
          .attr("transform", "translate(0," + gr.height3 + ")")
          .call(d3.axisBottom(gr.x3).ticks(7))
          .select(".domain");

      //yaxis
      g3.append("g")
          .call(d3.axisLeft(gr.y3).ticks(5))
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 6)
          .attr("dy", "0.71em");

      g3.append("text")
                .attr("text-anchor", "middle")  
                .attr("transform", "translate(" +(-20) +","+(gr.height3/2)+")rotate(-90)")  
                .text(gr.NameMap[metric]);
      
      g3.append("path")
          .datum(chartcontent3)
          .attr("class", "line")
          .attr("d", gr.line3);

    },
  };

  // add our tc object to global window scope
  this.gr = gr;
  console.log('running charts.js');
})();