//Excess Wait Time
var Manhattan1 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [10, 5, 3, 7, 5, 11, 9, 2, 3, 4],
  type: 'scatter',
  name: 'Manhattan',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var Brooklyn1 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [6, 5, 11, 9, 5, 13, 7, 2, 5, 8],
  type: 'scatter',
  name: 'Brooklyn',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var Queens1 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [16, 13, 11, 9, 13, 17, 15, 11, 9, 14],
  type: 'scatter',
  name: 'Queens',
  marker: {
    size: 4,
    color:'purple',
    line: {
      width: 0.5
    }
  }
};
var Bronx1 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [6, 5, 4, 9, 11, 5, 11, 14, 12, 13],
  type: 'scatter',
  name: 'Bronx',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var StatenIsland1 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [7, 5, 8, 9, 11, 9, 11, 5, 11, 13],
  type: 'scatter',
  name: 'Staten Island',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var data1 = [Manhattan1, Brooklyn1, Queens1, Bronx1, StatenIsland1];
var layout1 = {
  title: 'PAST MONTH TRENDLINE',
  yaxis: {
    title: 'Excess Wait Time (min)',
    color: 'purple',
    showline: false
  }
};
Plotly.newPlot('EWT', data1, layout1, {displayModeBar: false});

//Average Speed
var Manhattan2 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [10, 5, 3, 7, 5, 11, 9, 2, 3, 4],
  type: 'scatter',
  name: 'Manhattan',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var Brooklyn2 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [6, 5, 11, 9, 5, 13, 7, 2, 5, 8],
  type: 'scatter',
  name: 'Brooklyn',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var Queens2 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [13, 13, 11, 4, 5, 6, 7, 11, 9, 14],
  type: 'scatter',
  name: 'Queens',
  marker: {
    size: 4,
    color:'purple',
    line: {
      width: 0.5
    }
  }
};
var Bronx2 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [6, 5, 4, 9, 11, 5, 11, 10, 9, 10],
  type: 'scatter',
  name: 'Bronx',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var StatenIsland2 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [7, 5, 8, 9, 4, 5, 6, 7, 11, 13],
  type: 'scatter',
  name: 'Staten Island',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var data2 = [Manhattan2, Brooklyn2, Queens2, Bronx2, StatenIsland2];
var layout2 = {
  title: 'PAST MONTH TRENDLINE',
  yaxis: {
    title: 'Average Speed (km/h)',
    color: 'purple',
    showline: false
  }
};
Plotly.newPlot('AS', data2, layout2, {displayModeBar: false});


//Reliability Buffer Time
var Manhattan3 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [10, 5, 3, 11, 4, 8, 6, 2, 3, 4],
  type: 'scatter',
  name: 'Manhattan',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var Brooklyn3 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [6, 5, 11, 9, 11, 4, 9, 6, 5, 8],
  type: 'scatter',
  name: 'Brooklyn',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var Queens3 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [16, 13, 11, 9, 13, 4, 5, 6, 7, 9, 14],
  type: 'scatter',
  name: 'Queens',
  marker: {
    size: 4,
    color:'purple',
    line: {
      width: 0.5
    }
  }
};
var Bronx3 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [6, 5, 4, 5, 6, 7, 11, 14, 14, 13],
  type: 'scatter',
  name: 'Bronx',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var StatenIsland3 = {
  x: ['2017-06-01', '2017-06-03', '2017-06-06', '2017-06-09', '2017-06-12', '2017-06-15', '2017-06-18', '2017-06-21', '2017-06-24', '2017-06-27'],
  y: [7, 5, 8, 9, 4, 5, 6, 7, 11, 13],
  type: 'scatter',
  name: 'Staten Island',
  marker: {
    size: 4,
    line: {
      width: 0.5
    }
  }
};
var data3 = [Manhattan3, Brooklyn3, Queens3, Bronx3, StatenIsland3];
var layout3 = {
  title: 'PAST MONTH TRENDLINE',
  yaxis: {
    title: 'Excess Buffer Time (min)',
    color: 'purple',
    showline: false
  }
};
Plotly.newPlot('RBT', data3, layout3, {displayModeBar: false});



//Excess Journey Time

var trace1 = {
  x: ['Scheduled', 'Average'],
  y: [5, 6],
  width: [0.5, 0.5],
  name: '',
  type: 'bar',
  marker:{
    color: '#874dad'
  }
};

var trace2 = {
  x: ['Scheduled', 'Average'],
  y: [43, 49],
  type: 'bar',
  name: '',
  width: [0.5, 0.5],
  marker: {
    color: 'rgb(142,124,195)',
  }
};

var data4 = [trace1, trace2];

var layout4 = {
  barmode: 'stack',
  label:'false',
  yaxis: {
    title: 'Excess Journey Time (min)',
    color: 'purple',
    showline: false
  }
};

Plotly.newPlot('EJT', data4, layout4, {displayModeBar: false});
